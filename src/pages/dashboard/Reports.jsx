import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase/client";

export default function Reports() {
  const navigate = useNavigate();

  const today = new Date().toISOString().slice(0, 10);
  const firstDayOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )
    .toISOString()
    .slice(0, 10);

  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(firstDayOfMonth);
  const [toDate, setToDate] = useState(today);

  const [transactions, setTransactions] = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    loadReports();
  }, [fromDate, toDate]);

  async function loadReports() {
    try {
      setLoading(true);

      const { data: transactionsData, error: transactionsError } =
        await supabase
          .from("transactions")
          .select("*, projects(name, type)")
          .gte("transaction_date", fromDate)
          .lte("transaction_date", toDate)
          .order("transaction_date", { ascending: false });

      if (transactionsError) throw transactionsError;

      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (projectsError) throw projectsError;

      setTransactions(transactionsData || []);
      setProjects(projectsData || []);
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

  function projectTypeName(type) {
    switch (type) {
      case "marketing_company":
        return "ترويج";
      case "mobile_office":
        return "موبايل";
      case "product_store":
        return "مخزن";
      case "my_pages":
        return "بيجاتي";
      default:
        return type || "-";
    }
  }

  const income = transactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount_received || 0), 0);

  const expenses = transactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount_received || 0), 0);

  const adSpend = transactions.reduce(
    (sum, item) => sum + Number(item.ad_spend_amount || 0),
    0
  );

  const companyProfit = transactions.reduce(
    (sum, item) => sum + Number(item.company_profit || 0),
    0
  );

  const netProfit = companyProfit - expenses;

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
        acc[day].income += Number(item.amount_received || 0);
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

  const projectSummary = Object.values(
    transactions.reduce((acc, item) => {
      const key = item.project_id || "unknown";

      if (!acc[key]) {
        acc[key] = {
          projectId: key,
          name: item.projects?.name || "-",
          type: item.projects?.type || "-",
          income: 0,
          expenses: 0,
          profit: 0,
          adSpend: 0,
          count: 0,
        };
      }

      if (item.type === "income") {
        acc[key].income += Number(item.amount_received || 0);
      }

      if (item.type === "expense") {
        acc[key].expenses += Number(item.amount_received || 0);
      }

      acc[key].profit += Number(item.company_profit || 0);
      acc[key].adSpend += Number(item.ad_spend_amount || 0);
      acc[key].count += 1;

      return acc;
    }, {})
  ).sort((a, b) => b.income - a.income);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-5 flex flex-col items-center gap-3 shadow-2xl">
          <div className="relative">
            <div className="w-10 h-10 rounded-full border-4 border-slate-700"></div>
            <div className="absolute inset-0 w-10 h-10 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
          </div>

          <div className="text-center">
            <h2 className="text-sm font-black text-white">تحميل التقارير</h2>
            <p className="text-[10px] text-slate-500 mt-1">
              جاري تجهيز البيانات
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-white text-[11px] p-2">
      <div className="max-w-[1600px] mx-auto space-y-2">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-black">التقارير العامة</h1>
            <p className="text-[9px] text-slate-500 mt-1">
              فلترة وتحليل جميع المشاريع
            </p>
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => navigate("/dashboard")}
              className="bg-slate-800 hover:bg-slate-700 rounded-md px-2 h-7 text-[9px] font-black"
            >
              الرئيسية
            </button>

            <button
              onClick={() => navigate("/projects")}
              className="bg-blue-600 hover:bg-blue-700 rounded-md px-2 h-7 text-[9px] font-black"
            >
              المشاريع
            </button>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
            />

            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
            />

            <button
              onClick={setTodayFilter}
              className="bg-blue-600 hover:bg-blue-700 rounded-md h-8 text-[10px] font-black"
            >
              اليوم
            </button>

            <button
              onClick={setMonthFilter}
              className="bg-purple-600 hover:bg-purple-700 rounded-md h-8 text-[10px] font-black"
            >
              هذا الشهر
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-1">
          <StatBox title="الدخل" value={income} color="text-green-400" />
          <StatBox title="الصرف" value={expenses} color="text-red-400" />
          <StatBox title="الصافي" value={netProfit} color="text-blue-400" />
          <StatBox title="الترويج" value={adSpend} color="text-orange-400" />
          <StatBox title="المشاريع" value={projects.length} color="text-purple-400" simple />
          <StatBox title="العمليات" value={transactions.length} color="text-cyan-400" simple />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
            <h2 className="text-[11px] font-black mb-2">تفصيل الأيام</h2>

            {dailySummary.length === 0 ? (
              <div className="text-center text-slate-500 text-[10px] py-6">
                لا توجد بيانات
              </div>
            ) : (
              <div className="space-y-1">
                {dailySummary.map((day) => (
                  <div
                    key={day.date}
                    className="grid grid-cols-5 gap-1 bg-slate-950 border border-slate-800 rounded-md p-2"
                  >
                    <MiniBox title="التاريخ" value={day.date} simple />
                    <MiniBox title="الدخل" value={day.income} color="text-green-400" />
                    <MiniBox title="الصرف" value={day.expenses} color="text-red-400" />
                    <MiniBox title="الصافي" value={day.profit - day.expenses} color="text-blue-400" />
                    <MiniBox title="عدد" value={day.count} simple />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
            <h2 className="text-[11px] font-black mb-2">تفصيل المشاريع</h2>

            {projectSummary.length === 0 ? (
              <div className="text-center text-slate-500 text-[10px] py-6">
                لا توجد بيانات
              </div>
            ) : (
              <div className="space-y-1">
                {projectSummary.map((project) => (
                  <div
                    key={project.projectId}
                    className="bg-slate-950 border border-slate-800 rounded-md p-2"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <h3 className="text-[11px] font-black leading-none">
                          {project.name}
                        </h3>
                        <p className="text-[8px] text-slate-500 mt-1">
                          {projectTypeName(project.type)}
                        </p>
                      </div>

                      <div className="text-left">
                        <h3 className="text-[10px] font-black text-green-400">
                          {project.income.toLocaleString()}
                        </h3>
                        <p className="text-[8px] text-slate-500">
                          {project.count} عملية
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1">
                      <MiniBox title="الصرف" value={project.expenses} color="text-red-400" />
                      <MiniBox title="الربح" value={project.profit - project.expenses} color="text-blue-400" />
                      <MiniBox title="ترويج" value={project.adSpend} color="text-orange-400" />
                      <MiniBox title="عدد" value={project.count} simple />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ title, value, color, simple = false }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
      <p className="text-[8px] text-slate-500 mb-1">{title}</p>
      <h2 className={`text-[10px] font-black ${color}`}>
        {simple ? value : Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}

function MiniBox({ title, value, color = "text-white", simple = false }) {
  return (
    <div className="bg-slate-900 rounded-md p-2">
      <p className="text-[8px] text-slate-500 mb-1 truncate">{title}</p>
      <h2 className={`text-[9px] font-black truncate ${color}`}>
        {simple ? value : Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}