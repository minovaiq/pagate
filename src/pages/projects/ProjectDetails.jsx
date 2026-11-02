import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase/client";

import MarketingCompanyDashboard from "../marketing-company/MarketingCompanyDashboard";
import MobileOfficeDashboard from "../mobile-office/MobileOfficeDashboard";
import StoreDashboard from "../product-store/StoreDashboard";
import MyPagesDashboard from "../my-pages/MyPagesDashboard";

/* USER ORDERS */
import UserOrdersDashboard from "../user-orders/UserOrdersDashboard";

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("theme") !== "light";
  });

  useEffect(() => {
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  useEffect(() => {
    loadProjectAndPermissions();
  }, [id]);

  async function loadProjectAndPermissions() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      /* الحساب متوقف */
      if (profileData?.is_active === false) {
        alert("الحساب متوقف");
        await supabase.auth.signOut();
        navigate("/");
        return;
      }

      setProfile(profileData || { email: user.email });

      const adminStatus = profileData?.role === "admin";
      setIsAdmin(adminStatus);

      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (projectError) throw projectError;

      setProject(projectData || null);

      if (!projectData) return;

      if (adminStatus) {
        setPermissions({
          can_view: true,
          can_add: true,
          can_edit: true,
          can_delete: true,
          can_reports: true,
        });

        return;
      }

      const { data: permissionData } = await supabase
        .from("project_members")
        .select("*")
        .eq("project_id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      /* العضوية متوقفة */
      if (permissionData?.is_active === false) {
        alert("تم إيقاف وصولك لهذا المشروع");
        navigate("/");
        return;
      }

      setPermissions(permissionData || null);
    } catch (err) {
      console.log(err);
      setProject(null);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate("/");
  }

  function projectTypeName(type) {
    switch (type) {
      case "marketing_company":
        return "شركة الترويج";

      case "mobile_office":
        return "مكتب الموبايلات";

      case "product_store":
        return "مخزن المنتجات";

      case "my_pages":
        return "بيجاتي";

      case "user_orders":
        return "نظام الطلبات والأرباح";

      default:
        return "مشروع";
    }
  }

  const theme = (project?.type === "my_pages" ? false : darkMode)
    ? {
        page: "bg-[#050816] text-white",
        header: "bg-[#0f172a] border-slate-800",
        nav: "bg-[#020617] border-slate-800",
        textMuted: "text-slate-400",
        textStrong: "text-white",
        sub: "text-blue-400",
        softBtn: "bg-slate-800 hover:bg-slate-700 text-white",
      }
    : {
        page: "bg-[#eef3f8] text-slate-950",
        header: "bg-white border-slate-300 shadow-sm",
        nav: "bg-white border-slate-300 shadow-sm",
        textMuted: "text-slate-500",
        textStrong: "text-slate-950",
        sub: "text-blue-600",
        softBtn: "bg-slate-200 hover:bg-slate-300 text-slate-900",
      };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme.page}`}>
        <div className={`${theme.header} border rounded-2xl px-6 py-5 text-center`}>
          <div className="w-10 h-10 mx-auto rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />

          <h2 className="text-sm font-black mt-3">
            تحميل المشروع
          </h2>

          <p className={`text-[10px] mt-1 ${theme.textMuted}`}>
            جاري تجهيز لوحة التحكم
          </p>
        </div>
      </div>
    );
  }

  if (!project || (!permissions?.can_view && !isAdmin)) {
    return (
      <div
        dir="rtl"
        className={`min-h-screen flex items-center justify-center p-4 ${theme.page}`}
      >
        <div className={`${theme.header} border rounded-2xl p-4 text-center`}>
          <h1 className="text-lg font-black text-red-500 mb-2">
            {!project ? "المشروع غير موجود" : "ليس لديك صلاحية"}
          </h1>

          <button
            onClick={logout}
            className="bg-red-600 hover:bg-red-700 rounded-md px-4 h-8 text-[10px] font-black text-white"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className={`min-h-screen p-1.5 sm:p-2 ${theme.page} ${project.type === "my_pages" ? "pagate-light" : ""}`}>
      <div className="max-w-[1600px] mx-auto space-y-1.5">

        {/* Compact app header */}
        <header className={`${theme.header} border rounded-xl px-2.5 py-2 flex items-center justify-between gap-2 min-h-[52px]`}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 shrink-0 rounded-xl bg-blue-600 text-white flex items-center justify-center text-sm font-black">ب</div>
            <div className="min-w-0">
              <h1 className={`text-[13px] sm:text-sm font-black leading-tight truncate ${theme.textStrong}`}>{project.name}</h1>
              <p className={`text-[10px] leading-4 truncate ${theme.textMuted}`}>{profile?.full_name || profile?.email || projectTypeName(project.type)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {project.type !== "my_pages" && <button type="button" onClick={() => setDarkMode(v=>!v)} title={darkMode ? "الوضع الفاتح" : "الوضع الليلي"} aria-label="تغيير المظهر" className={`${theme.softBtn} h-8 w-8 rounded-lg text-base flex items-center justify-center`}>{darkMode ? "☀" : "☾"}</button>}
            <button type="button" onClick={loadProjectAndPermissions} title="تحديث" aria-label="تحديث" className={`${theme.softBtn} h-8 w-8 rounded-lg text-base flex items-center justify-center`}>↻</button>
            {isAdmin && <button type="button" onClick={() => navigate("/projects")} title="المشاريع" aria-label="المشاريع" className="h-8 w-8 rounded-lg bg-blue-600 text-white text-base flex items-center justify-center">▦</button>}
            <button type="button" onClick={logout} title="تسجيل الخروج" aria-label="تسجيل الخروج" className="h-8 w-8 rounded-lg bg-rose-700 text-white text-sm flex items-center justify-center">⏻</button>
          </div>
        </header>

        {/* PROJECT CONTENT */}
        <div className={`${theme.nav} border rounded-xl p-1 sm:p-1.5`}>

          {project.type === "marketing_company" && (
            <MarketingCompanyDashboard
              project={project}
              permissions={permissions}
              isAdmin={isAdmin}
            />
          )}

          {project.type === "mobile_office" && (
            <MobileOfficeDashboard
              project={project}
              permissions={permissions}
              isAdmin={isAdmin}
            />
          )}

          {project.type === "product_store" && (
            <StoreDashboard
              project={project}
              permissions={permissions}
              isAdmin={isAdmin}
            />
          )}

          {project.type === "my_pages" && (
            <MyPagesDashboard
              project={project}
              permissions={permissions}
              isAdmin={isAdmin}
            />
          )}

          {/* USER ORDERS */}
          {project.type === "user_orders" && (
            <UserOrdersDashboard
              project={project}
              permissions={permissions}
              isAdmin={isAdmin}
            />
          )}
        </div>
      </div>
    </div>
  );
}