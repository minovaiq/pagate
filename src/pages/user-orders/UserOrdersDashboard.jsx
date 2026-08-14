import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase/client";
const VAPID_PUBLIC_KEY = "BLVPuUCGQjnt4qSg_-A4EDOXHRXrPVzF4R437awrwi-37G3g4z8Czo6HYeFPrcnrT4rcJhrqBPUFsTroPFEvyII";
const STATUS_LABELS = {
  pending: "جديد",
  processing: "قيد التجهيز",
  delivered: "واصل",
  returned: "راجع",
  cancelled: "ملغي",
};

export default function UserOrdersDashboard({ project, permissions, isAdmin }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [orders, setOrders] = useState([]);
  const [profitRules, setProfitRules] = useState([]);

  const [linkedDelegate, setLinkedDelegate] = useState(null);
  const [delegateCampaigns, setDelegateCampaigns] = useState([]);
  const [delegateProfits, setDelegateProfits] = useState([]);
  const [delegateSettlements, setDelegateSettlements] = useState([]);

  const [loading, setLoading] = useState(true);
  const [searchPhone, setSearchPhone] = useState("");

  const canAdd = isAdmin || permissions?.can_add === true;
  const canEdit = isAdmin || permissions?.can_edit === true;

  useEffect(() => {
    loadAll();
    loadProfitRules();

    const channel = supabase
      .channel(`user-orders-${project.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "page_orders" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "delegate_profit_payments" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "delegate_profit_settlements" }, () => loadAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "page_campaigns" }, () => loadAll())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [project.id]);

  async function loadAll() {
    await loadOrdersAndDelegate();
  }

  async function loadOrdersAndDelegate() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      let query = supabase
        .from("page_orders")
        .select(`
          *,
          delegate:delegates!page_orders_delegate_id_fkey (
            id,
            name,
            full_name,
            linked_user_id
          )
        `)
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      if (!isAdmin) query = query.eq("user_id", user.id);

      const { data: ordersData, error: ordersError } = await query;
      if (ordersError) throw ordersError;

      setOrders(
        (ordersData || []).map((order) => {
          const delegate = Array.isArray(order.delegate)
            ? order.delegate[0]
            : order.delegate;

          return {
            ...order,
            delegate_display_name:
              delegate?.full_name ||
              delegate?.name ||
              order.delegate_name ||
              "-",
          };
        })
      );

      if (!user) return;

      const { data: delegateData } = await supabase
        .from("delegates")
        .select("*")
        .eq("linked_user_id", user.id)
        .maybeSingle();

      setLinkedDelegate(delegateData || null);

      if (!delegateData) {
        setDelegateCampaigns([]);
        setDelegateProfits([]);
        setDelegateSettlements([]);
        return;
      }

      const { data: campaignsData } = await supabase
        .from("page_campaigns")
        .select("*")
        .eq("delegate_id", delegateData.id)
        .order("created_at", { ascending: false });

      const { data: profitsData } = await supabase
        .from("delegate_profit_payments")
        .select("*")
        .eq("delegate_id", delegateData.id)
        .order("created_at", { ascending: false });

      const { data: settlementsData } = await supabase
        .from("delegate_profit_settlements")
        .select("*")
        .eq("delegate_id", delegateData.id)
        .order("created_at", { ascending: false });

      setDelegateCampaigns(campaignsData || []);
      setDelegateProfits(profitsData || []);
      setDelegateSettlements(settlementsData || []);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }

  async function loadProfitRules() {
    const { data, error } = await supabase
      .from("order_profit_rules")
      .select("*")
      .eq("project_id", project.id)
      .order("min_price", { ascending: true });

    if (!error) setProfitRules(data || []);
  }
async function enablePushNotifications() {
  try {
    if (!("serviceWorker" in navigator)) {
      alert("المتصفح لا يدعم Service Worker");
      return;
    }

    if (!("PushManager" in window)) {
      alert("المتصفح لا يدعم Push Notifications");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      alert("تم رفض الإشعارات");
      return;
    }

    const registration = await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey:
        urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert({
        user_id: user.id,
        subscription,
      });

    if (error) throw error;

    alert("تم تفعيل إشعارات الطلبات");
  } catch (err) {
    console.log(err);
    alert(err.message || "فشل تفعيل الإشعارات");
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding =
    "=".repeat((4 - (base64String.length % 4)) % 4);

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
  async function updateStatus(orderId, status) {
    try {
      const { error } = await supabase
        .from("page_orders")
        .update({ status })
        .eq("id", orderId);

      if (error) throw error;
      await loadAll();
    } catch (err) {
      alert(err.message || "فشل تحديث حالة الطلب");
    }
  }

  async function deleteOrder(orderId) {
    if (!isAdmin) return;

    if (!confirm("هل تريد حذف الطلب؟")) return;

    try {
      const { error } = await supabase.from("page_orders").delete().eq("id", orderId);
      if (error) throw error;

      await loadAll();
      alert("تم حذف الطلب");
    } catch (err) {
      alert(err.message || "فشل حذف الطلب");
    }
  }

  function normalizePhone(value) {
    return String(value || "").replace(/\D/g, "");
  }

  const searchedOrders = useMemo(() => {
    if (!searchPhone.trim()) return orders;
    const search = normalizePhone(searchPhone);
    return orders.filter((item) => normalizePhone(item.phone).includes(search));
  }, [orders, searchPhone]);

  const walletStats = useMemo(() => {
    const deliveredOrders = orders.filter((o) => o.status === "delivered");

    const orderProfit = deliveredOrders.reduce(
      (sum, item) => sum + Number(item.profit_amount || 0),
      0
    );

    const delegateCampaignProfit = delegateCampaigns.reduce(
      (sum, item) => sum + Number(item.delegate_profit || 0),
      0
    );

    const manualDelegateProfit = delegateProfits.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const paid = delegateSettlements.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const totalProfit = delegateCampaignProfit + manualDelegateProfit;

    return {
      orderProfit,
      delegateCampaignProfit,
      manualDelegateProfit,
      paid,
      totalProfit,
      remaining: totalProfit - paid,
      deliveredOrders: deliveredOrders.length,
      campaignsCount: delegateCampaigns.length,
    };
  }, [orders, delegateCampaigns, delegateProfits, delegateSettlements]);

  const stats = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "delivered");
    const returned = orders.filter((o) => o.status === "returned");

    return {
      totalOrders: orders.length,
      delivered: delivered.length,
      returned: returned.length,
      totalSales: delivered.reduce((s, o) => s + Number(o.order_price || 0), 0),
      totalProfit: delivered.reduce((s, o) => s + Number(o.profit_amount || 0), 0),
    };
  }, [orders]);

  return (
    <div className="space-y-2" dir="rtl">
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-1 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          <TabButton label="الرئيسية" active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} color="bg-blue-600" />
          <TabButton label="طلباتي" active={activeTab === "orders"} onClick={() => setActiveTab("orders")} color="bg-green-600" />
          <TabButton label="أرباحي" active={activeTab === "profits"} onClick={() => setActiveTab("profits")} color="bg-emerald-600" />
          <TabButton label="محفظتي" active={activeTab === "wallet"} onClick={() => setActiveTab("wallet")} color="bg-cyan-600" />

          {canAdd && (
            <TabButton label="الإدخال" active={activeTab === "add"} onClick={() => setActiveTab("add")} color="bg-purple-600" />
          )}

          {isAdmin && (
            <TabButton label="إعدادات الأرباح" active={activeTab === "profit-rules"} onClick={() => setActiveTab("profit-rules")} color="bg-orange-600" />
          )}

          <input
            type="text"
            placeholder="بحث برقم الهاتف..."
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-md px-3 h-8 text-[10px] text-white outline-none min-w-[180px]"
          />

          {searchPhone && (
            <button onClick={() => setSearchPhone("")} className="bg-red-600 px-3 h-8 rounded-md text-[10px] font-black text-white">
              مسح
            </button>
          )}

          <button onClick={loadAll} className="bg-slate-800 px-3 h-8 rounded-md text-[10px] font-black">
            تحديث
          </button>
<button
  onClick={enablePushNotifications}
  className="bg-teal-600 hover:bg-teal-700 px-3 h-8 rounded-md text-[10px] font-black text-white whitespace-nowrap"
>
  تفعيل الإشعارات
</button>
        </div>
      </div>

      {activeTab === "dashboard" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
            <StatCard title="كل الطلبات" value={stats.totalOrders} color="text-blue-400" />
            <StatCard title="واصل" value={stats.delivered} color="text-green-400" />
            <StatCard title="راجع" value={stats.returned} color="text-red-400" />
            <StatCard title="الأرباح" value={walletStats.totalProfit} color="text-emerald-400" suffix=" د.ع" />
          </div>

          <OrdersTable
            orders={searchedOrders.slice(0, 8)}
            loading={loading}
            canEdit={canEdit}
            onStatusChange={updateStatus}
            isAdmin={isAdmin}
            onDelete={deleteOrder}
          />
        </>
      )}

      {activeTab === "orders" && (
        <OrdersTable
          orders={searchedOrders}
          loading={loading}
          canEdit={canEdit}
          onStatusChange={updateStatus}
          isAdmin={isAdmin}
          onDelete={deleteOrder}
        />
      )}

      {activeTab === "profits" && (
        <ProfitsSection stats={stats} orders={searchedOrders} />
      )}

      {activeTab === "wallet" && (
        <WalletSection
          linkedDelegate={linkedDelegate}
          walletStats={walletStats}
          campaigns={delegateCampaigns}
          profits={delegateProfits}
          settlements={delegateSettlements}
          orders={orders}
        />
      )}

      {activeTab === "add" && canAdd && (
        <AddOrderForm project={project} onDone={loadAll} />
      )}

      {activeTab === "profit-rules" && isAdmin && (
        <ProfitRulesSection project={project} rules={profitRules} onReload={loadProfitRules} />
      )}
    </div>
  );
}

function WalletSection({ linkedDelegate, walletStats, campaigns, profits, settlements, orders }) {
  const deliveredOrders = orders.filter((o) => o.status === "delivered");

  return (
    <div className="space-y-2">
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
        <h2 className="text-[13px] font-black text-white">
          محفظتي
        </h2>

        <p className="text-[10px] text-slate-500 mt-1">
          {linkedDelegate
            ? `مندوب بيجاتي: ${linkedDelegate.full_name || linkedDelegate.name}`
            : "لا يوجد مندوب بيجاتي مربوط بهذا الحساب"}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
        <StatCard title="أرباح الطلبات" value={walletStats.orderProfit} color="text-blue-400" suffix=" د.ع" />
        <StatCard title="أرباح بيجاتي" value={walletStats.delegateCampaignProfit + walletStats.manualDelegateProfit} color="text-emerald-400" suffix=" د.ع" />
        <StatCard title="المسدد" value={walletStats.paid} color="text-red-400" suffix=" د.ع" />
        <StatCard title="المتبقي" value={walletStats.remaining} color="text-cyan-400" suffix=" د.ع" />
      </div>

      <SimpleTable
        title="أرباح الطلبات"
        rows={deliveredOrders.map((o) => ({
          id: o.id,
          title: o.customer_name || o.product_name || "طلب",
          amount: o.profit_amount,
          date: o.created_at,
          badge: "طلب",
        }))}
      />

      <SimpleTable
        title="أرباح بيجاتي"
        rows={[
          ...campaigns.map((c) => ({
            id: `c-${c.id}`,
            title: c.page_name || "حملة",
            amount: c.delegate_profit,
            date: c.created_at,
            badge: "حملة",
          })),
          ...profits.map((p) => ({
            id: `p-${p.id}`,
            title: p.notes || "ربح يدوي",
            amount: p.amount,
            date: p.created_at,
            badge: "ربح",
          })),
        ]}
      />

      <SimpleTable
        title="التسديدات"
        rows={settlements.map((s) => ({
          id: s.id,
          title: s.notes || "تسديد أرباح",
          amount: s.amount,
          date: s.created_at,
          badge: "تسديد",
        }))}
        negative
      />
    </div>
  );
}

function SimpleTable({ title, rows, negative = false }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
      <div className="p-2 border-b border-slate-800">
        <h2 className="text-[12px] font-black text-white">{title}</h2>
      </div>

      {rows.length === 0 ? (
        <div className="p-5 text-center text-[10px] text-slate-500">لا توجد بيانات</div>
      ) : (
        <table className="w-full text-[10px]">
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-800 text-slate-200">
                <td className="p-2">
                  <span className="bg-slate-800 rounded-md px-2 py-1 text-[8px]">
                    {row.badge}
                  </span>
                </td>
                <td className="p-2 font-bold">{row.title}</td>
                <td className={`p-2 font-black ${negative ? "text-red-400" : "text-emerald-400"}`}>
                  {Number(row.amount || 0).toLocaleString()} د.ع
                </td>
                <td className="p-2 text-slate-500">
                  {row.date ? new Date(row.date).toLocaleDateString("ar-IQ") : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ProfitRulesSection({ project, rules, onReload }) {
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    min_price: "",
    max_price: "",
    profit_amount: "",
  });

  async function addRule(e) {
    e.preventDefault();

    if (!form.min_price || !form.max_price || !form.profit_amount) {
      alert("املأ كل الحقول");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        project_id: project.id,
        min_price: Number(form.min_price),
        max_price: Number(form.max_price),
        profit_amount: Number(form.profit_amount),
      };

      const { error } = editingId
        ? await supabase
            .from("order_profit_rules")
            .update(payload)
            .eq("id", editingId)
        : await supabase.from("order_profit_rules").insert(payload);

      if (error) throw error;

      setEditingId(null);
      setForm({
        min_price: "",
        max_price: "",
        profit_amount: "",
      });

      await onReload();

      alert(editingId ? "تم تعديل قاعدة الربح" : "تمت إضافة قاعدة الربح");
    } catch (err) {
      alert(err.message || "فشل حفظ قاعدة الربح");
    } finally {
      setSaving(false);
    }
  }

  function startEditRule(rule) {
    setEditingId(rule.id);
    setForm({
      min_price: rule.min_price || "",
      max_price: rule.max_price || "",
      profit_amount: rule.profit_amount || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({
      min_price: "",
      max_price: "",
      profit_amount: "",
    });
  }

  async function deleteRule(id) {
    if (!confirm("حذف قاعدة الربح؟")) return;

    const { error } = await supabase
      .from("order_profit_rules")
      .delete()
      .eq("id", id);

    if (error) return alert(error.message);

    if (editingId === id) cancelEdit();

    await onReload();
  }

  return (
    <div className="space-y-2">
      <form
        onSubmit={addRule}
        className="bg-slate-950 border border-slate-800 rounded-lg p-2 space-y-2"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[13px] font-black text-white">
            إعدادات أرباح الطلبات
          </h2>

          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="bg-slate-800 hover:bg-slate-700 px-3 h-7 rounded-md text-white text-[10px] font-black"
            >
              إلغاء التعديل
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input
            label="من سعر"
            type="number"
            value={form.min_price}
            onChange={(v) => setForm({ ...form, min_price: v })}
          />

          <Input
            label="إلى سعر"
            type="number"
            value={form.max_price}
            onChange={(v) => setForm({ ...form, max_price: v })}
          />

          <Input
            label="ربح المستخدم"
            type="number"
            value={form.profit_amount}
            onChange={(v) => setForm({ ...form, profit_amount: v })}
          />
        </div>

        <button
          disabled={saving}
          className={`w-full h-9 rounded-lg text-white text-[11px] font-black ${
            editingId
              ? "bg-amber-600 hover:bg-amber-700"
              : "bg-orange-600 hover:bg-orange-700"
          }`}
        >
          {saving
            ? "جاري الحفظ..."
            : editingId
            ? "حفظ تعديل قاعدة الربح"
            : "إضافة قاعدة ربح"}
        </button>
      </form>

      <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
        <table className="w-full text-[10px]">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="p-2 text-right">من سعر</th>
              <th className="p-2 text-right">إلى سعر</th>
              <th className="p-2 text-right">الربح</th>
              <th className="p-2 text-right">إجراء</th>
            </tr>
          </thead>

          <tbody>
            {rules.length === 0 ? (
              <tr>
                <td colSpan="4" className="p-5 text-center text-slate-400">
                  لا توجد قواعد أرباح
                </td>
              </tr>
            ) : (
              rules.map((rule) => (
                <tr
                  key={rule.id}
                  className={`border-t border-slate-800 text-slate-200 ${
                    editingId === rule.id ? "bg-amber-500/10" : ""
                  }`}
                >
                  <td className="p-2">
                    {Number(rule.min_price || 0).toLocaleString()} د.ع
                  </td>

                  <td className="p-2">
                    {Number(rule.max_price || 0).toLocaleString()} د.ع
                  </td>

                  <td className="p-2 font-black text-emerald-400">
                    {Number(rule.profit_amount || 0).toLocaleString()} د.ع
                  </td>

                  <td className="p-2">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => startEditRule(rule)}
                        className="bg-amber-600 hover:bg-amber-700 px-3 h-7 rounded-md text-white font-black"
                      >
                        تعديل
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteRule(rule.id)}
                        className="bg-red-600 hover:bg-red-700 px-3 h-7 rounded-md text-white font-black"
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function AddOrderForm({ project, onDone }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    address: "",
    product_name: "",
    order_price: "",
  });

  async function submit(e) {
    e.preventDefault();

    if (!form.customer_name.trim()) return alert("اكتب اسم الزبون");
    if (!form.phone.trim()) return alert("اكتب رقم الهاتف");
    if (!form.product_name.trim()) return alert("اكتب اسم المنتج");

    const finalOrderPrice = Number(form.order_price || 0);

    if (!Number.isFinite(finalOrderPrice) || finalOrderPrice <= 0) {
      return alert("لا يمكن إضافة طلب بسعر صفر. اكتب سعر الطلب بشكل صحيح");
    }

    try {
      setSaving(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from("page_orders").insert({
        project_id: project.id,
        user_id: user.id,
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        product_name: form.product_name.trim(),
        order_price: finalOrderPrice,
        status: "pending",
      });

      if (error) throw error;

      setForm({
        customer_name: "",
        phone: "",
        address: "",
        product_name: "",
        order_price: "",
      });

      onDone();
      alert("تمت إضافة الطلب بنجاح");
    } catch (err) {
      alert(err.message || "فشل إضافة الطلب");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-slate-950 border border-slate-800 rounded-lg p-2 space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Input label="اسم الزبون" value={form.customer_name} onChange={(v) => setForm({ ...form, customer_name: v })} />
        <Input label="الهاتف" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <Input label="العنوان" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
        <Input label="اسم المنتج" value={form.product_name} onChange={(v) => setForm({ ...form, product_name: v })} />
        <Input label="سعر الطلب" type="number" min="1" value={form.order_price} onChange={(v) => setForm({ ...form, order_price: v })} />
      </div>

      <button disabled={saving} className="w-full h-9 rounded-lg bg-blue-600 text-white text-[11px] font-black">
        {saving ? "جاري الحفظ..." : "إضافة الطلب"}
      </button>
    </form>
  );
}

function OrdersTable({
  orders,
  loading,
  canEdit,
  onStatusChange,
  isAdmin,
  onDelete,
}) {
  if (loading) return <EmptyState text="جاري تحميل الطلبات..." />;
  if (!orders.length) return <EmptyState text="لا توجد طلبات حالياً" />;

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead className="bg-slate-900 text-slate-400">
            <tr>
              <th className="p-2 text-right">المندوب</th>
              <th className="p-2 text-right">الزبون</th>
              <th className="p-2 text-right">الهاتف</th>
              <th className="p-2 text-right">المنتج</th>
              <th className="p-2 text-right">السعر</th>
              <th className="p-2 text-right">الحالة</th>
              <th className="p-2 text-right">الربح</th>
              {isAdmin && <th className="p-2 text-right">حذف</th>}
            </tr>
          </thead>

          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-slate-800 text-slate-200">
                <td className="p-2 font-black text-cyan-300 whitespace-nowrap">
                  {order.delegate_display_name || "-"}
                </td>
                <td className="p-2 font-bold">{order.customer_name || "-"}</td>
                <td className="p-2 font-black text-blue-300">{order.phone || "-"}</td>
                <td className="p-2">{order.product_name || "-"}</td>
                <td className="p-2">{Number(order.order_price || 0).toLocaleString()} د.ع</td>

                <td className="p-2">
                  {canEdit ? (
                    <select
                      value={order.status}
                      onChange={(e) => onStatusChange(order.id, e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-md px-2 h-7 text-[10px]"
                    >
                      {Object.entries(STATUS_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  ) : (
                    <StatusBadge status={order.status} />
                  )}
                </td>

                <td className="p-2 font-black text-emerald-400">
                  {Number(order.profit_amount || 0).toLocaleString()} د.ع
                </td>

                {isAdmin && (
                  <td className="p-2">
                    <button
                      onClick={() => onDelete?.(order.id)}
                      className="bg-red-600 hover:bg-red-700 px-3 h-7 rounded-md text-white text-[9px] font-black"
                    >
                      حذف
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProfitsSection({ stats, orders }) {
  const deliveredOrders = orders.filter((o) => o.status === "delivered");

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
        <StatCard title="الطلبات الواصلة" value={stats.delivered} color="text-green-400" />
        <StatCard title="مبيعات واصلة" value={stats.totalSales} color="text-blue-400" suffix=" د.ع" />
        <StatCard title="صافي أرباح الطلبات" value={stats.totalProfit} color="text-emerald-400" suffix=" د.ع" />
      </div>

      <OrdersTable
        orders={deliveredOrders}
        loading={false}
        canEdit={false}
        isAdmin={false}
      />
    </div>
  );
}

function Input({ label, value, onChange, type = "text", min }) {
  return (
    <label className="space-y-1">
      <span className="block text-[10px] text-slate-400 font-bold">{label}</span>
      <input
        type={type}
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 h-9 text-[12px] text-white outline-none"
      />
    </label>
  );
}

function TabButton({ label, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 h-8 rounded-md text-[10px] font-black whitespace-nowrap ${
        active ? `${color} text-white` : "bg-slate-900 text-slate-400"
      }`}
    >
      {label}
    </button>
  );
}

function StatCard({ title, value, color, suffix = "" }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
      <p className="text-[9px] text-slate-500 mb-1">{title}</p>
      <h2 className={`text-[12px] font-black ${color}`}>
        {Number(value || 0).toLocaleString()}
        {suffix}
      </h2>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-6 text-center text-[11px] text-slate-400">
      {text}
    </div>
  );
}

function StatusBadge({ status }) {
  const cls =
    status === "delivered"
      ? "bg-green-500/10 text-green-400 border-green-500/30"
      : status === "returned"
      ? "bg-red-500/10 text-red-400 border-red-500/30"
      : status === "processing"
      ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
      : status === "cancelled"
      ? "bg-slate-500/10 text-slate-400 border-slate-500/30"
      : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";

  return (
    <span className={`inline-flex px-2 py-1 rounded-md border text-[9px] font-black ${cls}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}