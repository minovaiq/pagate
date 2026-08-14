import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { notifyTelegramOperation } from "../../services/supabase/telegram";

const formatNumberInput=v=>String(v??"").replace(/\D/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,",");
const parseNumberInput=v=>String(v??"").replace(/,/g,"").replace(/\D/g,"");
export default function ServiceTransactions({
  project,
  canAdd = true,
  canEdit = true,
  canDelete = true,
}) {
  const [transactions, setTransactions] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [pageName, setPageName] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);

  const [serviceType, setServiceType] = useState("programming");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");

  const [editingClient, setEditingClient] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPage, setEditPage] = useState("");

  useEffect(() => {
    loadClients();
    loadTransactions();
  }, []);

  async function loadClients() {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false });

    setClients(data || []);
  }

  async function loadTransactions() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("transactions")
        .select(`*, clients(full_name, phone, page_name)`)
        .eq("project_id", project.id)
        .eq("type", "income")
        .neq("service_type", "promotion")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function normalizePhone(value) {
    return String(value || "").replace(/\s+/g, "").trim();
  }

  function handleClientNameChange(value) {
    setClientName(value);
    setSelectedClient(null);

    const foundClient = clients.find(
      (client) => normalizeText(client.full_name) === normalizeText(value)
    );

    if (foundClient) chooseClient(foundClient);
  }

  function chooseClient(client) {
    setSelectedClient(client);
    setClientName(client.full_name || "");
    setClientPhone(client.phone || "");
    setPageName(client.page_name || "");
  }

  async function getOrCreateClient(userId) {
    const cleanName = clientName.trim();
    const cleanPhone = normalizePhone(clientPhone);
    const cleanPage = pageName.trim();

    if (!cleanName) throw new Error("اكتب اسم الزبون");
    if (selectedClient) return selectedClient;

    const existingClient = clients.find((client) => {
      const sameName =
        normalizeText(client.full_name) === normalizeText(cleanName);
      const samePhone =
        cleanPhone && normalizePhone(client.phone) === cleanPhone;

      return sameName || samePhone;
    });

    if (existingClient) return existingClient;

    const { data, error } = await supabase
      .from("clients")
      .insert([
        {
          project_id: project.id,
          user_id: userId,
          full_name: cleanName,
          phone: cleanPhone || null,
          page_name: cleanPage || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    setClients((prev) => [data, ...prev]);

    await notifyTelegramOperation({
      projectId: project.id,
      tableName: "clients",
      action: "create",
      title: "إضافة زبون خدمات",
      description: `${cleanName} - ${cleanPage || "-"}`,
      amount: 0,
    });

    return data;
  }

  async function handleAddService(e) {
    e.preventDefault();

    if (!canAdd) {
      alert("ليس لديك صلاحية الإضافة");
      return;
    }

    if (submitting) return;

    if (!amount || Number(amount) <= 0) {
      alert("اكتب مبلغ صحيح");
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const client = await getOrCreateClient(user.id);
      const receivedAmount = Number(amount);
      const serviceTitle = title.trim() || "خدمة";

      const { error } = await supabase.from("transactions").insert([
        {
          project_id: project.id,
          user_id: user.id,
          client_id: client.id,
          type: "income",
          service_type: serviceType,
          title: serviceTitle,
          amount_received: receivedAmount,
          client_name: client.full_name,
          client_phone: client.phone || normalizePhone(clientPhone) || null,
          client_page_name: client.page_name || pageName.trim() || null,
        },
      ]);

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "transactions",
        action: "create",
        title: "إضافة خدمة",
        description: `${client.full_name} - ${serviceName(serviceType)} - ${serviceTitle}`,
        amount: receivedAmount,
      });

      setClientName("");
      setClientPhone("");
      setPageName("");
      setSelectedClient(null);
      setServiceType("programming");
      setTitle("");
      setAmount("");

      await loadClients();
      await loadTransactions();
    } catch (err) {
      alert(err.message || "فشل إضافة الخدمة");
    } finally {
      setSubmitting(false);
    }
  }

  function startEditClient(client) {
    if (!canEdit) return;

    setEditingClient(client);
    setEditName(client.clientName || "");
    setEditPhone(client.phone === "-" ? "" : client.phone || "");
    setEditPage(client.pageName === "-" ? "" : client.pageName || "");
  }

  async function saveClientEdit() {
    if (!canEdit) {
      alert("ليس لديك صلاحية التعديل");
      return;
    }

    if (!editingClient?.clientId) return;

    const cleanName = editName.trim();

    if (!cleanName) {
      alert("اسم الزبون مطلوب");
      return;
    }

    const oldName = editingClient.clientName;

    const { error } = await supabase
      .from("clients")
      .update({
        full_name: cleanName,
        phone: normalizePhone(editPhone) || null,
        page_name: editPage.trim() || null,
      })
      .eq("id", editingClient.clientId);

    if (error) {
      alert(error.message);
      return;
    }

    await supabase
      .from("transactions")
      .update({
        client_name: cleanName,
        client_phone: normalizePhone(editPhone) || null,
        client_page_name: editPage.trim() || null,
      })
      .eq("client_id", editingClient.clientId);

    await notifyTelegramOperation({
      projectId: project.id,
      tableName: "clients",
      action: "update",
      title: "تعديل زبون خدمات",
      description: `${oldName} ← ${cleanName}`,
      amount: 0,
    });

    setEditingClient(null);
    await loadClients();
    await loadTransactions();
  }

  async function deleteClient(client) {
    if (!canDelete) {
      alert("ليس لديك صلاحية الحذف");
      return;
    }

    if (!client?.clientId) return;

    const ok = confirm(
      `هل تريد حذف الزبون "${client.clientName}"؟ سيتم حذف كل معاملات الخدمات التابعة له.`
    );

    if (!ok) return;

    const deletedAmount = Number(client.totalReceived || 0);

    const { error: transactionsError } = await supabase
      .from("transactions")
      .delete()
      .eq("project_id", project.id)
      .eq("client_id", client.clientId)
      .neq("service_type", "promotion");

    if (transactionsError) {
      alert(transactionsError.message);
      return;
    }

    const stillHasTransactions = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.clientId);

    if ((stillHasTransactions.count || 0) === 0) {
      const { error: clientError } = await supabase
        .from("clients")
        .delete()
        .eq("id", client.clientId);

      if (clientError) {
        alert(clientError.message);
        return;
      }
    }

    await notifyTelegramOperation({
      projectId: project.id,
      tableName: "transactions",
      action: "delete",
      title: "حذف زبون خدمات",
      description: `${client.clientName} - عدد الخدمات: ${client.count}`,
      amount: deletedAmount,
    });

    await loadClients();
    await loadTransactions();
  }

  function serviceName(service) {
    switch (service) {
      case "programming":
        return "برمجة";
      case "design":
        return "تصميم";
      case "video_editing":
        return "مونتاج";
      case "consulting":
        return "استشارة";
      default:
        return "أخرى";
    }
  }

  const suggestions =
    clientName.trim().length > 0
      ? clients
          .filter((client) =>
            normalizeText(client.full_name).includes(normalizeText(clientName))
          )
          .slice(0, 5)
      : [];

  const groupedClients = Object.values(
    transactions.reduce((acc, item) => {
      const key = item.client_id || item.client_name || item.id;

      if (!acc[key]) {
        acc[key] = {
          clientId: item.client_id,
          clientName: item.clients?.full_name || item.client_name || "-",
          phone: item.clients?.phone || item.client_phone || "-",
          pageName: item.clients?.page_name || item.client_page_name || "-",
          count: 0,
          totalReceived: 0,
          totalProfit: 0,
          firstDate: item.created_at,
          lastDate: item.created_at,
          services: {},
        };
      }

      acc[key].count += 1;
      acc[key].totalReceived += Number(item.amount_received || 0);
      acc[key].totalProfit += Number(item.company_profit || 0);

      const serviceLabel = serviceName(item.service_type);
      acc[key].services[serviceLabel] =
        (acc[key].services[serviceLabel] || 0) + 1;

      if (new Date(item.created_at) < new Date(acc[key].firstDate)) {
        acc[key].firstDate = item.created_at;
      }

      if (new Date(item.created_at) > new Date(acc[key].lastDate)) {
        acc[key].lastDate = item.created_at;
      }

      return acc;
    }, {})
  );

  const totalIncome = transactions.reduce(
    (sum, item) => sum + Number(item.amount_received || 0),
    0
  );

  const totalProfit = transactions.reduce(
    (sum, item) => sum + Number(item.company_profit || 0),
    0
  );

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-sm font-black">معاملات الخدمات</h1>

          <p className="text-[9px] text-slate-300">
            ملخص كل زبون من أول خدمة إلى الآن
          </p>
        </div>

        <div className="bg-emerald-600 rounded-md px-2 py-1 text-[10px] font-black">
          {groupedClients.length} زبون
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1 mb-2">
        <MiniStat
          title="دخل الخدمات"
          value={totalIncome}
          color="text-green-400"
        />

        <MiniStat
          title="الأرباح"
          value={totalProfit}
          color="text-blue-400"
        />
      </div>

      {canAdd && (
        <form onSubmit={handleAddService} className="space-y-1 mb-2">
          <div className="grid grid-cols-3 gap-1">
            <div className="relative">
              <input
                type="text"
                placeholder="اسم الزبون"
                value={clientName}
                onChange={(e) => handleClientNameChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
              />

              {suggestions.length > 0 && !selectedClient && (
                <div className="absolute z-20 top-10 right-0 left-0 bg-slate-900 border border-slate-700 rounded-md overflow-hidden">
                  {suggestions.map((client) => (
                    <button
                      type="button"
                      key={client.id}
                      onClick={() => chooseClient(client)}
                      className="w-full text-right px-2 py-2 text-[10px] hover:bg-slate-800"
                    >
                      {client.full_name}

                      <span className="text-slate-300 mr-1">
                        {client.page_name || ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <input
              type="text"
              placeholder="هاتف الزبون"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />

            <input
              type="text"
              placeholder="اسم البيج"
              value={pageName}
              onChange={(e) => setPageName(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />
          </div>

          <div className="grid grid-cols-4 gap-1">
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            >
              <option value="programming">برمجة</option>
              <option value="design">تصميم</option>
              <option value="video_editing">مونتاج</option>
              <option value="consulting">استشارة</option>
              <option value="other">أخرى</option>
            </select>

            <input
              type="text"
              placeholder="عنوان الخدمة"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />

            <input
              type="text"
              inputMode="numeric"
              placeholder="المبلغ"
              value={formatNumberInput(amount)}
              onChange={(e)=>setAmount(parseNumberInput(e.target.value))}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />

            <button
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md text-[10px] font-black"
            >
              {submitting ? "جاري..." : "إضافة"}
            </button>
          </div>
        </form>
      )}

      {editingClient && canEdit && (
        <div className="bg-slate-900 border border-emerald-800 rounded-md p-2 mb-2">
          <div className="grid grid-cols-4 gap-1">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="اسم الزبون"
              className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
            />

            <input
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              placeholder="الهاتف"
              className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
            />

            <input
              value={editPage}
              onChange={(e) => setEditPage(e.target.value)}
              placeholder="البيج"
              className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
            />

            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={saveClientEdit}
                className="bg-emerald-600 rounded-md text-[10px] font-black"
              >
                حفظ
              </button>

              <button
                type="button"
                onClick={() => setEditingClient(null)}
                className="bg-slate-700 rounded-md text-[10px] font-black"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-6 text-[10px] text-slate-300">
          جاري التحميل...
        </div>
      ) : groupedClients.length === 0 ? (
        <div className="text-center py-6 text-[10px] text-slate-300">
          لا توجد خدمات
        </div>
      ) : (
        <div className="space-y-1">
          {groupedClients.map((item) => (
            <div
              key={item.clientId || item.clientName}
              className="bg-slate-900 border border-slate-800 rounded-md p-2"
            >
              <div className="flex items-center justify-between mb-1">
                <div>
                  <h2 className="text-[11px] font-black leading-none">
                    {item.clientName}
                  </h2>

                  <p className="text-[9px] text-slate-300 mt-1">
                    {item.pageName}
                  </p>
                </div>

                <div className="text-left">
                  <h2 className="text-xs font-black text-green-400">
                    {item.totalReceived.toLocaleString()}
                  </h2>

                  <p className="text-[8px] text-slate-300">
                    {item.count} خدمة
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1 mb-1">
                <InfoBox
                  title="الربح"
                  value={item.totalProfit.toLocaleString()}
                  color="text-blue-400"
                />

                <InfoBox
                  title="الخدمات"
                  value={Object.keys(item.services).join("، ") || "-"}
                  color="text-emerald-400"
                />

                <InfoBox
                  title="أول خدمة"
                  value={new Date(item.firstDate).toLocaleDateString()}
                />

                <InfoBox
                  title="آخر خدمة"
                  value={new Date(item.lastDate).toLocaleDateString()}
                />
              </div>

              <div className="grid grid-cols-3 gap-1">
                <InfoBox title="الهاتف" value={item.phone} />

                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => startEditClient(item)}
                    className="bg-amber-600 hover:bg-amber-700 rounded-md text-[9px] font-black h-6"
                  >
                    تعديل
                  </button>
                ) : (
                  <div className="bg-slate-800 rounded-md h-6"></div>
                )}

                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => deleteClient(item)}
                    className="bg-red-600 hover:bg-red-700 rounded-md text-[9px] font-black h-6"
                  >
                    حذف
                  </button>
                ) : (
                  <div className="bg-slate-800 rounded-md h-6"></div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniStat({ title, value, color }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-md p-2">
      <p className="text-[8px] text-slate-300 mb-1">{title}</p>

      <h2 className={`text-[10px] font-black ${color}`}>
        {Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}

function InfoBox({ title, value, color = "text-white" }) {
  return (
    <div className="bg-slate-950 rounded-md p-2">
      <p className="text-[8px] text-slate-300 mb-1">{title}</p>

      <h2 className={`text-[10px] font-black truncate ${color}`}>
        {value || "-"}
      </h2>
    </div>
  );
}