import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { notifyTelegramOperation } from "../../services/supabase/telegram";
import { createMarketingNotification } from "./notificationService";
import { getLatestArchive, isAfterArchive } from "./archiveUtils";

const formatNumberInput=v=>String(v??"").replace(/\D/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,",");
const parseNumberInput=v=>String(v??"").replace(/,/g,"").replace(/\D/g,"");
export default function MarketingReports({ project, canDelete = false }) {
  const today = new Date().toISOString().slice(0, 10);
  const firstDayOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )
    .toISOString()
    .slice(0, 10);

  const [transactions, setTransactions] = useState([]);
  const [clientsCount, setClientsCount] = useState(0);
  const [campaignsCount, setCampaignsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [archives, setArchives] = useState([]);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showAutoArchivePrompt, setShowAutoArchivePrompt] = useState(false);
  const [autoArchiveMonthLabel, setAutoArchiveMonthLabel] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [expandedArchiveId, setExpandedArchiveId] = useState(null);
  const [expandedArchiveClientKey, setExpandedArchiveClientKey] = useState(null);
  const [selectedArchivedClient, setSelectedArchivedClient] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resettingSystem, setResettingSystem] = useState(false);

  const [fromDate, setFromDate] = useState(firstDayOfMonth);
  const [toDate, setToDate] = useState(today);

  useEffect(() => {
    loadReports();
  }, [fromDate, toDate]);

  async function loadReports() {
    try {
      setLoading(true);

      const [latestArchive, archivesResult] = await Promise.all([
        getLatestArchive(project.id),
        supabase
          .from("promotion_monthly_archives")
          .select("*")
          .eq("project_id", project.id)
          .order("created_at", { ascending: false }),
      ]);

      let transactionsQuery = supabase
        .from("transactions")
        .select("*")
        .eq("project_id", project.id)
        .gte("transaction_date", fromDate)
        .lte("transaction_date", toDate)
        .order("transaction_date", { ascending: false });

      const { data: transactionsData, error: transactionsError } =
        await transactionsQuery;

      if (transactionsError) throw transactionsError;
      if (archivesResult.error) throw archivesResult.error;

      const { count: clientsTotal } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("project_id", project.id);

      const { count: campaignsTotal } = await supabase
        .from("page_campaigns")
        .select("*", { count: "exact", head: true })
        .eq("project_id", project.id);

      setTransactions(
        (transactionsData || []).filter((item) =>
          isAfterArchive(item.created_at, latestArchive?.created_at)
        )
      );
      const loadedArchives = archivesResult.data || [];

      setArchives(loadedArchives);
      setClientsCount(clientsTotal || 0);
      setCampaignsCount(campaignsTotal || 0);

      checkAutomaticArchiveReminder(loadedArchives);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل تحميل التقارير");
    } finally {
      setLoading(false);
    }
  }

  async function archiveAllCurrentAmounts() {
    if (archiving) return;

    setArchiving(true);

    try {
      const latestArchive = await getLatestArchive(project.id);

      const [
        transactionsResult,
        spendResult,
        cardsResult,
      ] = await Promise.all([
        supabase
          .from("transactions")
          .select("*")
          .eq("project_id", project.id)
          .order("created_at", { ascending: true }),

        supabase
          .from("promotion_ad_spend_entries")
          .select("*")
          .eq("project_id", project.id)
          .order("created_at", { ascending: true }),

        supabase
          .from("promotion_cards")
          .select("*")
          .eq("project_id", project.id)
          .order("created_at", { ascending: true }),
      ]);

      if (transactionsResult.error) throw transactionsResult.error;
      if (spendResult.error) throw spendResult.error;
      if (cardsResult.error) throw cardsResult.error;

      const activeTransactions = (transactionsResult.data || []).filter((item) =>
        isAfterArchive(item.created_at, latestArchive?.created_at)
      );
      const activeSpendEntries = (spendResult.data || []).filter((item) =>
        isAfterArchive(item.created_at || item.spend_date, latestArchive?.created_at)
      );
      const currentCards = cardsResult.data || [];

      if (activeTransactions.length === 0 && activeSpendEntries.length === 0) {
        alert("لا توجد مبالغ جديدة لأرشفتها");
        return;
      }

      const promotionTransactions = activeTransactions.filter(
        (item) => item.type === "income" && item.service_type === "promotion"
      );
      const serviceTransactions = activeTransactions.filter(
        (item) => item.type === "income" && item.service_type !== "promotion"
      );
      const expenseTransactions = activeTransactions.filter(
        (item) => item.type === "expense"
      );

      const promotionProfit = promotionTransactions.reduce(
        (sum, item) => sum + Number(item.company_profit || 0),
        0
      );
      const servicesIncome = serviceTransactions.reduce(
        (sum, item) => sum + Number(item.amount_received || 0),
        0
      );
      const expensesTotal = expenseTransactions.reduce(
        (sum, item) => sum + Number(item.amount_received || 0),
        0
      );
      const totalIncomeValue = promotionProfit + servicesIncome;
      const netProfitValue = totalIncomeValue - expensesTotal;

      const totalReceivedValue = activeTransactions
        .filter((item) => item.type === "income")
        .reduce((sum, item) => sum + Number(item.amount_received || 0), 0);
      const totalAdBudgetValue = promotionTransactions.reduce(
        (sum, item) => sum + Number(item.ad_spend_amount || 0),
        0
      );
      const totalActualSpentValue = activeSpendEntries.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      );
      const totalRemainingValue =
        totalAdBudgetValue - totalActualSpentValue;
      const totalCardsBalanceValue = currentCards.reduce(
        (sum, card) => sum + Number(card.current_balance || 0),
        0
      );

      const allDates = [
        ...activeTransactions.map((item) => item.created_at),
        ...activeSpendEntries.map((item) => item.created_at || item.spend_date),
      ].filter(Boolean).sort();

      const periodStart =
        String(allDates[0] || new Date().toISOString()).slice(0, 10);
      const periodEnd = new Date().toISOString().slice(0, 10);
      const archiveName = `أرشيف ${new Intl.DateTimeFormat("ar-IQ", {
        month: "long",
        year: "numeric",
      }).format(new Date())}`;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const snapshot = {
        summary: {
          accounting_income: Math.round(totalIncomeValue),
          promotion_profit: Math.round(promotionProfit),
          services_income: Math.round(servicesIncome),
          expenses: Math.round(expensesTotal),
          net_profit: Math.round(netProfitValue),
          total_received: Math.round(totalReceivedValue),
          ad_budget: Math.round(totalAdBudgetValue),
          actual_ad_spend: Math.round(totalActualSpentValue),
          remaining_ad_balance: Math.round(totalRemainingValue),
          cards_balance: Math.round(totalCardsBalanceValue),
        },
        transactions: activeTransactions,
        promotion_spend_entries: activeSpendEntries,
        promotion_cards: currentCards,
      };

      const { error } = await supabase
        .from("promotion_monthly_archives")
        .insert([
          {
            project_id: project.id,
            created_by: user.id,
            archive_name: archiveName,
            period_start: periodStart,
            period_end: periodEnd,
            total_received: Math.round(totalReceivedValue),
            total_ad_budget: Math.round(totalAdBudgetValue),
            total_actual_spent: Math.round(totalActualSpentValue),
            total_remaining: Math.round(totalRemainingValue),
            total_cards_balance: Math.round(totalCardsBalanceValue),
            difference: Math.round(totalCardsBalanceValue - totalRemainingValue),
            clients_count: new Set(
              activeTransactions.map((item) => item.client_id).filter(Boolean)
            ).size,
            snapshot,
            note: `الدخل المحاسبي: ${Math.round(totalIncomeValue)} | الصرفيات: ${Math.round(expensesTotal)} | صافي الربح: ${Math.round(netProfitValue)}`,
          },
        ]);

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "promotion_monthly_archives",
        action: "create",
        title: "أرشفة مالية شاملة",
        description: `${archiveName} - صافي الربح: ${Math.round(netProfitValue).toLocaleString("en-US")}`,
        amount: Math.round(netProfitValue),
      });

      await createMarketingNotification({
        projectId: project.id,
        title: "تمت الأرشفة المالية بنجاح",
        message: `${archiveName} - صافي الربح ${Math.round(netProfitValue).toLocaleString("en-US")} د.ع`,
        type: "archive",
        severity: "success",
        dedupeKey: `archive-success-${periodStart}-${periodEnd}`,
        actionTab: "reports",
      });

      setShowArchiveModal(false);
      setShowAutoArchivePrompt(false);
      await loadReports();
      alert("تمت أرشفة كل المبالغ وبدأت دورة تسجيل جديدة");
    } catch (err) {
      console.log(err);
      alert(err.message || "فشلت الأرشفة");
    } finally {
      setArchiving(false);
    }
  }

  async function resetSystemKeepClients() {
    if (!canDelete) {
      alert("ليس لديك صلاحية تصفير النظام");
      return;
    }

    if (resetConfirmText.trim() !== "تصفير") {
      alert('اكتب كلمة "تصفير" للتأكيد');
      return;
    }

    setResettingSystem(true);

    try {
      // نحذف بيانات هذا المشروع فقط، ولا نلمس جدول clients نهائياً.
      const tablesToClear = [
        "promotion_ad_spend_entries",
        "promotion_weekly_audits",
        "promotion_cards",
        "page_campaigns",
        "transactions",
        "promotion_monthly_archives",
        "marketing_notifications",
      ];

      for (const tableName of tablesToClear) {
        const { error } = await supabase
          .from(tableName)
          .delete()
          .eq("project_id", project.id);

        if (error) {
          throw new Error(`فشل تصفير جدول ${tableName}: ${error.message}`);
        }
      }

      // حذف هدف الشهر والإعدادات المحلية الخاصة بهذا المشروع فقط.
      Object.keys(localStorage).forEach((key) => {
        if (
          key.startsWith(`marketing-monthly-goal-${project.id}-`) ||
          key.startsWith(`marketing-auto-archive-dismissed-${project.id}-`)
        ) {
          localStorage.removeItem(key);
        }
      });

      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith(`marketing-auto-archive-dismissed-${project.id}-`)) {
          sessionStorage.removeItem(key);
        }
      });

      setResetConfirmText("");
      setShowResetModal(false);

      window.dispatchEvent(new CustomEvent("marketing-data-changed"));
      await loadReports();

      alert("تم تصفير النظام بنجاح. بقيت معلومات الزبائن فقط.");
    } catch (error) {
      console.error(error);
      alert(
        error.message ||
          "فشل تصفير النظام. تأكد من صلاحيات الحذف على الجداول."
      );
    } finally {
      setResettingSystem(false);
    }
  }

  function checkAutomaticArchiveReminder(loadedArchives) {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    const isLastDayOfMonth = tomorrow.getMonth() !== now.getMonth();

    if (!isLastDayOfMonth) {
      setShowAutoArchivePrompt(false);
      return;
    }

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const alreadyArchived = loadedArchives.some((archive) => {
      if (!archive?.period_end) return false;

      const archiveEnd = new Date(`${archive.period_end}T00:00:00`);

      return (
        archiveEnd.getFullYear() === currentYear &&
        archiveEnd.getMonth() === currentMonth
      );
    });

    const dismissedKey = `marketing-auto-archive-dismissed-${project.id}-${currentYear}-${String(
      currentMonth + 1
    ).padStart(2, "0")}`;

    const dismissed = sessionStorage.getItem(dismissedKey) === "1";

    if (!alreadyArchived && !dismissed) {
      const monthLabel = new Intl.DateTimeFormat("ar-IQ", {
        month: "long",
        year: "numeric",
      }).format(now);

      setAutoArchiveMonthLabel(monthLabel);
      setShowAutoArchivePrompt(true);
    }
  }

  function dismissAutoArchivePrompt() {
    const now = new Date();
    const dismissedKey = `marketing-auto-archive-dismissed-${project.id}-${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;

    sessionStorage.setItem(dismissedKey, "1");
    setShowAutoArchivePrompt(false);
  }

  function setTodayFilter() {
    setFromDate(today);
    setToDate(today);
  }

  function setMonthFilter() {
    setFromDate(firstDayOfMonth);
    setToDate(today);
  }

  const incomeTransactions = transactions.filter((item) => item.type === "income");
  const expenseTransactions = transactions.filter((item) => item.type === "expense");

  const totalIncome = incomeTransactions.reduce((sum, item) => {
    if (item.service_type === "promotion") {
      return sum + Number(item.company_profit || 0);
    }
    return sum + Number(item.amount_received || 0);
  }, 0);

  const totalExpenses = expenseTransactions.reduce(
    (sum, item) => sum + Number(item.amount_received || 0),
    0
  );

  const totalAdSpend = transactions.reduce(
    (sum, item) => sum + Number(item.ad_spend_amount || 0),
    0
  );

  const totalProfit = transactions.reduce(
    (sum, item) => sum + Number(item.company_profit || 0),
    0
  );

  const netProfit = totalIncome - totalExpenses;

  const promotionIncome = incomeTransactions
    .filter((item) => item.service_type === "promotion")
    .reduce((sum, item) => sum + Number(item.amount_received || 0), 0);

  const servicesIncome = incomeTransactions
    .filter((item) => item.service_type !== "promotion")
    .reduce((sum, item) => sum + Number(item.amount_received || 0), 0);

  const dailySummary = Object.values(
    transactions.reduce((acc, item) => {
      const day = item.transaction_date || item.created_at?.slice(0, 10);

      if (!acc[day]) {
        acc[day] = {
          date: day,
          income: 0,
          expenses: 0,
          profit: 0,
          adSpend: 0,
          count: 0,
        };
      }

      if (item.type === "income") {
        acc[day].income += item.service_type === "promotion"
          ? Number(item.company_profit || 0)
          : Number(item.amount_received || 0);
      }

      if (item.type === "expense") {
        acc[day].expenses += Number(item.amount_received || 0);
      }

      acc[day].profit += Number(item.company_profit || 0);
      acc[day].adSpend += Number(item.ad_spend_amount || 0);
      acc[day].count += 1;

      return acc;
    }, {})
  ).sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-lg p-2">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div>
          <h1 className="text-sm font-black">التقارير</h1>
          <p className="text-[9px] text-slate-700 dark:text-slate-300">
            فلترة يومية وشهرية حسب التاريخ
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowArchiveModal(true)}
            className="h-8 rounded-md bg-amber-500 px-3 text-[10px] font-black text-slate-950 transition hover:bg-amber-400"
          >
            أرشفة كل المبالغ
          </button>

          {canDelete && (
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="h-8 rounded-md bg-red-600 px-3 text-[10px] font-black text-white transition hover:bg-red-700"
            >
              تصفير النظام
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-1 mb-2">
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
        />

        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
        />

        <button
          onClick={setTodayFilter}
          className="bg-blue-600 hover:bg-blue-700 rounded-md text-[10px] font-black"
        >
          اليوم
        </button>

        <button
          onClick={setMonthFilter}
          className="bg-purple-600 hover:bg-purple-700 rounded-md text-[10px] font-black"
        >
          هذا الشهر
        </button>
      </div>

      <div className="mb-2 rounded-md border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-1 flex items-center justify-between">
          <div>
            <h2 className="text-[11px] font-black">الأرشيف المالي</h2>
            <p className="text-[8px] text-slate-600 dark:text-slate-300">
              كل دورة مؤرشفة تبقى محفوظة ويمكن عرض ملخصها
            </p>
          </div>
          <span className="rounded bg-white px-2 py-1 text-[9px] font-black dark:bg-slate-800">
            {archives.length}
          </span>
        </div>

        {archives.length === 0 ? (
          <p className="py-2 text-center text-[9px] text-slate-600 dark:text-slate-300">
            لا توجد أرشفة سابقة
          </p>
        ) : (
          <div className="space-y-1">
            {archives.map((archive) => {
              const expanded = expandedArchiveId === archive.id;
              const summary = archive.snapshot?.summary || {};

              return (
                <div
                  key={archive.id}
                  className="rounded-md border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-950"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedArchiveId(expanded ? null : archive.id)
                    }
                    className="flex w-full items-center justify-between gap-2 text-right"
                  >
                    <div>
                      <p className="text-[10px] font-black">
                        {archive.archive_name}
                      </p>
                      <p className="text-[8px] text-slate-600 dark:text-slate-300">
                        {archive.period_start} إلى {archive.period_end}
                      </p>
                    </div>

                    <div className="text-left">
                      <p className="text-[10px] font-black text-blue-600 dark:text-blue-400">
                        الصافي: {Number(summary.net_profit || 0).toLocaleString("en-US")}
                      </p>
                      <p className="text-[8px] text-slate-600 dark:text-slate-300">
                        {archive.clients_count || 0} زبون
                      </p>
                    </div>
                  </button>

                  {expanded && (() => {
                    const archivedTransactions = Array.isArray(
                      archive.snapshot?.transactions
                    )
                      ? archive.snapshot.transactions
                      : [];

                    const groupedClients = Object.values(
                      archivedTransactions.reduce((acc, item) => {
                        const key =
                          item.client_id ||
                          item.client_phone ||
                          item.client_name ||
                          `without-client-${item.id}`;

                        if (!acc[key]) {
                          acc[key] = {
                            key,
                            name: item.client_name || "بدون اسم",
                            phone: item.client_phone || "-",
                            pageName: item.client_page_name || "-",
                            promotionReceived: 0,
                            promotionProfit: 0,
                            adBudget: 0,
                            servicesIncome: 0,
                            expenses: 0,
                            operationsCount: 0,
                            items: [],
                          };
                        }

                        const client = acc[key];
                        const amount = Number(item.amount_received || 0);

                        client.operationsCount += 1;
                        client.items.push(item);

                        if (
                          item.type === "income" &&
                          item.service_type === "promotion"
                        ) {
                          client.promotionReceived += amount;
                          client.promotionProfit += Number(
                            item.company_profit || 0
                          );
                          client.adBudget += Number(
                            item.ad_spend_amount || 0
                          );
                        } else if (item.type === "income") {
                          client.servicesIncome += amount;
                        } else if (item.type === "expense") {
                          client.expenses += amount;
                        }

                        return acc;
                      }, {})
                    );

                    return (
                      <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-800">
                        <div className="mb-2 grid grid-cols-2 gap-1 md:grid-cols-4">
                          <ReportBox title="الدخل" value={summary.accounting_income || 0} color="text-green-600 dark:text-green-400" />
                          <ReportBox title="الصرفيات" value={summary.expenses || 0} color="text-red-600 dark:text-red-400" />
                          <ReportBox title="صافي الربح" value={summary.net_profit || 0} color="text-blue-600 dark:text-blue-400" />
                          <ReportBox title="باقي الترويج" value={summary.remaining_ad_balance || 0} color="text-amber-600 dark:text-amber-400" />
                        </div>

                        <div className="mb-1 flex items-center justify-between">
                          <h3 className="text-[10px] font-black">تفاصيل الزبائن</h3>
                          <span className="text-[8px] text-slate-600 dark:text-slate-300">
                            {groupedClients.length} زبون
                          </span>
                        </div>

                        <div className="max-h-[420px] space-y-1 overflow-auto">
                          {groupedClients.map((client) => {
                            const clientKey = `${archive.id}-${client.key}`;
                            const clientExpanded =
                              expandedArchiveClientKey === clientKey;
                            const clientIncome =
                              client.promotionProfit + client.servicesIncome;
                            const clientNet = clientIncome - client.expenses;

                            return (
                              <div
                                key={clientKey}
                                className="rounded-md border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                      setSelectedArchivedClient({
                                        archiveId: archive.id,
                                        archiveName: archive.archive_name,
                                        client,
                                        clientNet,
                                      })
                                    }
                                  className="flex w-full items-center justify-between gap-2 text-right"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-[10px] font-black">
                                      {client.name}
                                    </p>
                                    <p className="truncate text-[8px] text-slate-600 dark:text-slate-300">
                                      {client.phone} / {client.pageName}
                                    </p>
                                  </div>

                                  <div className="shrink-0 text-left">
                                    <p className="text-[10px] font-black text-blue-600 dark:text-blue-400">
                                      {clientNet.toLocaleString("en-US")}
                                    </p>
                                    <p className="text-[8px] text-slate-600 dark:text-slate-300">
                                      {client.operationsCount} عملية
                                    </p>
                                  </div>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-6 text-[10px] text-slate-700 dark:text-slate-300">
          جاري التحميل...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1 mb-2">
            <ReportBox title="الدخل" value={totalIncome} color="text-green-600 dark:text-green-400" />
            <ReportBox title="الصرف" value={totalExpenses} color="text-red-600 dark:text-red-400" />
            <ReportBox title="الصافي" value={netProfit} color="text-blue-600 dark:text-blue-400" />
            <ReportBox title="الإعلانات" value={totalAdSpend} color="text-orange-600 dark:text-orange-400" />
            <ReportBox title="دخل الترويج" value={promotionIncome} color="text-cyan-600 dark:text-cyan-400" />
            <ReportBox title="دخل الخدمات" value={servicesIncome} color="text-emerald-600 dark:text-emerald-400" />
            <ReportBox title="العملاء" value={clientsCount} color="text-purple-600 dark:text-purple-400" simple />
            <ReportBox title="الحملات" value={campaignsCount} color="text-yellow-400" simple />
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-2 text-slate-900 dark:text-white">
            <h2 className="text-[11px] font-black mb-2">تفصيل الأيام</h2>

            {dailySummary.length === 0 ? (
              <div className="text-center py-4 text-[10px] text-slate-700 dark:text-slate-300">
                لا توجد بيانات ضمن هذا التاريخ
              </div>
            ) : (
              <div className="space-y-1">
                {dailySummary.map((day) => (
                  <div
                    key={day.date}
                    className="grid grid-cols-5 gap-1 bg-white dark:bg-slate-950 rounded-md p-2 text-slate-900 dark:text-white"
                  >
                    <DayBox title="التاريخ" value={day.date} />
                    <DayBox title="الدخل" value={day.income} color="text-green-600 dark:text-green-400" />
                    <DayBox title="الصرف" value={day.expenses} color="text-red-600 dark:text-red-400" />
                    <DayBox title="الصافي" value={day.income - day.expenses} color="text-blue-600 dark:text-blue-400" />
                    <DayBox title="العمليات" value={day.count} simple />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}      {showArchiveModal && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm"
          onMouseDown={() => !archiving && setShowArchiveModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-black">أرشفة كل المبالغ</h2>
                <p className="mt-1 text-[10px] leading-5 text-slate-600 dark:text-slate-300">
                  سيتم حفظ الترويج والخدمات والصرفيات وصرف الإعلانات وأرصدة البطاقات. بعدها تبدأ الإحصائيات والقوائم من الصفر بدون حذف البيانات القديمة.
                </p>
              </div>

              <button
                type="button"
                disabled={archiving}
                onClick={() => setShowArchiveModal(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-black dark:bg-slate-800"
              >
                ×
              </button>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-1">
              <ReportBox title="الدخل الحالي" value={totalIncome} color="text-green-600 dark:text-green-400" />
              <ReportBox title="الصرفيات الحالية" value={totalExpenses} color="text-red-600 dark:text-red-400" />
              <ReportBox title="صافي الربح الحالي" value={netProfit} color="text-blue-600 dark:text-blue-400" />
              <ReportBox title="عدد العمليات" value={transactions.length} color="text-purple-600 dark:text-purple-400" simple />
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[9px] leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              البيانات الأصلية لن تُحذف. الأرشفة فقط تفصل الدورة الحالية عن التسجيلات الجديدة.
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={archiving}
                onClick={archiveAllCurrentAmounts}
                className="h-10 flex-1 rounded-lg bg-amber-500 text-[11px] font-black text-slate-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {archiving ? "جاري الأرشفة..." : "تأكيد الأرشفة والبدء من جديد"}
              </button>

              <button
                type="button"
                disabled={archiving}
                onClick={() => setShowArchiveModal(false)}
                className="h-10 rounded-lg bg-slate-100 px-4 text-[11px] font-black dark:bg-slate-800"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedArchivedClient && (() => {
        const { archiveName, client, clientNet } = selectedArchivedClient;

        return (
          <div
            dir="rtl"
            className="fixed inset-0 z-[180] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm"
            onMouseDown={() => setSelectedArchivedClient(null)}
          >
            <div
              className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-black">
                    {client.name}
                  </h2>
                  <p className="mt-0.5 text-[10px] text-slate-600 dark:text-slate-300">
                    {client.phone} / {client.pageName}
                  </p>
                  <p className="mt-0.5 text-[9px] text-blue-600 dark:text-blue-400">
                    {archiveName}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedArchivedClient(null)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-black text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
                  aria-label="إغلاق"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1 md:grid-cols-6">
                <ReportBox
                  title="مبلغ الترويج"
                  value={client.promotionReceived}
                  color="text-cyan-600 dark:text-cyan-400"
                />
                <ReportBox
                  title="ربح الترويج"
                  value={client.promotionProfit}
                  color="text-green-600 dark:text-green-400"
                />
                <ReportBox
                  title="ميزانية الإعلان"
                  value={client.adBudget}
                  color="text-amber-600 dark:text-amber-400"
                />
                <ReportBox
                  title="دخل الخدمات"
                  value={client.servicesIncome}
                  color="text-emerald-600 dark:text-emerald-400"
                />
                <ReportBox
                  title="الصرفيات"
                  value={client.expenses}
                  color="text-red-600 dark:text-red-400"
                />
                <ReportBox
                  title="الصافي"
                  value={clientNet}
                  color="text-blue-600 dark:text-blue-400"
                />
              </div>

              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[11px] font-black">جميع عمليات الزبون</h3>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-black dark:bg-slate-800">
                    {client.operationsCount} عملية
                  </span>
                </div>

                <div className="space-y-1">
                  {client.items.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-2 gap-1 rounded-md border border-slate-200 bg-slate-50 p-2 text-[9px] dark:border-slate-800 dark:bg-slate-950 md:grid-cols-5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-black">
                          {item.title || "عملية"}
                        </p>
                        <p className="text-[8px] text-slate-600 dark:text-slate-300">
                          {item.transaction_date ||
                            item.created_at?.slice(0, 10) ||
                            "-"}
                        </p>
                      </div>

                      <span>
                        النوع:{" "}
                        {item.service_type === "promotion"
                          ? "ترويج"
                          : item.type === "expense"
                          ? "صرفية"
                          : "خدمة"}
                      </span>

                      <span>
                        المبلغ:{" "}
                        {Number(item.amount_received || 0).toLocaleString(
                          "en-US"
                        )}
                      </span>

                      <span>
                        الربح:{" "}
                        {Number(item.company_profit || 0).toLocaleString(
                          "en-US"
                        )}
                      </span>

                      <span>
                        الإعلان:{" "}
                        {Number(item.ad_spend_amount || 0).toLocaleString(
                          "en-US"
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {showAutoArchivePrompt && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[190] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm"
          onMouseDown={dismissAutoArchivePrompt}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-4 text-slate-900 shadow-2xl dark:border-amber-900/70 dark:bg-slate-900 dark:text-white"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-3">
              <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-xl dark:bg-amber-950/50">
                📦
              </div>

              <h2 className="text-base font-black">
                انتهى شهر {autoArchiveMonthLabel}
              </h2>

              <p className="mt-1 text-[10px] leading-5 text-slate-600 dark:text-slate-300">
                لم تتم أرشفة مبالغ هذا الشهر بعد. هل تريد أرشفة جميع المبالغ والبدء بدورة تسجيل جديدة؟
              </p>
            </div>

            <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[9px] leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              لن يتم حذف البيانات القديمة. ستُحفظ داخل الأرشيف وتبدأ الإحصائيات الجديدة من الصفر.
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAutoArchivePrompt(false);
                  setShowArchiveModal(true);
                }}
                className="h-10 flex-1 rounded-lg bg-amber-500 text-[11px] font-black text-slate-950 transition hover:bg-amber-400"
              >
                أرشفة الآن
              </button>

              <button
                type="button"
                onClick={dismissAutoArchivePrompt}
                className="h-10 rounded-lg bg-slate-100 px-4 text-[11px] font-black text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              >
                لاحقاً
              </button>
            </div>
          </div>
        </div>
      )}

      {showResetModal && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
          onMouseDown={() => !resettingSystem && setShowResetModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-4 text-slate-900 shadow-2xl dark:border-red-900/70 dark:bg-slate-900 dark:text-white"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-red-600 dark:text-red-400">
                  تصفير النظام
                </h2>
                <p className="mt-1 text-[10px] leading-5 text-slate-600 dark:text-slate-300">
                  سيتم حذف جميع المبالغ والعمليات والإحصائيات والحملات والأرشيفات وأرصدة البطاقات والتنبيهات الخاصة بهذا المشروع.
                </p>
              </div>

              <button
                type="button"
                disabled={resettingSystem}
                onClick={() => setShowResetModal(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-black text-slate-700 dark:bg-slate-800 dark:text-white"
              >
                ×
              </button>
            </div>

            <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[10px] leading-5 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
              لن يتم حذف جدول الزبائن. ستبقى أسماء الزبائن وأرقام الهواتف وأسماء الصفحات محفوظة.
            </div>

            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-[10px] leading-5 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
              هذه العملية نهائية ولا يمكن التراجع عنها. الأرشيفات القديمة أيضاً سيتم حذفها.
            </div>

            <label className="mb-1 block text-[10px] font-black">
              للتأكيد اكتب كلمة: تصفير
            </label>

            <input
              type="text"
              value={resetConfirmText}
              onChange={(event) => setResetConfirmText(event.target.value)}
              placeholder="اكتب تصفير"
              disabled={resettingSystem}
              className="h-10 w-full rounded-lg border border-red-300 bg-white px-3 text-[12px] font-black text-slate-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-red-900 dark:bg-slate-950 dark:text-white"
            />

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={
                  resettingSystem || resetConfirmText.trim() !== "تصفير"
                }
                onClick={resetSystemKeepClients}
                className="h-10 flex-1 rounded-lg bg-red-600 text-[11px] font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {resettingSystem
                  ? "جاري تصفير النظام..."
                  : "تأكيد التصفير وإبقاء الزبائن"}
              </button>

              <button
                type="button"
                disabled={resettingSystem}
                onClick={() => {
                  setResetConfirmText("");
                  setShowResetModal(false);
                }}
                className="h-10 rounded-lg bg-slate-100 px-4 text-[11px] font-black text-slate-700 dark:bg-slate-800 dark:text-white"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function ReportBox({ title, value, color, simple = false }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-2 text-slate-900 dark:text-white">
      <p className="text-[8px] text-slate-700 dark:text-slate-300 mb-1">{title}</p>
      <h2 className={`text-[10px] font-black ${color}`}>
        {simple ? value : Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}

function DayBox({ title, value, color = "text-slate-900 dark:text-white", simple = false }) {
  return (
    <div>
      <p className="text-[8px] text-slate-700 dark:text-slate-300 mb-1">{title}</p>
      <h2 className={`text-[9px] font-black truncate ${color}`}>
        {simple ? value : Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}