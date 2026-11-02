import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";

import Campaigns from "./Campaigns";
import Delegates from "./Delegates";
import DelegateProfits from "./DelegateProfits";
import PromotionBalance from "./PromotionBalance";
import MyPagesReports from "./MyPagesReports";
import OrderTelegramSettings from "./OrderTelegramSettings";
import PromotionTargeting from "./PromotionTargeting";

import MyOrders from "../user-orders/MyOrders";
import MyProfits from "../user-orders/MyProfits";
import AddOrder from "../user-orders/AddOrder";
import UserOrdersDashboard from "../user-orders/UserOrdersDashboard";

export default function MyPagesDashboard({ project, permissions, isAdmin }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showMobileMore, setShowMobileMore] = useState(false);

  const [stats, setStats] = useState({
    received: 0,
    promotionSpent: 0,
    delegatePaid: 0,
    remaining: 0,
  });

  const canAdd = isAdmin || permissions?.can_add === true;
  const canEdit = isAdmin || permissions?.can_edit === true;
  const canDelete = isAdmin || permissions?.can_delete === true;
  const canReports = isAdmin || permissions?.can_reports === true;

  const canPagesDashboard =
    isAdmin || permissions?.can_pages_dashboard === true;
  const canCampaigns = isAdmin || permissions?.can_campaigns === true;
  const canDelegates = isAdmin || permissions?.can_delegates === true;
  const canDelegateProfits =
    isAdmin || permissions?.can_delegate_profits === true;
  const canUserOrders = isAdmin || permissions?.can_user_orders === true;
  const canAddUserOrder =
    isAdmin || permissions?.can_add_user_order === true;
  const canUserProfits = isAdmin || permissions?.can_user_profits === true;
  const canWallet = isAdmin || permissions?.can_wallet === true;
  const canBalance = isAdmin || permissions?.can_balance === true;
  const canOrderBot = isAdmin || permissions?.can_order_bot === true;
  const canPromotionTargeting =
    isAdmin || canPagesDashboard || canReports;

  useEffect(() => {
    loadStats();
  }, [project.id]);

  useEffect(() => {
    if (activeTab === "dashboard" && !canPagesDashboard) {
      setActiveTab(getFirstAllowedTab());
    }

    if (activeTab === "campaigns" && !canCampaigns) {
      setActiveTab(getFirstAllowedTab());
    }

    if (activeTab === "delegates" && !canDelegates) {
      setActiveTab(getFirstAllowedTab());
    }

    if (activeTab === "delegate_profits" && !canDelegateProfits) {
      setActiveTab(getFirstAllowedTab());
    }

    if (activeTab === "user_orders" && !canUserOrders) {
      setActiveTab(getFirstAllowedTab());
    }

    if (activeTab === "add_user_order" && !canAddUserOrder) {
      setActiveTab(getFirstAllowedTab());
    }

    if (activeTab === "user_profits" && !canUserProfits) {
      setActiveTab(getFirstAllowedTab());
    }

    if (activeTab === "wallet" && !canWallet) {
      setActiveTab(getFirstAllowedTab());
    }

    if (activeTab === "balance" && !canBalance) {
      setActiveTab(getFirstAllowedTab());
    }

    if (activeTab === "order_bot" && !canOrderBot) {
      setActiveTab(getFirstAllowedTab());
    }

    if (activeTab === "promotion_targeting" && !canPromotionTargeting) {
      setActiveTab(getFirstAllowedTab());
    }

    if (activeTab === "reports" && !canReports) {
      setActiveTab(getFirstAllowedTab());
    }
  }, [
    activeTab,
    canPagesDashboard,
    canCampaigns,
    canDelegates,
    canDelegateProfits,
    canUserOrders,
    canAddUserOrder,
    canUserProfits,
    canWallet,
    canBalance,
    canOrderBot,
    canPromotionTargeting,
    canReports,
  ]);

  function getFirstAllowedTab() {
    if (canPagesDashboard) return "dashboard";
    if (canCampaigns) return "campaigns";
    if (canDelegates) return "delegates";
    if (canDelegateProfits) return "delegate_profits";
    if (canUserOrders) return "user_orders";
    if (canAddUserOrder) return "add_user_order";
    if (canUserProfits) return "user_profits";
    if (canWallet) return "wallet";
    if (canBalance) return "balance";
    if (canOrderBot) return "order_bot";
    if (canPromotionTargeting) return "promotion_targeting";
    if (canReports) return "reports";
    return "no_access";
  }

  async function loadStats() {
    const { data: balances } = await supabase
      .from("weekly_delivery_balances")
      .select("*")
      .eq("project_id", project.id);

    const { data: distributions } = await supabase
      .from("weekly_balance_distributions")
      .select("*")
      .eq("project_id", project.id);

    const received = (balances || []).reduce(
      (sum, item) => sum + Number(item.received_amount || 0),
      0
    );

    const promotionSpent = (distributions || [])
      .filter((item) => item.distribution_type === "promotion")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const delegatePaid = (distributions || [])
      .filter((item) => item.distribution_type === "delegate")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const totalDistributed = (distributions || []).reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    setStats({
      received,
      promotionSpent,
      delegatePaid,
      remaining: received - totalDistributed,
    });
  }

  if (getFirstAllowedTab() === "no_access") {
    return (
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-6 text-center text-slate-400 text-[12px]">
        لا توجد لديك صلاحيات لعرض تبويبات هذا المشروع
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-20 md:pb-2" dir="rtl">
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-2 overflow-x-auto hidden md:block">
        <div className="flex gap-1 min-w-max">
          {canPagesDashboard && (
            <TabButton label="الرئيسية" active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} color="bg-blue-600" />
          )}

          {canCampaigns && (
            <TabButton label="الحملات" active={activeTab === "campaigns"} onClick={() => setActiveTab("campaigns")} color="bg-green-600" />
          )}

          {canDelegates && (
            <TabButton label="المندوبين" active={activeTab === "delegates"} onClick={() => setActiveTab("delegates")} color="bg-orange-600" />
          )}

          {canDelegateProfits && (
            <TabButton label="أرباح المندوب" active={activeTab === "delegate_profits"} onClick={() => setActiveTab("delegate_profits")} color="bg-cyan-600" />
          )}

          {canUserOrders && (
            <TabButton label="طلبات المندوبين" active={activeTab === "user_orders"} onClick={() => setActiveTab("user_orders")} color="bg-emerald-600" />
          )}

          {canAddUserOrder && (
            <TabButton label="إضافة طلب" active={activeTab === "add_user_order"} onClick={() => setActiveTab("add_user_order")} color="bg-purple-600" />
          )}

          {canUserProfits && (
            <TabButton label="أرباح الطلبات" active={activeTab === "user_profits"} onClick={() => setActiveTab("user_profits")} color="bg-pink-600" />
          )}

          {canWallet && (
            <TabButton label="محفظتي" active={activeTab === "wallet"} onClick={() => setActiveTab("wallet")} color="bg-yellow-600" />
          )}

          {canBalance && (
            <TabButton label="الرصيد" active={activeTab === "balance"} onClick={() => setActiveTab("balance")} color="bg-indigo-600" />
          )}

          {canOrderBot && (
            <TabButton label="بوت الطلبات" active={activeTab === "order_bot"} onClick={() => setActiveTab("order_bot")} color="bg-teal-600" />
          )}

          {canPromotionTargeting && (
            <TabButton label="استهداف الترويج" active={activeTab === "promotion_targeting"} onClick={() => setActiveTab("promotion_targeting")} color="bg-blue-600" />
          )}

          {canReports && (
            <TabButton label="التقارير" active={activeTab === "reports"} onClick={() => setActiveTab("reports")} color="bg-red-600" />
          )}

          <button
            onClick={loadStats}
            className="bg-slate-800 hover:bg-slate-700 px-3 h-8 rounded-md text-[10px] font-black"
          >
            تحديث
          </button>
        </div>
      </div>

      <nav aria-label="التنقل الرئيسي" className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-700 bg-slate-950/95 backdrop-blur-xl px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="flex items-center justify-around gap-1 max-w-lg mx-auto">
          {[
            canPagesDashboard && ["dashboard","⌂","الرئيسية"],
            canUserOrders && ["user_orders","▤","الطلبات"],
            canAddUserOrder && ["add_user_order","+","إضافة"],
            canWallet && ["wallet","◈","محفظتي"],
            ["more","☷","المزيد"],
          ].filter(Boolean).map(([key,icon,label]) => (
            <button key={key} type="button" onClick={() => key === "more" ? setShowMobileMore(v=>!v) : (setActiveTab(key),setShowMobileMore(false))}
              aria-current={activeTab === key ? "page" : undefined}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-bold ${activeTab === key || (key === "more" && showMobileMore) ? "bg-blue-600 text-white" : "text-slate-400"}`}>
              <span aria-hidden="true" className="text-xl leading-5">{icon}</span><span>{label}</span>
            </button>
          ))}
        </div>
      </nav>
      {showMobileMore && <div className="md:hidden fixed inset-x-3 bottom-[76px] z-40 max-h-[65vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-950 p-3 shadow-2xl">
        <div className="flex items-center justify-between mb-2"><strong className="text-sm">الأقسام الأخرى</strong><button onClick={()=>setShowMobileMore(false)} className="px-3 py-1 text-slate-300">إغلاق ×</button></div>
        <div className="grid grid-cols-2 gap-2">
          {[
            canCampaigns && ["campaigns","الحملات"],canDelegates && ["delegates","المندوبين"],
            canDelegateProfits && ["delegate_profits","أرباح المندوب"],canUserProfits && ["user_profits","أرباح الطلبات"],
            canBalance && ["balance","الرصيد"],canOrderBot && ["order_bot","بوت الطلبات"],
            canPromotionTargeting && ["promotion_targeting","استهداف الترويج"],canReports && ["reports","التقارير"],
          ].filter(Boolean).map(([key,label])=><button key={key} onClick={()=>{setActiveTab(key);setShowMobileMore(false)}} className={`rounded-xl border border-slate-800 p-3 text-xs font-bold text-right ${activeTab===key?"bg-blue-600 text-white":"bg-slate-900 text-slate-200"}`}>{label}</button>)}
        </div>
      </div>}
      {activeTab === "dashboard" && canPagesDashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
          <StatCard title="الواصل" value={stats.received} color="text-green-400" />
          <StatCard title="مصروف الترويج" value={stats.promotionSpent} color="text-purple-400" />
          <StatCard title="مسدد للمندوبين" value={stats.delegatePaid} color="text-red-400" />
          <StatCard title="الرصيد الباقي" value={stats.remaining} color="text-cyan-400" />
        </div>
      )}

      {activeTab === "campaigns" && canCampaigns && (
        <Campaigns project={project} canAdd={canAdd} canEdit={canEdit} canDelete={canDelete} />
      )}

      {activeTab === "delegates" && canDelegates && (
        <Delegates project={project} canAdd={canAdd} canEdit={canEdit} canDelete={canDelete} />
      )}

      {activeTab === "delegate_profits" && canDelegateProfits && (
        <DelegateProfits project={project} canAdd={canAdd} canEdit={canEdit} canDelete={canDelete} />
      )}

      {activeTab === "user_orders" && canUserOrders && (
        <UserOrdersDashboard project={project} permissions={permissions} isAdmin={isAdmin} initialTab="dashboard" embedded />
      )}

      {activeTab === "add_user_order" && canAddUserOrder && (
        <AddOrder project={project} onDone={loadStats} />
      )}

      {activeTab === "user_profits" && canUserProfits && (
        <MyProfits project={project} isAdmin={isAdmin} />
      )}

      {activeTab === "wallet" && canWallet && (
        <UserOrdersDashboard project={project} permissions={permissions} isAdmin={isAdmin} initialTab="wallet" embedded />
      )}

      {activeTab === "balance" && canBalance && (
        <PromotionBalance project={project} canAdd={canAdd} canEdit={canEdit} canDelete={canDelete} />
      )}

      {activeTab === "order_bot" && canOrderBot && (
        <OrderTelegramSettings project={project} />
      )}

      {activeTab === "promotion_targeting" && canPromotionTargeting && (
        <PromotionTargeting project={project} />
      )}

      {activeTab === "reports" && canReports && (
        <MyPagesReports project={project} />
      )}
    </div>
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

function StatCard({ title, value, color }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
      <p className="text-[8px] text-slate-500 mb-1">{title}</p>
      <h2 className={`text-[10px] font-black ${color}`}>
        {Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}