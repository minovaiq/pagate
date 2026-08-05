import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase/client";
import { notifyTelegramOperation } from "../../services/supabase/telegram";

const formatNumberInput=v=>String(v??"").replace(/\D/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,",");
const parseNumberInput=v=>String(v??"").replace(/,/g,"").replace(/\D/g,"");
export default function Clients({
  project,
  canAdd = true,
  canDelete = true,
}) {
  const navigate = useNavigate();

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("marketing-theme");
    if (saved) return saved === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [pageName, setPageName] = useState("");

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("marketing-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  async function loadClients() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل تحميل العملاء");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddClient(e) {
    e.preventDefault();

    if (!canAdd) {
      alert("ليس لديك صلاحية الإضافة");
      return;
    }

    if (!fullName.trim()) {
      alert("اكتب اسم الزبون");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const cleanName = fullName.trim();
      const cleanPhone = phone.trim() || null;
      const cleanPage = pageName.trim() || null;

      const { error } = await supabase.from("clients").insert([
        {
          project_id: project.id,
          user_id: user.id,
          full_name: cleanName,
          phone: cleanPhone,
          page_name: cleanPage,
        },
      ]);

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "clients",
        action: "create",
        title: "إضافة زبون",
        description: `${cleanName} - ${cleanPhone || "-"} - ${cleanPage || "-"}`,
        amount: 0,
      });

      setFullName("");
      setPhone("");
      setPageName("");

      await loadClients();
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل إضافة الزبون");
    }
  }

  async function deleteClient(client) {
    if (!canDelete) {
      alert("ليس لديك صلاحية الحذف");
      return;
    }

    const ok = confirm("حذف الزبون؟");
    if (!ok) return;

    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", client.id)
      .eq("project_id", project.id);

    if (error) {
      alert(error.message);
      return;
    }

    await notifyTelegramOperation({
      projectId: project.id,
      tableName: "clients",
      action: "delete",
      title: "حذف زبون",
      description: `${client.full_name || "-"} - ${client.phone || "-"} - ${client.page_name || "-"}`,
      amount: 0,
    });

    await loadClients();
  }

  return (
    <div className="space-y-2 text-slate-900 dark:text-white">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 shadow-sm text-slate-900 dark:text-white">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-sm font-black">العملاء</h1>
            <p className="text-[9px] text-slate-600 dark:text-slate-300">إدارة زبائن شركة الترويج</p>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDarkMode((value) => !value)}
              className="h-7 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-700 dark:text-slate-100"
            >
              {darkMode ? "نهاري" : "ليلي"}
            </button>
            <div className="bg-blue-600 text-white px-2 py-1 rounded-md text-[10px] font-black">
              {clients.length}
            </div>
          </div>
        </div>

        {canAdd && (
          <form onSubmit={handleAddClient} className="grid grid-cols-4 gap-1">
            <input
              type="text"
              placeholder="اسم الزبون"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-2 h-9 text-[10px] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500"
            />

            <input
              type="text"
              placeholder="رقم الهاتف"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-2 h-9 text-[10px] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500"
            />

            <input
              type="text"
              placeholder="اسم البيج"
              value={pageName}
              onChange={(e) => setPageName(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-2 h-9 text-[10px] text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-blue-500"
            />

            <button className="bg-blue-600 hover:bg-blue-700 rounded-md text-[10px] font-black">
              إضافة
            </button>
          </form>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 shadow-sm text-slate-900 dark:text-white">
        {loading ? (
          <div className="text-center py-6 text-[10px] text-slate-600 dark:text-slate-300">
            جاري التحميل...
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-6 text-[10px] text-slate-600 dark:text-slate-300">
            لا يوجد عملاء
          </div>
        ) : (
          <div className="space-y-1">
            {clients.map((client) => (
              <div
                key={client.id}
                className="bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 flex items-center gap-3 hover:border-blue-500 transition-all shadow-sm cursor-pointer"
              >
                <button
                  onClick={() => navigate(`/clients/${client.id}`)}
                  className="text-right flex-1 min-w-0"
                >
<div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white">{client.full_name?.charAt(0)}</div><div className="flex-1">
                  <h2 className="text-sm font-bold truncate">{client.full_name}</h2>

                  <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5">
                    {client.phone || "بدون رقم هاتف"}
                  </p>
                </div></div></button>

                {canDelete && (
                  <button
                    onClick={() => deleteClient(client)}
                    className="bg-red-600 hover:bg-red-700 rounded-lg w-9 h-9 text-[11px] font-bold shrink-0"
                  >
                    حذف
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}