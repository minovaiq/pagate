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

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [pageName, setPageName] = useState("");

  useEffect(() => {
    loadClients();
  }, []);

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
    <div className="space-y-2">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-sm font-black">العملاء</h1>
            <p className="text-[9px] text-slate-300">إدارة زبائن شركة الترويج</p>
          </div>

          <div className="bg-blue-600 px-2 py-1 rounded-md text-[10px] font-black">
            {clients.length}
          </div>
        </div>

        {canAdd && (
          <form onSubmit={handleAddClient} className="grid grid-cols-4 gap-1">
            <input
              type="text"
              placeholder="اسم الزبون"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />

            <input
              type="text"
              placeholder="رقم الهاتف"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />

            <input
              type="text"
              placeholder="اسم البيج"
              value={pageName}
              onChange={(e) => setPageName(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />

            <button className="bg-blue-600 hover:bg-blue-700 rounded-md text-[10px] font-black">
              إضافة
            </button>
          </form>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
        {loading ? (
          <div className="text-center py-6 text-[10px] text-slate-300">
            جاري التحميل...
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-6 text-[10px] text-slate-300">
            لا يوجد عملاء
          </div>
        ) : (
          <div className="space-y-1">
            {clients.map((client) => (
              <div
                key={client.id}
                className="bg-slate-950 border border-slate-800 rounded-md p-2 flex items-center justify-between"
              >
                <button
                  onClick={() => navigate(`/clients/${client.id}`)}
                  className="text-right flex-1"
                >
                  <h2 className="text-[11px] font-black">{client.full_name}</h2>

                  <p className="text-[8px] text-slate-300">
                    {client.phone || "-"} - {client.page_name || "-"}
                  </p>
                </button>

                {canDelete && (
                  <button
                    onClick={() => deleteClient(client)}
                    className="bg-red-600 hover:bg-red-700 rounded-md px-2 h-7 text-[8px] font-black"
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