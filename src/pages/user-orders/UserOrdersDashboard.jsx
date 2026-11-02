import "../my-pages/pagate-mobile.css";
import { House, ClipboardList, Plus, Wallet, Settings2, Users, BarChart3, Package, RefreshCw } from "lucide-react";
import { Phone, Pencil, Truck, RotateCcw, XCircle, Clock3, PackageCheck, Trash2 } from "lucide-react";
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

export default function UserOrdersDashboard({ project, permissions, isAdmin, initialTab = "dashboard", embedded = false }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showMobileMore, setShowMobileMore] = useState(false);
  const [orders, setOrders] = useState([]);
  const [profitRules, setProfitRules] = useState([]);

  const [linkedDelegate, setLinkedDelegate] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [delegateCampaigns, setDelegateCampaigns] = useState([]);
  const [delegateProfits, setDelegateProfits] = useState([]);
  const [delegateSettlements, setDelegateSettlements] = useState([]);

  const [loading, setLoading] = useState(true);
  const [searchPhone, setSearchPhone] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingOrder, setEditingOrder] = useState(null);
  const [delegateFilter, setDelegateFilter] = useState("all");
  const [supervisorCommissions, setSupervisorCommissions] = useState([]);
  const [supervisorAccessEnabled, setSupervisorAccessEnabled] = useState(false);

  const canAdd = isAdmin || permissions?.can_add === true;
  const canEdit = isAdmin || permissions?.can_edit === true || supervisorAccessEnabled;

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

      setCurrentUserId(user?.id || null);
      if (!user) {
        setOrders([]);
        setLinkedDelegate(null);
        setSupervisorCommissions([]);
        setSupervisorAccessEnabled(false);
        return;
      }

      const { data: access, error: accessError } = await supabase
        .from("project_members")
        .select("can_manage_all_orders")
        .eq("project_id", project.id)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (accessError) throw accessError;
      const canViewAll = isAdmin || access?.can_manage_all_orders === true;
      setSupervisorAccessEnabled(access?.can_manage_all_orders === true);

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
        .order("created_at", { ascending: false });

      if (canViewAll) {
        const projectIds = project.id === "cab64e81-998a-4f79-9e35-05afa9ac9d33"
          ? [project.id, "5d03e858-8e14-4804-b5f9-e6d9c52b9f88"]
          : [project.id];
        query = query.in("project_id", projectIds);
      } else {
        query = query.eq("project_id", project.id).eq("user_id", user.id);
      }

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

      const { data: delegateData, error: delegateError } = await supabase
        .from("delegates")
        .select("*")
        .eq("linked_user_id", user.id)
        .eq("project_id", project.id)
        .maybeSingle();
      if (delegateError) throw delegateError;

      // The delegate system and My Pages share delegate identities and financial records.
      // For an ordinary delegate, resolve the same authenticated user's linked record
      // from My Pages when the user_orders project has no duplicate delegate row.
      let financialDelegate = delegateData || null;
      if (!financialDelegate && project.type === "user_orders") {
        const { data: legacyDelegate, error: legacyError } = await supabase
          .from("delegates")
          .select("*")
          .eq("linked_user_id", user.id)
          .eq("project_id", "cab64e81-998a-4f79-9e35-05afa9ac9d33")
          .maybeSingle();
        if (legacyError) throw legacyError;
        financialDelegate = legacyDelegate || null;
      }

      setLinkedDelegate(financialDelegate);
      if (access?.can_manage_all_orders && financialDelegate?.id) {
        const { data: commissionRows, error: commissionError } = await supabase.from("supervisor_order_commissions").select("id,amount,source_order_id,created_at").eq("supervisor_delegate_id", financialDelegate.id);
        if (commissionError) console.error("Supervisor commissions:", commissionError);
        setSupervisorCommissions(commissionRows || []);
      } else setSupervisorCommissions([]);

      if (!financialDelegate) {
        setDelegateCampaigns([]);
        setDelegateProfits([]);
        setDelegateSettlements([]);
        return;
      }

      const { data: campaignsData } = await supabase
        .from("page_campaigns")
        .select("*")
        .eq("delegate_id", financialDelegate.id)
        .order("created_at", { ascending: false });

      const { data: profitsData } = await supabase
        .from("delegate_profit_payments")
        .select("*")
        .eq("delegate_id", financialDelegate.id)
        .order("created_at", { ascending: false });

      const { data: settlementsData } = await supabase
        .from("delegate_profit_settlements")
        .select("*")
        .eq("delegate_id", financialDelegate.id)
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
      const { data, error } = await supabase
        .from("page_orders")
        .update({ status })
        .eq("id", orderId).select("id");

      if (error) throw error;
      if (!data?.length) throw new Error("لم يتم تغيير الحالة؛ تحقق من صلاحيات الحساب.");
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
    const search = normalizePhone(searchPhone);
    return orders.filter((item) =>
      (!search || normalizePhone(item.phone).includes(search) || String(item.customer_name || "").toLowerCase().includes(searchPhone.trim().toLowerCase())) &&
      (statusFilter === "all" || item.status === statusFilter) &&
      (delegateFilter === "all" || String(item.delegate_id || "") === delegateFilter)
    );
  }, [orders, searchPhone, statusFilter, delegateFilter]);

  const myPersonalOrders = useMemo(() => orders.filter(o => linkedDelegate ? (String(o.delegate_id) === String(linkedDelegate.id) || (!o.delegate_id && o.user_id === linkedDelegate.linked_user_id)) : (currentUserId && o.user_id === currentUserId)), [orders, linkedDelegate, currentUserId]);
  const myDeliveredOrders = useMemo(() => myPersonalOrders.filter(o => o.status === "delivered"), [myPersonalOrders]);
  const supervisorProfit = supervisorCommissions.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const personalOrderProfit = myDeliveredOrders.reduce((sum, row) => sum + Number(row.profit_amount || 0), 0);

  const walletStats = useMemo(() => {
    const deliveredOrders = myDeliveredOrders;

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
  }, [myDeliveredOrders, delegateCampaigns, delegateProfits, delegateSettlements]);

  // Keep the home balance identical to the wallet calculation.
  const homeBalance = useMemo(() => {
    const personal = myPersonalOrders.filter(o => o.status === "delivered").reduce((sum,o) => sum + Number(o.profit_amount || 0), 0);
    const campaigns = delegateCampaigns.reduce((sum,c) => sum + Number(c.delegate_profit || 0), 0);
    const manual = delegateProfits.filter(p => !p.source_order_id).reduce((sum,p) => sum + Number(p.amount || 0), 0);
    const supervision = supervisorAccessEnabled ? supervisorCommissions.reduce((sum,c) => sum + Number(c.amount || 0), 0) : 0;
    const paid = delegateSettlements.reduce((sum,s) => sum + Number(s.amount || 0), 0);
    return { total: personal + campaigns + manual + supervision, paid, remaining: personal + campaigns + manual + supervision - paid };
  }, [myPersonalOrders, delegateCampaigns, delegateProfits, delegateSettlements, supervisorCommissions, supervisorAccessEnabled]);

  const statusCounts = useMemo(() => orders.reduce((a,o) => { a[o.status] = (a[o.status] || 0) + 1; return a; }, {}), [orders]);

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
    <div className="space-y-2 pb-20 md:pb-2" dir="rtl">
      {!embedded && <div className="hidden md:flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-slate-950 p-1">
        <TabButton label="طلبات المندوبين" active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} color="bg-blue-600" />
        <TabButton label="محفظتي" active={activeTab === "wallet"} onClick={() => setActiveTab("wallet")} color="bg-cyan-600" />
        {canAdd && <TabButton label="إضافة طلب" active={activeTab === "add"} onClick={() => setActiveTab("add")} color="bg-purple-600" />}
        {isAdmin && <TabButton label="إعدادات الأرباح" active={activeTab === "profit-rules"} onClick={() => setActiveTab("profit-rules")} color="bg-orange-600" />}
        <button onClick={loadAll} className="mr-auto bg-slate-800 text-white px-3 h-8 rounded-md text-[10px] font-bold">تحديث</button>
      </div>}

      {!embedded && <nav aria-label="التنقل الرئيسي" className="pagate-bottom-nav md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-700 bg-slate-950/95 backdrop-blur-xl px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-around gap-1 max-w-lg mx-auto">
          {[
            ["home",House,"الرئيسية"],
            ["dashboard",ClipboardList,"الطلبات"],
            canAdd && ["add",Plus,"إضافة"],
            ["wallet",Wallet,"المحفظة"],
            ["more",Settings2,"المزيد"],
          ].filter(Boolean).map(([key,Icon,label],index)=><button key={index} type="button"
            onClick={()=>key==="more"?setShowMobileMore(v=>!v):(setActiveTab(key),setShowMobileMore(false))}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-bold ${activeTab===key || (key==="more" && showMobileMore)?"bg-blue-600 text-white":"text-slate-400"}`}>
            <Icon size={20} strokeWidth={2}/><span>{label}</span>
          </button>)}
        </div>
      </nav>}
      {!embedded && showMobileMore && <div className="md:hidden fixed bottom-[76px] inset-x-3 z-40 rounded-2xl border border-slate-700 bg-slate-950 p-3 shadow-xl">
        <button className="w-full rounded-xl bg-slate-900 p-3 text-right text-sm font-bold" onClick={()=>{setShowMobileMore(false);loadAll()}}><RefreshCw size={16} className="inline ml-2"/>تحديث البيانات</button>
        {isAdmin && <button className="w-full rounded-xl bg-slate-900 p-3 mt-2 text-right text-sm font-bold" onClick={()=>{setActiveTab("profit-rules");setShowMobileMore(false)}}><Settings2 size={16} className="inline ml-2"/>إعدادات الأرباح</button>}
      </div>}
      {!embedded && activeTab === "home" && <div className="space-y-3">
        <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 p-5 text-white shadow-lg shadow-blue-600/20 min-h-[190px]">
          <div aria-hidden="true" className="absolute -top-16 -left-12 h-48 w-48 rounded-full border-[24px] border-white/10"/>
          <div aria-hidden="true" className="absolute -bottom-24 right-16 h-44 w-44 rounded-full bg-white/10 blur-xl"/>
          <div className="relative flex items-start justify-between">
            <div><div className="text-xs font-semibold text-blue-100">محفظة المندوبة</div><div className="mt-1 text-sm font-black">الرصيد المتبقي</div></div>
            <Wallet size={26} strokeWidth={1.8} className="text-white/90"/>
          </div>
          <div className="relative mt-4 flex items-baseline gap-2" dir="ltr">
            <span className="text-3xl font-black tracking-tight tabular-nums">{homeBalance.remaining.toLocaleString("en-US")}</span>
            <span className="text-sm font-bold text-blue-100">د.ع</span>
          </div>
          <div className="relative mt-4 flex justify-between border-t border-white/25 pt-3 text-xs">
            <div><span className="block text-blue-100">إجمالي الأرباح</span><strong className="text-sm tabular-nums">{homeBalance.total.toLocaleString("en-US")}</strong></div>
            <div className="text-left"><span className="block text-blue-100">المسدد</span><strong className="text-sm tabular-nums">{homeBalance.paid.toLocaleString("en-US")}</strong></div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            ["إجمالي الطلبات",stats.totalOrders,"text-blue-600"],
            ["الواصل",stats.delivered,"text-emerald-600"],
            ["الراجع",stats.returned,"text-rose-600"],
            ["أرباح الطلبات",myPersonalOrders.filter(o=>o.status==="delivered").reduce((s,o)=>s+Number(o.profit_amount||0),0),"text-blue-600"],
          ].map(([label,value,color])=><div key={label} className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
            <div className="text-xs text-slate-400">{label}</div>
            <div className={`text-lg font-black mt-1 ${color}`}>{Number(value).toLocaleString("en-US")}</div>
          </div>)}
        </div>
        <button type="button" onClick={()=>setActiveTab("dashboard")} className="w-full rounded-xl bg-blue-600 p-3 text-sm font-bold text-white">عرض جميع الطلبات</button>
      </div>}
      {activeTab === "dashboard" && <>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-2 space-y-2">
          <div className="flex gap-1.5 overflow-x-auto whitespace-nowrap pb-1" style={{scrollbarWidth:"none"}}>
          {([["all","الكل"],...Object.entries(STATUS_LABELS).map(([k,v])=>[k,v])]).map(([key,label]) =>
            <button key={key} onClick={() => setStatusFilter(key)}
              className={`shrink-0 h-9 rounded-full px-3 text-[11px] font-bold ${statusFilter === key ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-300"}`}>
              {label} ({key === "all" ? orders.length : statusCounts[key] || 0})
            </button>
          )}
          </div>
          <div className="flex items-center gap-2">
          <select aria-label="فلتر المندوبة" value={delegateFilter} onChange={e => setDelegateFilter(e.target.value)}
            className="h-9 max-w-[190px] rounded-md border border-slate-700 bg-slate-900 px-2 text-[10px] text-white">
            <option value="all">كل المندوبات</option>
            {[...new Map(orders.filter(o => o.delegate_id).map(o => [String(o.delegate_id),o.delegate_display_name])).entries()].map(([id,name]) =>
              <option key={id} value={id}>{name || "مندوبة"}</option>)}
          </select>
          <input type="search" placeholder="بحث بالهاتف أو اسم الزبون..." value={searchPhone} onChange={e => setSearchPhone(e.target.value)}
            className="h-9 min-w-0 basis-full sm:basis-auto flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 text-[10px] text-white outline-none"/>
          </div>
          {(searchPhone || statusFilter !== "all" || delegateFilter !== "all") &&
            <button onClick={() => {setSearchPhone("");setStatusFilter("all");setDelegateFilter("all");}}
              className="h-8 rounded-md bg-slate-800 px-2 text-[10px] text-white">مسح الفلاتر</button>}
          <span className="text-[10px] text-slate-400">المعروض: {searchedOrders.length}</span>
        </div>
      </>}

      {activeTab === "dashboard" && (
        <OrdersTable orders={searchedOrders} loading={loading} canEdit={canEdit}
          onStatusChange={updateStatus} isAdmin={isAdmin} onDelete={deleteOrder} onEdit={setEditingOrder}/>
      )}

      {activeTab === "wallet" && (
        <WalletSection
          linkedDelegate={linkedDelegate}
          walletStats={walletStats}
          campaigns={delegateCampaigns}
          profits={delegateProfits}
          settlements={delegateSettlements}
          orders={myPersonalOrders}
          supervisorProfit={supervisorProfit}
          supervisorCommissions={supervisorCommissions}
          isSupervisor={supervisorAccessEnabled}
        />
      )}

      {activeTab === "add" && canAdd && (
        <AddOrderForm project={project} onDone={loadAll} />
      )}

      {editingOrder && <EditOrderDialog order={editingOrder} onClose={() => setEditingOrder(null)} onSaved={() => { setEditingOrder(null); loadAll(); }} />}

      {activeTab === "profit-rules" && isAdmin && (
        <ProfitRulesSection project={project} rules={profitRules} onReload={loadProfitRules} />
      )}
    </div>
  );
}

