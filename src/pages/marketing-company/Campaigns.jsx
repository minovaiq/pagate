import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { notifyTelegramOperation } from "../../services/supabase/telegram";

const formatNumberInput=v=>String(v??"").replace(/\D/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,",");
const parseNumberInput=v=>String(v??"").replace(/,/g,"").replace(/\D/g,"");
export default function Campaigns({
  project,
  canAdd = true,
  canDelete = true,
}) {
  const [campaigns, setCampaigns] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [clientId, setClientId] = useState("");
  const [pageName, setPageName] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadClients();
    loadCampaigns();
  }, []);

  async function loadClients() {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("project_id", project.id);

    setClients(data || []);
  }

  async function loadCampaigns() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("page_campaigns")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCampaign(e) {
    e.preventDefault();

    if (!canAdd) {
      alert("ليس لديك صلاحية الإضافة");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      alert("اكتب مبلغ صحيح");
      return;
    }

    let finalPageName = pageName.trim();
    let clientName = "-";

    if (clientId) {
      const client = clients.find((item) => item.id === clientId);
      finalPageName = client?.page_name || finalPageName;
      clientName = client?.full_name || "-";
    }

    if (!finalPageName) {
      alert("اكتب اسم البيج");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const amountValue = Number(amount);
      const noteValue = notes.trim() || null;

      const { error } = await supabase.from("page_campaigns").insert([
        {
          project_id: project.id,
          user_id: user.id,
          page_name: finalPageName,
          campaign_amount: amountValue,
          notes: noteValue,
        },
      ]);

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "page_campaigns",
        action: "create",
        title: "إضافة حملة",
        description: `${finalPageName} - الزبون: ${clientName} - ${noteValue || "بدون ملاحظات"}`,
        amount: amountValue,
      });

      setClientId("");
      setPageName("");
      setAmount("");
      setNotes("");

      loadCampaigns();
    } catch (err) {
      console.log(err);
      alert("فشل إضافة الحملة");
    }
  }

  async function deleteCampaign(item) {
    if (!canDelete) {
      alert("ليس لديك صلاحية الحذف");
      return;
    }

    const ok = confirm("هل تريد حذف الحملة؟");
    if (!ok) return;

    try {
      const { error } = await supabase
        .from("page_campaigns")
        .delete()
        .eq("id", item.id)
        .eq("project_id", project.id);

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "page_campaigns",
        action: "delete",
        title: "حذف حملة",
        description: `${item.page_name || "-"} - ${item.notes || "بدون ملاحظات"}`,
        amount: Number(item.campaign_amount || 0),
      });

      loadCampaigns();
    } catch (err) {
      console.log(err);
      alert("فشل حذف الحملة");
    }
  }

  const totalCampaigns = campaigns.reduce(
    (sum, item) => sum + Number(item.campaign_amount || 0),
    0
  );

  return (
    <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-lg p-2">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-sm font-black">الحملات</h1>
          <p className="text-[9px] text-slate-700 dark:text-slate-300">إدارة الحملات الترويجية</p>
        </div>

        <div className="bg-blue-600 rounded-md px-2 py-1 text-[10px] font-black">
          {totalCampaigns.toLocaleString()}
        </div>
      </div>

      {canAdd && (
        <form onSubmit={handleAddCampaign} className="grid grid-cols-5 gap-1 mb-2">
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
          >
            <option value="">الزبون</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.full_name}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="اسم البيج"
            value={pageName}
            onChange={(e) => setPageName(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />

          <input
            type="text"
            inputMode="numeric"
            placeholder="المبلغ"
            value={formatNumberInput(amount)}
            onChange={(e)=>setAmount(parseNumberInput(e.target.value))}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />

          <input
            type="text"
            placeholder="ملاحظات"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />

          <button className="bg-blue-600 hover:bg-blue-700 rounded-md text-[10px] font-black">
            إضافة
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-center py-6 text-[10px] text-slate-700 dark:text-slate-300">جاري التحميل...</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-6 text-[10px] text-slate-700 dark:text-slate-300">لا توجد حملات</div>
      ) : (
        <div className="space-y-1">
          {campaigns.map((item) => (
            <div key={item.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-2 text-slate-900 dark:text-white">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-[11px] font-black leading-none">{item.page_name}</h2>
                  <p className="text-[9px] text-slate-700 dark:text-slate-300 mt-1">
                    {item.notes || "بدون ملاحظات"}
                  </p>
                </div>

                <div className="text-left min-w-[80px]">
                  <h2 className="text-xs font-black text-blue-600 dark:text-blue-400">
                    {Number(item.campaign_amount || 0).toLocaleString()}
                  </h2>

                  <p className="text-[8px] text-slate-700 dark:text-slate-300">
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => deleteCampaign(item)}
                      className="mt-1 w-full h-6 bg-red-600 hover:bg-red-700 rounded-md text-[9px] font-black"
                    >
                      حذف
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}