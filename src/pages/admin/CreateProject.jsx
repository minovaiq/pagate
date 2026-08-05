import { useState } from "react";
import { supabase } from "../../services/supabase/client";

export default function CreateProject() {
  const [name, setName] = useState("");

  const [type, setType] = useState("marketing_company");

  const [loading, setLoading] = useState(false);

  async function handleCreateProject(e) {
    e.preventDefault();

    if (!name.trim()) {
      alert("اكتب اسم المشروع");
      return;
    }

    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("يجب تسجيل الدخول");
        return;
      }

      const { data, error } = await supabase
        .from("projects")
        .insert([
          {
            name: name.trim(),
            type,
            owner_user_id: user.id,
            created_by: user.id,
          },
        ])
        .select()
        .single();

      if (error) {
        alert(error.message);
        return;
      }

      await supabase.from("project_members").insert([
        {
          project_id: data.id,
          user_id: user.id,

          can_view: true,
          can_add: true,
          can_edit: true,
          can_delete: true,

          is_active: true,
        },
      ]);

      alert("تم إنشاء المشروع بنجاح");

      setName("");
      setType("marketing_company");

    } catch (err) {
      console.log(err);

      alert("حدث خطأ أثناء إنشاء المشروع");
    } finally {
      setLoading(false);
    }
  }

  const projectTypes = [
    {
      value: "marketing_company",
      label: "شركة ترويج",
    },

    {
      value: "mobile_office",
      label: "مكتب موبايل",
    },

    {
      value: "product_store",
      label: "مخزن منتجات",
    },

    {
      value: "my_pages",
      label: "بيجاتي",
    },

    {
      value: "user_orders",
      label: "نظام الطلبات والأرباح",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8" dir="rtl">
      <div className="max-w-[550px] mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-5 md:p-8">

        <div className="mb-8">
          <h1 className="text-2xl md:text-4xl font-black">
            إنشاء مشروع
          </h1>

          <p className="text-[11px] text-slate-400 mt-2">
            أنشئ مشروع جديد وحدد نوع النظام الذي تريد استخدامه.
          </p>
        </div>

        <form onSubmit={handleCreateProject} className="space-y-5">

          <div>
            <label className="block mb-2 text-[12px] font-bold text-slate-400">
              اسم المشروع
            </label>

            <input
              type="text"
              placeholder="مثال: نظام مندوبين بغداد"
              className="w-full h-12 px-4 rounded-2xl bg-slate-800 border border-slate-700 outline-none focus:border-blue-500 text-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block mb-2 text-[12px] font-bold text-slate-400">
              نوع المشروع
            </label>

            <select
              className="w-full h-12 px-4 rounded-2xl bg-slate-800 border border-slate-700 outline-none focus:border-blue-500 text-white"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {projectTypes.map((projectType) => (
                <option
                  key={projectType.value}
                  value={projectType.value}
                >
                  {projectType.label}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-3 text-[11px] text-slate-400">
            {type === "marketing_company" &&
              "نظام إدارة شركة ترويج وحملات وإيرادات."}

            {type === "mobile_office" &&
              "نظام إدارة مكتب هواتف ومبيعات وصيانة."}

            {type === "product_store" &&
              "نظام مخزن ومنتجات ومبيعات."}

            {type === "my_pages" &&
              "نظام إدارة البيجات وصفحات الهبوط."}

            {type === "user_orders" &&
              "نظام طلبات وأرباح للمستخدمين والمندوبين مع احتساب أرباح تلقائي."}
          </div>

          <button
            disabled={loading}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all rounded-2xl font-black text-white"
          >
            {loading ? "جاري الإنشاء..." : "إنشاء المشروع"}
          </button>
        </form>
      </div>
    </div>
  );
}