function WalletSection({ linkedDelegate, walletStats, campaigns, profits, settlements, orders, supervisorProfit = 0, supervisorCommissions = [], isSupervisor = false }) {
  const delivered = orders.filter(o => o.status === "delivered");
  const personalProfit = delivered.reduce((s,o) => s + Number(o.profit_amount || 0),0);
  const campaignProfit = campaigns.reduce((s,c) => s + Number(c.delegate_profit || 0),0);
  // Order-linked profit payments are already included in personalProfit.
  const manualProfit = profits.filter(p => !p.source_order_id).reduce((s,p) => s + Number(p.amount || 0),0);
  // Historical manual entries are supervision earnings, not a separate wallet category.
  // Preserve any campaign earnings in the supervision total so historical balances remain intact.
  const supervisionTotal = supervisorProfit + manualProfit + campaignProfit;
  const otherProfit = manualProfit + campaignProfit;
  const total = personalProfit + (isSupervisor ? supervisionTotal : otherProfit);
  const paid = settlements.reduce((s,p) => s + Number(p.amount || 0),0);
  const remaining = total - paid;
  return <div className="space-y-2">
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs font-bold text-white">
      محفظتي — {linkedDelegate?.full_name || linkedDelegate?.name || "حسابي"}
    </div>
    <div className={`wallet-summary grid grid-cols-2 gap-2 sm:grid-cols-3 ${isSupervisor ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
      <StatCard title="أرباح الطلبات" value={personalProfit} color="text-emerald-400" suffix=" د.ع"/>
      {isSupervisor ? <StatCard title="أرباح الإشراف" value={supervisionTotal} color="text-cyan-400" suffix=" د.ع"/> : (otherProfit !== 0 && <StatCard title="أرباح إضافية" value={otherProfit} color="text-cyan-400" suffix=" د.ع"/>)}
      <StatCard title="المجموع" value={total} color="text-green-400" suffix=" د.ع"/>
      <StatCard title="المسدد" value={paid} color="text-slate-300" suffix=" د.ع"/>
      <StatCard title="المتبقي" value={remaining} color="text-blue-400" suffix=" د.ع"/>
    </div>
    <OrdersTable orders={orders} loading={false} canEdit={false} isAdmin={false}/>
    {isSupervisor && <SimpleTable title="عمولات الإشراف الجديدة" rows={supervisorCommissions.map(c => ({
      id:c.id,title:"عمولة إشراف على طلب واصل",amount:c.amount,date:c.created_at,badge:"إشراف"
    }))}/>}
    <SimpleTable title={isSupervisor ? "سجل أرباح الإشراف اليدوية وأرباح الحملات" : "الأرباح الإضافية والحملات" } rows={[
      ...campaigns.map(c=>({id:`c-${c.id}`,title:c.page_name || "حملة",amount:c.delegate_profit,date:c.created_at,badge:"حملة"})),
      ...profits.filter(p=>!p.source_order_id).map(p=>({id:`p-${p.id}`,title:p.notes || "ربح يدوي",amount:p.amount,date:p.created_at,badge:isSupervisor ? "إشراف يدوي" : "ربح إضافي"}))
    ]}/>
    <SimpleTable title="التسديدات" rows={settlements.map(s=>({
      id:s.id,title:s.notes || "تسديد",amount:s.amount,date:s.created_at,badge:"تسديد"
    }))} negative/>
  </div>;
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
              <th className="p-2 text-right">التاريخ</th>
              {canEdit && <th className="p-2 text-right">إجراء</th>}
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
  onEdit,
}) {
  if (loading) return <EmptyState text="جاري تحميل الطلبات..." />;
  if (!orders.length) return <EmptyState text="لا توجد طلبات حالياً" />;

  const statusColors = {delivered:"bg-emerald-500/15 text-emerald-700",returned:"bg-rose-500/15 text-rose-700",cancelled:"bg-slate-200 text-slate-600",pending:"bg-blue-500/15 text-blue-700",processing:"bg-amber-500/15 text-amber-700"};
  const statusIcons = {delivered:Truck,returned:RotateCcw,cancelled:XCircle,pending:PackageCheck,processing:Clock3};
  return (
    <>
      <div className="md:hidden space-y-2">
        {orders.map((order,index) => <article key={order.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2"><span className="font-black text-sm text-white truncate">{order.customer_name || "زبون"}</span><span className="text-[10px] text-slate-400">#{orders.length-index}</span></div>
              <div className="text-[11px] text-slate-500 truncate">المندوبة: <span className="text-blue-300 font-bold">{order.delegate_display_name || "-"}</span></div>
              <a href={order.phone ? `tel:${order.phone}` : undefined} className="block text-[12px] font-bold text-blue-300" dir="ltr">{order.phone || "بدون رقم"}</a>
            </div>
            <div className={`min-w-[76px] rounded-xl px-2 py-3 text-center font-black text-[12px] ${statusColors[order.status] || "bg-slate-800 text-white"}`}>
              <div className="flex justify-center mb-1" aria-hidden="true">{(() => { const Icon = statusIcons[order.status] || PackageCheck; return <Icon size={20} strokeWidth={2} />; })()}</div>
              {STATUS_LABELS[order.status] || order.status}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-800 pt-2 text-xs">
            <div className="min-w-0"><div className="text-[10px] text-slate-500">المنتج</div><div className="font-bold text-white break-words">{order.product_name || "-"}</div></div>
            <div className="text-left"><div className="text-[10px] text-slate-500">السعر</div><div className="font-black text-blue-300">{Number(order.order_price || 0).toLocaleString()} د.ع</div></div>
            <div><div className="text-[10px] text-slate-500">الربح</div><div className="font-black text-emerald-400">{Number(order.profit_amount || 0).toLocaleString()} د.ع</div></div>
            <div className="text-left"><div className="text-[10px] text-slate-500">التاريخ</div><div className="text-slate-400">{order.created_at ? new Date(order.created_at).toLocaleDateString("en-GB") : "-"}</div></div>
          </div>
          <div className="flex gap-2 mt-2 items-center">
            {order.phone && <a href={`tel:${order.phone}`} aria-label="اتصال" className="h-9 w-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold"><Phone size={17} strokeWidth={2}/></a>}
            {canEdit && <button type="button" onClick={()=>onEdit?.(order)} className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white inline-flex items-center gap-1.5"><Pencil size={15} strokeWidth={2}/> تعديل</button>}
            {canEdit && <select aria-label="تغيير الحالة" value={order.status} onChange={e=>onStatusChange?.(order.id,e.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs text-white">{Object.entries(STATUS_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>}
            {isAdmin && <button type="button" onClick={()=>onDelete?.(order.id)} className="h-9 rounded-lg bg-rose-700 px-3 text-xs font-bold text-white inline-flex items-center gap-1"><Trash2 size={15}/> حذف</button>}
          </div>
        </article>)}
      </div>
      <div className="hidden md:block bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
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
              <th className="p-2 text-right">التاريخ</th>
              {canEdit && <th className="p-2 text-right">إجراء</th>}
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
                      className="bg-slate-900 text-white border border-slate-700 rounded-md px-2 h-7 text-[10px]"
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

                <td className="p-2 text-slate-400 whitespace-nowrap">{order.created_at ? new Date(order.created_at).toLocaleDateString("ar-IQ") : "-"}</td>
                {canEdit && <td className="p-2"><button onClick={() => onEdit?.(order)} className="bg-amber-600 text-white rounded-md px-2 h-7 font-bold">تعديل</button></td>}
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
    </>
  );
}

function EditOrderDialog({ order, onClose, onSaved }) {
  const [form, setForm] = useState({
    customer_name: order.customer_name || "",
    phone: order.phone || "",
    address: order.address || "",
    product_name: order.product_name || "",
    order_price: order.order_price ?? 0,
  });
  const [saving, setSaving] = useState(false);
  async function save(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.from("page_orders").update({
        ...form, order_price: Number(form.order_price),
      }).eq("id", order.id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("لم يتم حفظ الطلب؛ تحقق من صلاحية التعديل.");
      onSaved();
    } catch (err) {
      alert(err.message || "تعذر تعديل الطلب");
    } finally { setSaving(false); }
  }
  return <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-3" dir="rtl">
    <form onSubmit={save} className="bg-slate-950 border border-slate-700 rounded-xl p-3 w-full max-w-lg space-y-2">
      <div className="flex justify-between items-center"><h3 className="font-bold text-white text-sm">تعديل الطلب</h3><button type="button" onClick={onClose} className="text-slate-300">إغلاق</button></div>
      {Object.entries({ customer_name:"الزبون",phone:"الهاتف",address:"العنوان",product_name:"المنتج",order_price:"السعر" }).map(([key,label]) =>
        <label key={key} className="block text-xs text-slate-300">{label}<input required={key !== "address"} type={key === "order_price" ? "number" : "text"} min={key === "order_price" ? 0 : undefined} value={form[key]} onChange={e => setForm(f => ({...f,[key]:e.target.value}))} className="block w-full h-9 mt-1 rounded-md bg-slate-900 border border-slate-700 text-white px-2"/></label>
      )}
      <button disabled={saving} className="bg-blue-600 text-white rounded-md px-4 h-9 text-xs font-bold disabled:opacity-50">{saving ? "جاري الحفظ..." : "حفظ التعديل"}</button>
    </form>
  </div>;
}

function ProfitsSection({ orders, supervisorProfit = 0, supervisorAccessEnabled = false }) {
  const deliveredOrders = orders.filter((o) => o.status === "delivered");

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
        <StatCard title="الطلبات الواصلة" value={orders.length} color="text-green-400" />
        <StatCard title="مبيعات واصلة" value={orders.reduce((s,o) => s + Number(o.order_price || 0), 0)} color="text-blue-400" suffix=" د.ع" />
        <StatCard title="أرباح طلباتي" value={orders.reduce((s,o) => s + Number(o.profit_amount || 0), 0)} color="text-emerald-400" suffix=" د.ع" />
      </div>

      {supervisorAccessEnabled && <div className="grid grid-cols-2 gap-1"><StatCard title="عمولات الإشراف" value={supervisorProfit} color="text-cyan-400" suffix=" د.ع" /><StatCard title="مجموع أرباحي" value={supervisorProfit + orders.reduce((s,o) => s + Number(o.profit_amount || 0), 0)} color="text-emerald-400" suffix=" د.ع" /></div>}
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