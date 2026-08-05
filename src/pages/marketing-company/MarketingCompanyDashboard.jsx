import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { getLatestArchive, isAfterArchive } from "./archiveUtils";
import MarketingTabs from "./MarketingTabs";
import MarketingNotificationCenter from "./MarketingNotificationCenter";
import { evaluateSmartMarketingAlerts } from "./notificationService";

const formatNumberInput=v=>String(v??"").replace(/\D/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,",");
const parseNumberInput=v=>String(v??"").replace(/,/g,"").replace(/\D/g,"");
export default function MarketingCompanyDashboard({
  project,
  permissions,
  isAdmin,
}) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [monthlyGoal, setMonthlyGoal] = useState(0);
  const [goalInput, setGoalInput] = useState("");

  const canAdd = isAdmin || permissions?.can_add === true;
  const canEdit = isAdmin || permissions?.can_edit === true;
  const canDelete = isAdmin || permissions?.can_delete === true;
  const canReports = isAdmin || permissions?.can_reports === true;

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const goalStorageKey = `marketing-monthly-goal-${project.id}-${currentMonthKey}`;

  useEffect(() => {
    loadTransactions();

    const savedGoal = Number(localStorage.getItem(goalStorageKey) || 0);
    setMonthlyGoal(savedGoal);
    setGoalInput(savedGoal ? String(savedGoal) : "");

    const refreshStats = () => loadTransactions(true);

    const channel = supabase
      .channel(`marketing-dashboard-live-${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `project_id=eq.${project.id}`,
        },
        refreshStats
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "promotion_monthly_archives",
          filter: `project_id=eq.${project.id}`,
        },
        refreshStats
      )
      .subscribe();

    // تحديث احتياطي مضمون حتى إذا كان Realtime غير مفعّل على الجدول.
    const pollingTimer = window.setInterval(refreshStats, 2000);

    const refreshOnFocus = () => refreshStats();
    const refreshOnVisibility = () => {
      if (document.visibilityState === "visible") refreshStats();
    };

    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener("marketing-data-changed", refreshStats);
    document.addEventListener("visibilitychange", refreshOnVisibility);

    return () => {
      window.clearInterval(pollingTimer);
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("marketing-data-changed", refreshStats);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
      supabase.removeChannel(channel);
    };
  }, [project.id, goalStorageKey]);

  async function loadTransactions(silent = false) {
    try {
      if (!silent) setLoading(true);

      const [archive, transactionsResult, spendResult, cardsResult, archivesResult] =
        await Promise.all([
          getLatestArchive(project.id),
          supabase
            .from("transactions")
            .select("id,type,title,service_type,amount_received,company_profit,ad_spend_amount,created_at,project_id")
            .eq("project_id", project.id),
          supabase
            .from("promotion_ad_spend_entries")
            .select("id,amount,created_at,spend_date")
            .eq("project_id", project.id),
          supabase
            .from("promotion_cards")
            .select("id,current_balance")
            .eq("project_id", project.id),
          supabase
            .from("promotion_monthly_archives")
            .select("id,period_end,created_at")
            .eq("project_id", project.id)
            .order("created_at", { ascending: false }),
        ]);

      if (transactionsResult.error) throw transactionsResult.error;

      const activeTransactions = (transactionsResult.data || []).filter((item) =>
        isAfterArchive(item.created_at, archive?.created_at)
      );

      setTransactions(activeTransactions);

      const promotionTransactions = activeTransactions.filter(
        (item) => item.type === "income" && item.service_type === "promotion"
      );
      const activeSpend = (spendResult.data || []).filter((item) =>
        isAfterArchive(item.created_at || item.spend_date, archive?.created_at)
      );
      const adBudget = promotionTransactions.reduce(
        (sum, item) => sum + Number(item.ad_spend_amount || 0),
        0
      );
      const actualSpend = activeSpend.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      );
      const cardsBalance = (cardsResult.data || []).reduce(
        (sum, item) => sum + Number(item.current_balance || 0),
        0
      );
      const latestExpense = activeTransactions
        .filter((item) => item.type === "expense")
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

      const accountingIncome = activeTransactions
        .filter((item) => item.type === "income")
        .reduce(
          (sum, item) =>
            sum +
            (item.service_type === "promotion"
              ? Number(item.company_profit || 0)
              : Number(item.amount_received || 0)),
          0
        );
      const expenses = activeTransactions
        .filter((item) => item.type === "expense")
        .reduce((sum, item) => sum + Number(item.amount_received || 0), 0);

      evaluateSmartMarketingAlerts({
        projectId: project.id,
        monthlyGoal: Number(localStorage.getItem(goalStorageKey) || 0),
        netProfit: accountingIncome - expenses,
        totalExpenses: expenses,
        latestExpense,
        remainingAdBalance: adBudget - actualSpend,
        cardsBalance,
        archives: archivesResult.data || [],
      });
    } catch (err) {
      console.log(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function saveMonthlyGoal(e) {
    e.preventDefault();

    const value = Math.max(0, Number(goalInput || 0));
    localStorage.setItem(goalStorageKey, String(value));
    setMonthlyGoal(value);
    setGoalInput(value ? String(value) : "");
    setShowGoalModal(false);
  }

  // الدخل المحاسبي الصحيح:
  // ربح الشركة من الترويج + كامل دخل الخدمات الأخرى.
  const totalIncome = transactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => {
      if (item.service_type === "promotion") {
        return sum + Number(item.company_profit || 0);
      }
      return sum + Number(item.amount_received || 0);
    }, 0);

  // الصرفيات المسجلة يدوياً فقط.
  const totalExpenses = transactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount_received || 0), 0);

  //  = ربح الترويج + دخل الخدمات الأخرى - الصرفيات اليدوية.
  const netProfit = totalIncome - totalExpenses;

  const monthlyIncome = transactions
    .filter((item) => {
      if (item.type !== "income" || !item.created_at) return false;
      const date = new Date(item.created_at);
      const itemMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return itemMonth === currentMonthKey;
    })
    .reduce((sum, item) => {
      if (item.service_type === "promotion") {
        return sum + Number(item.company_profit || 0);
      }
      return sum + Number(item.amount_received || 0);
    }, 0);

  const goalAchieved = netProfit;
  const goalRemaining = Math.max(0, monthlyGoal - goalAchieved);
  const goalProgress = monthlyGoal > 0 ? Math.min(100, (goalAchieved / monthlyGoal) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-6 py-5 flex flex-col items-center gap-3 shadow-2xl text-slate-900 dark:text-white">
          <div className="relative">
            <div className="w-10 h-10 rounded-full border-4 border-slate-300 dark:border-slate-700"></div>
            <div className="absolute inset-0 w-10 h-10 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
          </div>

          <div className="text-center">
            <h2 className="text-sm font-black text-slate-900 dark:text-white">تحميل شركة الترويج</h2>
            <p className="text-[10px] text-slate-700 dark:text-slate-300 mt-1">
              جاري تجهيز الإحصائيات والصلاحيات
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-1.5 text-[11px] text-slate-900 dark:text-white">
      <div className="h-8 flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/70 pb-1">
        <div className="min-w-0 flex items-center gap-2">
          <h1 className="text-sm md:text-base font-black leading-none truncate">{project.name}</h1>
          <span className="text-slate-600 dark:text-slate-400 text-[9px] font-bold whitespace-nowrap">شركة الترويج</span>
        </div>

        <div className="flex items-center gap-1">
          <MarketingNotificationCenter project={project} />

          <button
            onClick={loadTransactions}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded px-2 h-7 text-[9px] font-black shrink-0"
          >
            تحديث
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 items-start">
        <StatCard
          title="الدخل"
          subtitle="ربح الترويج + دخل الخدمات"
          value={totalIncome}
          color="text-green-600 dark:text-green-400"
        />

        <StatCard
          title="الصرفيات"
          subtitle="المسجلة يدوياً فقط"
          value={totalExpenses}
          color="text-red-600 dark:text-red-400"
        />

        <StatCard
          title="صافي الربح"
          subtitle="ربح الترويج + الخدمات - الصرفيات"
          value={netProfit}
          color={netProfit >= 0 ? "text-violet-600 dark:text-violet-400" : "text-red-600 dark:text-red-400"}
        />

        <GoalCard
          goal={monthlyGoal}
          remaining={goalRemaining}
          progress={goalProgress}
          onEdit={() => {
            setGoalInput(monthlyGoal ? String(monthlyGoal) : "");
            setShowGoalModal(true);
          }}
        />
      </div>

      <MarketingTabs
        project={project}
        canAdd={canAdd}
        canEdit={canEdit}
        canDelete={canDelete}
        canReports={canReports}
      />

      {showGoalModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setShowGoalModal(false)}
        >
          <form
            onSubmit={saveMonthlyGoal}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-4 shadow-2xl text-slate-900 dark:text-white"
          >
            <div className="mb-4">
              <h2 className="text-sm font-black text-slate-900 dark:text-white">هدف هذا الشهر</h2>
              <p className="text-[10px] text-slate-700 dark:text-slate-300 mt-1">
                أدخل قيمة الدخل المطلوب الوصول إليها خلال الشهر الحالي.
              </p>
            </div>

            <input
              autoFocus
              type="text"
              inputMode="numeric"
              value={formatNumberInput(goalInput)}
              onChange={(e)=>setGoalInput(parseNumberInput(e.target.value))}
              placeholder="مثال: 5,000,000"
              className="w-full h-10 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 text-sm font-black outline-none focus:border-amber-500 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />

            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                type="submit"
                className="h-9 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-[11px] font-black"
              >
                حفظ الهدف
              </button>

              <button
                type="button"
                onClick={() => setShowGoalModal(false)}
                className="h-9 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-[11px] font-black"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, subtitle, value, color }) {
  return (
    <div className="h-[92px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-lg px-2.5 py-2 min-w-0 flex flex-col shadow-sm text-slate-900 dark:text-white">
      <p className="text-slate-800 dark:text-slate-100 text-[10px] md:text-[11px] font-black leading-none truncate">
        {title}
      </p>

      <h2 className={`text-[15px] md:text-base font-black leading-none mt-2.5 tabular-nums truncate ${color}`}>
        {Number(value || 0).toLocaleString()}
      </h2>

      <p className="text-slate-700 dark:text-slate-300 text-[8px] md:text-[9px] font-bold leading-tight mt-auto truncate">
        {subtitle}
      </p>
    </div>
  );
}

function GoalCard({ goal, remaining, progress, onEdit }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="h-[92px] w-full text-right bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 hover:border-amber-500/60 rounded-lg px-2.5 py-2 min-w-0 transition-colors shadow-sm"
    >
      <div className="flex items-center justify-between gap-2 leading-none">
        <p className="text-slate-800 dark:text-slate-100 text-[10px] md:text-[11px] font-black truncate">
          هدف هذا الشهر
        </p>
        <span className="text-[8px] text-amber-700 dark:text-amber-300 font-black shrink-0">تعديل</span>
      </div>

      <div className="flex items-end justify-between gap-2 mt-2">
        <h2 className="text-[14px] md:text-[15px] font-black leading-none text-amber-600 dark:text-amber-400 tabular-nums truncate">
          {goal > 0 ? Number(goal).toLocaleString() : "غير محدد"}
        </h2>
        <span className="text-[9px] font-black text-amber-700 dark:text-amber-200 tabular-nums shrink-0">
          {goal > 0 ? `${progress.toFixed(0)}%` : "0%"}
        </span>
      </div>

      <div className="mt-1.5 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 min-w-0">
        <span className="text-[8px] md:text-[9px] font-bold text-sky-700 dark:text-sky-300 leading-none shrink-0">
          المتبقي
        </span>
        <span className="text-[11px] md:text-xs font-black text-sky-600 dark:text-sky-400 tabular-nums truncate leading-none">
          {Number(remaining || 0).toLocaleString()}
        </span>
      </div>
    </button>
  );
}
