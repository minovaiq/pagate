import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase/client";

export default function ProjectsManagement() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    loadPage();
  }, []);

  async function loadPage() {
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
        .single();

      setProfile(profileData);

      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (projectsError) throw projectsError;

      setProjects(projectsData || []);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل تحميل المشاريع");
    } finally {
      setLoading(false);
    }
  }

  async function deleteProject(projectId) {
    if (!isAdmin) {
      alert("الحذف مخصص للأدمن فقط");
      return;
    }

    const ok = confirm("هل تريد حذف المشروع؟ سيتم حذف بياناته المرتبطة.");
    if (!ok) return;

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", projectId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadPage();
  }

  function projectTypeName(type) {
    switch (type) {
      case "marketing_company":
        return "شركة ترويج";
      case "mobile_office":
        return "مكتب موبايل";
      case "product_store":
        return "مخزن منتجات";
      case "my_pages":
        return "بيجاتي";
      default:
        return type || "-";
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
            <h2 className="text-sm font-black text-white">تحميل المشاريع</h2>
            <p className="text-[10px] text-slate-500 mt-1">
              جاري تجهيز قائمة المشاريع
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-white text-[11px] p-2">
      <div className="max-w-[1400px] mx-auto space-y-2">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-black">المشاريع</h1>
            <p className="text-[9px] text-slate-500 mt-1">
              إدارة وفتح المشاريع المرتبطة بالحساب
            </p>
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => navigate("/dashboard")}
              className="bg-slate-800 hover:bg-slate-700 rounded-md px-2 h-7 text-[9px] font-black"
            >
              الرئيسية
            </button>

            {isAdmin && (
              <button
                onClick={() => navigate("/create-project")}
                className="bg-blue-600 hover:bg-blue-700 rounded-md px-2 h-7 text-[9px] font-black"
              >
                إنشاء
              </button>
            )}
          </div>
        </div>

        {projects.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 text-center text-slate-500 text-[10px]">
            لا توجد مشاريع
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-1">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-slate-900 border border-slate-800 rounded-lg p-2"
              >
                <div className="mb-2">
                  <h2 className="text-[11px] font-black truncate">
                    {project.name}
                  </h2>

                  <p className="text-[8px] text-slate-500 mt-1">
                    {projectTypeName(project.type)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => navigate(`/projects/${project.id}`)}
                    className="bg-blue-600 hover:bg-blue-700 rounded-md h-7 text-[9px] font-black"
                  >
                    فتح
                  </button>

                  {isAdmin ? (
                    <button
                      onClick={() => deleteProject(project.id)}
                      className="bg-red-600 hover:bg-red-700 rounded-md h-7 text-[9px] font-black"
                    >
                      حذف
                    </button>
                  ) : (
                    <div className="bg-slate-800 rounded-md h-7 flex items-center justify-center text-[8px] text-slate-500">
                      مستخدم
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}