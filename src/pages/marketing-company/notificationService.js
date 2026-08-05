import { supabase } from "../../services/supabase/client";

export async function createMarketingNotification({
  projectId,
  title,
  message,
  type = "system",
  severity = "info",
  dedupeKey = null,
  actionTab = null,
  metadata = {},
}) {
  if (!projectId || !title) return null;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    if (dedupeKey) {
      const { data: existing } = await supabase
        .from("marketing_notifications")
        .select("id")
        .eq("project_id", projectId)
        .eq("dedupe_key", dedupeKey)
        .maybeSingle();

      if (existing?.id) return existing;
    }

    const { data, error } = await supabase
      .from("marketing_notifications")
      .insert([
        {
          project_id: projectId,
          created_by: user.id,
          title,
          message: message || null,
          type,
          severity,
          dedupe_key: dedupeKey,
          action_tab: actionTab,
          metadata,
        },
      ])
      .select()
      .single();

    if (error) {
      console.warn("Notification insert failed:", error.message);
      return null;
    }

    window.dispatchEvent(
      new CustomEvent("marketing-notification-created", { detail: data })
    );

    // الإرسال الحقيقي يتم من Supabase Edge Function إلى اشتراكات Web Push.
    // لا نوقف حفظ التنبيه داخل اللوحة إذا فشل Push مؤقتاً.
    supabase.functions
      .invoke("send-web-push", {
        body: { notification_id: data.id },
      })
      .then(({ error: pushError }) => {
        if (pushError) console.warn("Push delivery failed:", pushError.message);
      })
      .catch((pushError) =>
        console.warn("Push delivery failed:", pushError)
      );

    return data;
  } catch (error) {
    console.warn("Notification error:", error);
    return null;
  }
}

export async function evaluateSmartMarketingAlerts({
  projectId,
  monthlyGoal,
  netProfit,
  totalExpenses,
  latestExpense,
  remainingAdBalance,
  cardsBalance,
  archives = [],
}) {
  if (!projectId) return;

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}`;

  const tasks = [];

  if (monthlyGoal > 0 && netProfit >= monthlyGoal) {
    tasks.push(
      createMarketingNotification({
        projectId,
        title: "تم تحقيق هدف الشهر",
        message: `وصل صافي الربح إلى ${Math.round(netProfit).toLocaleString(
          "en-US"
        )} د.ع`,
        type: "goal",
        severity: "success",
        dedupeKey: `goal-achieved-${monthKey}`,
        actionTab: "reports",
      })
    );
  } else if (
    monthlyGoal > 0 &&
    netProfit > 0 &&
    monthlyGoal - netProfit <= monthlyGoal * 0.1
  ) {
    tasks.push(
      createMarketingNotification({
        projectId,
        title: "اقتربت من هدف الشهر",
        message: `باقي ${Math.max(
          0,
          Math.round(monthlyGoal - netProfit)
        ).toLocaleString("en-US")} د.ع فقط`,
        type: "goal",
        severity: "warning",
        dedupeKey: `goal-near-${monthKey}`,
        actionTab: "reports",
      })
    );
  }

  if (netProfit < 0) {
    tasks.push(
      createMarketingNotification({
        projectId,
        title: "تنبيه صافي الربح",
        message: `صافي الربح سالب بمقدار ${Math.abs(
          Math.round(netProfit)
        ).toLocaleString("en-US")} د.ع`,
        type: "finance",
        severity: "danger",
        dedupeKey: `negative-profit-${monthKey}`,
        actionTab: "expenses",
      })
    );
  }

  if (latestExpense && Number(latestExpense.amount_received || 0) >= 500000) {
    tasks.push(
      createMarketingNotification({
        projectId,
        title: "صرفية كبيرة",
        message: `${latestExpense.title || "صرفية"}: ${Number(
          latestExpense.amount_received || 0
        ).toLocaleString("en-US")} د.ع`,
        type: "expense",
        severity: "warning",
        dedupeKey: `large-expense-${latestExpense.id}`,
        actionTab: "expenses",
        metadata: { transaction_id: latestExpense.id },
      })
    );
  }

  const difference = Number(cardsBalance || 0) - Number(remainingAdBalance || 0);

  if (difference < 0) {
    tasks.push(
      createMarketingNotification({
        projectId,
        title: "نقص في أرصدة البطاقات",
        message: `رصيد البطاقات أقل من أمانات الزبائن بـ ${Math.abs(
          Math.round(difference)
        ).toLocaleString("en-US")} د.ع`,
        type: "promotion",
        severity: "danger",
        dedupeKey: `cards-shortage-${monthKey}-${Math.round(
          Math.abs(difference) / 10000
        )}`,
        actionTab: "balances",
      })
    );
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const lastDay = tomorrow.getMonth() !== now.getMonth();

  if (lastDay) {
    const archivedThisMonth = archives.some((archive) => {
      if (!archive?.period_end) return false;
      const date = new Date(`${archive.period_end}T00:00:00`);
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth()
      );
    });

    if (!archivedThisMonth) {
      tasks.push(
        createMarketingNotification({
          projectId,
          title: "الشهر يحتاج أرشفة",
          message: "انتهى الشهر ولم تتم أرشفة المبالغ بعد.",
          type: "archive",
          severity: "warning",
          dedupeKey: `archive-reminder-${monthKey}`,
          actionTab: "reports",
        })
      );
    }
  }

  await Promise.allSettled(tasks);
}
