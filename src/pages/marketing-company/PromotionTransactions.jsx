import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { getLatestArchive, isAfterArchive } from "./archiveUtils";
import { notifyTelegramOperation } from "../../services/supabase/telegram";
import { createMarketingNotification } from "./notificationService";

const USD_RATE = 1650;

const formatNumberInput=v=>String(v??"").replace(/\D/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,",");
const parseNumberInput=v=>String(v??"").replace(/,/g,"").replace(/\D/g,"");
export default function PromotionTransactions({
  project,
  canAdd = true,
  canEdit = true,
  canDelete = true,
}) {
  const [transactions, setTransactions] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailsClient, setDetailsClient] = useState(null);
const [promotionType, setPromotionType] = useState("commission");
  const [submitting, setSubmitting] = useState(false);

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [pageName, setPageName] = useState("");
  const [usdAmount, setUsdAmount] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);

  const [editingClient, setEditingClient] = useState(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPage, setEditPage] = useState("");

  useEffect(() => {
    loadClients();
    window.dispatchEvent(new CustomEvent("marketing-data-changed"));
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

      const archive = await getLatestArchive(project.id);

      const { data, error } = await supabase
        .from("transactions")
        .select(`*, clients(full_name, phone, page_name)`)
        .eq("project_id", project.id)
        .eq("type", "income")
        .eq("service_type", "promotion")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTransactions(
        (data || []).filter((item) =>
          isAfterArchive(item.created_at, archive?.created_at)
        )
      );
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

  function handleUsdChange(value) {
    const cleanValue = parseNumberInput(value);
    setUsdAmount(cleanValue);

    const usd = Number(cleanValue || 0);
    setAmount(usd > 0 ? String(Math.round(usd * USD_RATE)) : "");
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
      title: "إضافة زبون ترويج",
      description: `${cleanName} - ${cleanPage || "-"}`,
      amount: 0,
    });

    await createMarketingNotification({
      projectId: project.id,
      title: "زبون ترويج جديد",
      message: `${cleanName}${cleanPhone ? ` - ${cleanPhone}` : ""}`,
      type: "client",
      severity: "info",
      dedupeKey: `promotion-client-${data.id}`,
      actionTab: "promotion",
      metadata: { client_id: data.id },
    });

    return data;
  }

  async function handleAddPromotion(e) {
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

let adSpendAmount = 0;
let companyProfit = 0;

if (promotionType === "net") {
  adSpendAmount = receivedAmount;
  companyProfit = 0;
} else {
  adSpendAmount = receivedAmount * 0.8484848485;
  companyProfit = receivedAmount * 0.1515151515;
}

const campaignTitle = `ترويج - ${client.full_name}`;
      const { error } = await supabase.from("transactions").insert([
        {
          project_id: project.id,
          user_id: user.id,
          client_id: client.id,
          type: "income",
          service_type: "promotion",
promotion_type: promotionType,
          title: campaignTitle,
          amount_received: receivedAmount,
          ad_spend_amount: adSpendAmount,
          company_profit: companyProfit,
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
        title: "إضافة معاملة ترويج",
        description: `${client.full_name} - ${campaignTitle} - ربح الشركة: ${companyProfit.toLocaleString("en-US")}`,
        amount: receivedAmount,
      });

      await createMarketingNotification({
        projectId: project.id,
        title: "تم تسجيل مبلغ ترويج",
        message: `${client.full_name}: ${receivedAmount.toLocaleString("en-US")} د.ع، ربح الشركة ${Math.round(companyProfit).toLocaleString("en-US")} د.ع`,
        type: "promotion",
        severity: "success",
        dedupeKey: `promotion-create-${client.id}-${Date.now()}`,
        actionTab: "promotion",
        metadata: { client_id: client.id, amount: receivedAmount },
      });

      setClientName("");
      setClientPhone("");
      setPageName("");
      setSelectedClient(null);
      setUsdAmount("");
      setAmount("");
setPromotionType("commission");

      await loadClients();
      window.dispatchEvent(new CustomEvent("marketing-data-changed"));
      window.dispatchEvent(new CustomEvent("marketing-data-changed"));
      loadTransactions();
    } catch (err) {
      alert(err.message || "فشل إضافة الترويج");
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
      title: "تعديل زبون ترويج",
      description: `${oldName} ← ${cleanName}`,
      amount: 0,
    });

    setEditingClient(null);
    await loadClients();
    window.dispatchEvent(new CustomEvent("marketing-data-changed"));
      window.dispatchEvent(new CustomEvent("marketing-data-changed"));
      loadTransactions();
  }

  async function deleteClient(client) {
    if (!canDelete) {
      alert("ليس لديك صلاحية الحذف");
      return;
    }

    if (!client?.clientId) return;

    const ok = confirm(
      `هل تريد حذف الزبون "${client.clientName}"؟ سيتم حذف كل معاملات الترويج التابعة له.`
    );

    if (!ok) return;

    const deletedAmount = Number(client.totalReceived || 0);

    const { error: transactionsError } = await supabase
      .from("transactions")
      .delete()
      .eq("project_id", project.id)
      .eq("client_id", client.clientId)
      .eq("service_type", "promotion");

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
      title: "حذف زبون ومعاملات ترويج",
      description: `${client.clientName} - عدد المعاملات: ${client.count}`,
      amount: deletedAmount,
    });

    await loadClients();
    window.dispatchEvent(new CustomEvent("marketing-data-changed"));
      window.dispatchEvent(new CustomEvent("marketing-data-changed"));
      loadTransactions();
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
          totalAdSpend: 0,
          totalProfit: 0,
          firstDate: item.created_at,
          lastDate: item.created_at,
        };
      }

      acc[key].count += 1;
      acc[key].totalReceived += Number(item.amount_received || 0);
      acc[key].totalAdSpend += Number(item.ad_spend_amount || 0);
      acc[key].totalProfit += Number(item.company_profit || 0);

      if (new Date(item.created_at) < new Date(acc[key].firstDate)) {
        acc[key].firstDate = item.created_at;
      }

      if (new Date(item.created_at) > new Date(acc[key].lastDate)) {
        acc[key].lastDate = item.created_at;
      }

      return acc;
    }, {})
  );

  const totalReceived = transactions.reduce(
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

  return (
    <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-lg p-2">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-sm font-black">معاملات الترويج</h1>
          <p className="text-[9px] text-slate-700 dark:text-slate-300">
            ملخص كل زبون من أول ترويج إلى الآن
          </p>
        </div>

        <div className="bg-blue-600 rounded-md px-2 py-1 text-[10px] font-black">
          {groupedClients.length} زبون
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 mb-2">
        <MiniStat title="المستلم" value={totalReceived} color="text-green-600 dark:text-green-400" />
        <MiniStat title="الإعلان" value={totalAdSpend} color="text-red-600 dark:text-red-400" />
        <MiniStat title="الربح" value={totalProfit} color="text-blue-600 dark:text-blue-400" />
      </div>

      {canAdd && (
        <form onSubmit={handleAddPromotion} className="space-y-1 mb-2">
          <div className="grid grid-cols-1 gap-1 lg:grid-cols-[1.2fr_1fr_1fr_0.9fr_0.8fr_1fr_auto]">
            <input
              type="text"
              placeholder="اسم الزبون"
              value={clientName}
              onChange={(e) => handleClientNameChange(e.target.value)}
              list="promotion-clients-list"
              className="h-9 min-w-0 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 text-[10px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />

            <input
              type="text"
              placeholder="رقم الهاتف"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              className="h-9 min-w-0 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 text-[10px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />

            <input
              type="text"
              placeholder="اسم الصفحة"
              value={pageName}
              onChange={(e) => setPageName(e.target.value)}
              className="h-9 min-w-0 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 text-[10px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />

            <select
              value={promotionType}
              onChange={(e) => setPromotionType(e.target.value)}
              className="h-9 min-w-0 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 text-[10px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            >
              <option value="commission">ترويج بعمولة</option>
              <option value="net">ترويج صافي</option>
            </select>

            <input
              type="text"
              inputMode="numeric"
              placeholder="المبلغ بالدولار $"
              value={formatNumberInput(usdAmount)}
              onChange={(e) => handleUsdChange(e.target.value)}
              className="h-9 min-w-0 rounded-md border border-blue-800 bg-white dark:bg-slate-900 px-2 text-[10px] text-blue-600 dark:text-blue-400 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />

            <input
              type="text"
              inputMode="numeric"
              placeholder="المبلغ بالدينار"
              value={formatNumberInput(amount)}
              readOnly
              className="h-9 min-w-0 cursor-default rounded-md border border-emerald-800 bg-white dark:bg-slate-950 px-2 text-[10px] text-emerald-600 dark:text-emerald-400 outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />

            <button
              disabled={submitting}
              className="h-9 rounded-md bg-blue-600 px-4 text-[10px] font-black hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "جاري..." : "إضافة"}
            </button>
          </div>

          {usdAmount && Number(usdAmount) > 0 && (
            <p className="text-[8px] text-blue-600 dark:text-blue-400">
              {Number(usdAmount).toLocaleString("en-US")} دولار ×{" "}
              {USD_RATE.toLocaleString("en-US")} ={" "}
              {Number(amount || 0).toLocaleString("en-US")} دينار
            </p>
          )}
        </form>
      )}

      {editingClient && canEdit && (
        <div className="bg-white dark:bg-slate-900 border border-blue-800 rounded-md p-2 mb-2 text-slate-900 dark:text-white">
          <div className="grid grid-cols-4 gap-1">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="اسم الزبون"
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />

            <input
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              placeholder="الهاتف"
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />

            <input
              value={editPage}
              onChange={(e) => setEditPage(e.target.value)}
              placeholder="البيج"
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />

            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={saveClientEdit}
                className="bg-blue-600 rounded-md text-[10px] font-black"
              >
                حفظ
              </button>

              <button
                type="button"
                onClick={() => setEditingClient(null)}
                className="bg-slate-200 dark:bg-slate-700 rounded-md text-[10px] font-black"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-6 text-[10px] text-slate-700 dark:text-slate-300">
          جاري التحميل...
        </div>
      ) : groupedClients.length === 0 ? (
        <div className="text-center py-6 text-[10px] text-slate-700 dark:text-slate-300">
          لا توجد معاملات
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {groupedClients.map((item) => {
            const clientKey = item.clientId || item.clientName;

            return (
              <button
                key={clientKey}
                type="button"
                onClick={() => setDetailsClient(item)}
                className="flex min-h-[64px] w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-right shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[13px] font-black leading-5 text-slate-900 dark:text-white">
                    {item.clientName}
                  </h2>
                  <p dir="ltr" className="mt-0.5 truncate text-right text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {item.phone || "بدون رقم هاتف"}
                  </p>
                </div>

                <span className="shrink-0 text-[15px] font-black text-blue-500">عرض</span>
              </button>
            );
          })}
        </div>
      )}
      {detailsClient && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-white dark:bg-slate-950/70 p-3 backdrop-blur-sm"
          onMouseDown={() => setDetailsClient(null)}
        >
          <div
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label="تفاصيل الزبون"
            onMouseDown={(event) => event.stopPropagation()}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 text-slate-900 dark:text-white"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 text-slate-900 dark:text-white">
              <div className="min-w-0">
                <h2 className="truncate text-base font-black text-slate-900 dark:text-white">
                  {detailsClient.clientName}
                </h2>
                <p dir="ltr" className="mt-0.5 truncate text-right text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {detailsClient.phone || "بدون رقم هاتف"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDetailsClient(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-black text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-200 dark:hover:bg-slate-700"
                aria-label="إغلاق"
              >
                ×
              </button>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <InfoBox title="اسم البيج" value={detailsClient.pageName} />
                <InfoBox title="عدد الترويجات" value={`${detailsClient.count} ترويج`} />
                <InfoBox title="المبلغ المستلم" value={detailsClient.totalReceived.toLocaleString()} color="text-green-500" />
                <InfoBox title="صرف فيسبوك" value={detailsClient.totalAdSpend.toLocaleString()} color="text-red-500" />
                <InfoBox title="ربح الشركة" value={detailsClient.totalProfit.toLocaleString()} color="text-blue-500" />
                <InfoBox title="آخر ترويج" value={new Date(detailsClient.lastDate).toLocaleDateString()} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => {
                      startEditClient(detailsClient);
                      setDetailsClient(null);
                    }}
                    className="h-9 rounded-lg bg-amber-500 text-[11px] font-black text-white hover:bg-amber-600"
                  >
                    تعديل
                  </button>
                ) : <div />}

                {canDelete ? (
                  <button
                    type="button"
                    onClick={async () => {
                      setDetailsClient(null);
                      await deleteClient(detailsClient);
                    }}
                    className="h-9 rounded-lg bg-red-600 text-[11px] font-black text-white hover:bg-red-700"
                  >
                    حذف
                  </button>
                ) : <div />}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ title, value, color }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-2 text-slate-900 dark:text-white">
      <p className="mb-1 text-[8px] font-semibold text-slate-600 dark:text-slate-300">{title}</p>
      <h2 className={`text-[10px] font-black ${color}`}>
        {Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}

function InfoBox({ title, value, color = "text-slate-900 dark:text-white" }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900 text-slate-900 dark:text-white">
      <p className="mb-1 text-[8px] font-semibold text-slate-600 dark:text-slate-300">{title}</p>
      <h2 className={`text-[10px] font-black truncate ${color}`}>
        {value || "-"}
      </h2>

    </div>
  );
}