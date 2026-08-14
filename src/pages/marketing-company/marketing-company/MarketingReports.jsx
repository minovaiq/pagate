import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";

const formatNumberInput=v=>String(v??"").replace(/\D/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,",");
const parseNumberInput=v=>String(v??"").replace(/,/g,"").replace(/\D/g,"");
export default function MarketingReports({ project }) {
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

  const [fromDate, setFromDate] = useState(firstDayOfMonth);
  const [toDate, setToDate] = useState(today);

  useEffect(() => {
    loadReports();
  }, [fromDate, toDate]);

  async function loadReports() {
    try {
      setLoading(true);

      const { data: transactionsData, error: transactionsError } =
        await supabase
          .from("transactions")
          .select("*")
          .eq("project_id", project.id)
          .gte("transaction_date", fromDate)
          .lte("transaction_date", toDate)
          .order("transaction_date", { ascending: false });

      if (transactionsError) throw transactionsError;

      const { count: clientsTotal } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("project_id", project.id);

      const { count: campaignsTotal } = await supabase
        .from("page_campaigns")
        .select("*", { count: "exact", head: true })
        .eq("project_id", project.id);

      setTransactions(transactionsData || []);
      setClientsCount(clientsTotal || 0);
      setCampaignsCount(campaignsTotal || 0);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل تحميل التقارير");
    } finally {
      setLoading(false);
    }
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
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-sm font-black">التقارير</h1>
          <p className="text-[9px] text-slate-300">
            فلترة يومية وشهرية حسب التاريخ
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-1 mb-2">
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
        />

        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
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

      {loading ? (
        <div className="text-center py-6 text-[10px] text-slate-300">
          جاري التحميل...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1 mb-2">
            <ReportBox title="الدخل" value={totalIncome} color="text-green-400" />
            <ReportBox title="الصرف" value={totalExpenses} color="text-red-400" />
            <ReportBox title="الصافي" value={netProfit} color="text-blue-400" />
            <ReportBox title="الإعلانات" value={totalAdSpend} color="text-orange-400" />
            <ReportBox title="دخل الترويج" value={promotionIncome} color="text-cyan-400" />
            <ReportBox title="دخل الخدمات" value={servicesIncome} color="text-emerald-400" />
            <ReportBox title="العملاء" value={clientsCount} color="text-purple-400" simple />
            <ReportBox title="الحملات" value={campaignsCount} color="text-yellow-400" simple />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-md p-2">
            <h2 className="text-[11px] font-black mb-2">تفصيل الأيام</h2>

            {dailySummary.length === 0 ? (
              <div className="text-center py-4 text-[10px] text-slate-300">
                لا توجد بيانات ضمن هذا التاريخ
              </div>
            ) : (
              <div className="space-y-1">
                {dailySummary.map((day) => (
                  <div
                    key={day.date}
                    className="grid grid-cols-5 gap-1 bg-slate-950 rounded-md p-2"
                  >
                    <DayBox title="التاريخ" value={day.date} />
                    <DayBox title="الدخل" value={day.income} color="text-green-400" />
                    <DayBox title="الصرف" value={day.expenses} color="text-red-400" />
                    <DayBox title="الصافي" value={day.income - day.expenses} color="text-blue-400" />
                    <DayBox title="العمليات" value={day.count} simple />
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ReportBox({ title, value, color, simple = false }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-md p-2">
      <p className="text-[8px] text-slate-300 mb-1">{title}</p>
      <h2 className={`text-[10px] font-black ${color}`}>
        {simple ? value : Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}

function DayBox({ title, value, color = "text-white", simple = false }) {
  return (
    <div>
      <p className="text-[8px] text-slate-300 mb-1">{title}</p>
      <h2 className={`text-[9px] font-black truncate ${color}`}>
        {simple ? value : Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}