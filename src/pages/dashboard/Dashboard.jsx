import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase/client";

export default function Dashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    totalAdSpend: 0,
    monthlyObligations: 0,
    projectsCount: 0,
    appOpens: 0,
    appInstalls: 0,
  });

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);

      const { data: statsData, error: statsError } = await supabase
        .from("project_stats")
        .select("*");

      if (statsError) throw statsError;

      const totalIncome = (statsData || []).reduce(
        (sum, item) => sum + Number(item.total_income || 0),
        0
      );

      const totalExpenses = (statsData || []).reduce(
        (sum, item) => sum + Number(item.total_expenses || 0),
        0
      );

      const netProfit = (statsData || []).reduce(
        (sum, item) => sum + Number(item.net_profit || 0),
        0
      );

      const totalAdSpend = (statsData || []).reduce(
        (sum, item) => sum + Number(item.total_ad_spend || 0),
        0
      );

      const monthlyObligations = (statsData || []).reduce(
        (sum, item) => sum + Number(item.monthly_obligations_total || 0),
        0
      );

      const { count: appOpens } = await supabase
        .from("app_usage_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "open");

      const { count: appInstalls } = await supabase
        .from("app_usage_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "install");

      setStats({
        totalIncome,
        totalExpenses,
        netProfit,
        totalAdSpend,
        monthlyObligations,
        projectsCount: statsData?.length || 0,
        appOpens: appOpens || 0,
        appInstalls: appInstalls || 0,
      });

      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (projectsError) throw projectsError;

      setProjects(projectsData || []);
    } catch (error) {
      console.log(error);
      alert(error.message || "حدث خطأ أثناء تحميل الداشبورد");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/");
  }

  function formatMoney(value) {
    return Number(value || 0).toLocaleString("en-US");
  }

  function projectTypeName(type) {
    switch (type) {
      case "marketing_company":
        return "شركة ترويج";
      case "mobile_office":
        return "مكتب الحويجة";
      case "product_store":
        return "مخزن منتجات";
      case "my_pages":
        return "بيجاتي";
      default:
        return type;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-6 py-5 flex flex-col items-center gap-3 shadow-2xl">
          <div className="relative">
            <div className="w-10 h-10 rounded-full border-4 border-slate-700"></div>
            <div className="absolute inset-0 w-10 h-10 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
          </div>

          <div className="text-center">
            <h2 className="text-sm font-black text-white">
              تحميل الداشبورد
            </h2>

            <p className="text-[10px] text-slate-500 mt-1">
              جاري تجهيز البيانات والإحصائيات
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-white text-[11px]">
      <div className="p-2 border-b border-slate-800 bg-slate-900 flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-sm font-black">لوحة التحكم</h1>

          <p className="text-slate-400 text-[9px] mt-1">
            نظرة عامة على النظام المالي
          </p>
        </div>

        <div className="flex gap-1 flex-wrap justify-end">
          <button
            onClick={() => navigate("/projects")}
            className="bg-blue-600 hover:bg-blue-700 px-2 h-7 rounded-md text-[9px] font-black"
          >
            المشاريع
          </button>

          <button
            onClick={() => navigate("/create-project")}
            className="bg-emerald-600 hover:bg-emerald-700 px-2 h-7 rounded-md text-[9px] font-black"
          >
            إنشاء
          </button>

          <button
            onClick={() => navigate("/reports")}
            className="bg-purple-600 hover:bg-purple-700 px-2 h-7 rounded-md text-[9px] font-black"
          >
            التقارير
          </button>

          <button
            onClick={() => navigate("/finance-ai")}
            className="bg-cyan-600 hover:bg-cyan-700 px-2 h-7 rounded-md text-[9px] font-black"
          >
            AI Assistant
          </button>

          <button
            onClick={() => navigate("/settings")}
            className="bg-slate-700 hover:bg-slate-600 px-2 h-7 rounded-md text-[9px] font-black"
          >
            الإعدادات
          </button>

          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 px-2 h-7 rounded-md text-[9px] font-black"
          >
            خروج
          </button>
        </div>
      </div>

      <div className="p-2">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-1 mb-2">
          <StatCard
            title="الدخل"
            value={formatMoney(stats.totalIncome)}
            color="text-green-400"
          />

          <StatCard
            title="الصرف"
            value={formatMoney(stats.totalExpenses)}
            color="text-red-400"
          />

          <StatCard
            title="الصافي"
            value={formatMoney(stats.netProfit)}
            color="text-blue-400"
          />

          <StatCard
            title="الترويج"
            value={formatMoney(stats.totalAdSpend)}
            color="text-orange-400"
          />

          <StatCard
            title="التزامات"
            value={formatMoney(stats.monthlyObligations)}
            color="text-purple-400"
          />

          <StatCard
            title="المشاريع"
            value={stats.projectsCount}
            color="text-cyan-400"
          />

          <StatCard
            title="فتح التطبيق"
            value={stats.appOpens}
            color="text-sky-400"
          />

          <StatCard
            title="التثبيتات"
            value={stats.appInstalls}
            color="text-emerald-400"
          />
        </div>

        <div className="bg-gradient-to-br from-cyan-950 to-slate-900 border border-cyan-900 rounded-xl p-3 mb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="text-sm font-black flex items-center gap-2">
                🤖 المساعد المالي الذكي
              </h2>

              <p className="text-[9px] text-cyan-200 mt-1 leading-5">
                اسأل الذكاء الاصطناعي عن الأرباح، المخاطر، خطة العمل،
                الصرفيات، وتحليل مشاريعك.
              </p>
            </div>

            <button
              onClick={() => navigate("/finance-ai")}
              className="bg-cyan-600 hover:bg-cyan-700 px-4 h-9 rounded-lg text-[10px] font-black"
            >
              فتح AI Assistant
            </button>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-black">المشاريع</h2>

            <button
              onClick={() => navigate("/projects")}
              className="bg-slate-800 hover:bg-slate-700 px-2 h-7 rounded-md text-[9px] font-black"
            >
              عرض الكل
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="text-center text-slate-400 py-6 text-[10px]">
              لا توجد مشاريع
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-1">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="bg-slate-950 border border-slate-800 rounded-lg p-2"
                >
                  <h3 className="text-[11px] font-black mb-1 truncate">
                    {project.name}
                  </h3>

                  <p className="text-slate-400 text-[8px] mb-2">
                    {projectTypeName(project.type)}
                  </p>

                  <button
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="w-full bg-blue-600 hover:bg-blue-700 h-7 rounded-md text-[9px] font-black"
                  >
                    فتح
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
      <p className="text-slate-400 text-[8px] mb-1 truncate">{title}</p>

      <h2 className={`text-[10px] font-black break-words leading-none ${color}`}>
        {value}
      </h2>
    </div>
  );
}