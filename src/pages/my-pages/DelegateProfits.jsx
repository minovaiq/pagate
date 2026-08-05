import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { notifyTelegramOperation } from "../../services/supabase/telegram";

export default function DelegateProfits({
  project,
  canAdd = true,
  canDelete = true,
}) {
  const [delegates, setDelegates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [manualProfits, setManualProfits] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [balances, setBalances] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedDelegate, setSelectedDelegate] = useState(null);
  const [profitAmount, setProfitAmount] = useState("");
  const [profitNotes, setProfitNotes] = useState("");

  const [selectedSettlementDelegate, setSelectedSettlementDelegate] =
    useState(null);

  const [selectedBalanceId, setSelectedBalanceId] = useState("");
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementNotes, setSettlementNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const { data: delegatesData } = await supabase
        .from("delegates")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      const { data: campaignsData } = await supabase
        .from("page_campaigns")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      const { data: profitsData } = await supabase
        .from("delegate_profit_payments")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      const { data: settlementsData } = await supabase
        .from("delegate_profit_settlements")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      const { data: balancesData } = await supabase
        .from("weekly_delivery_balances")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      const { data: distributionsData } = await supabase
        .from("weekly_balance_distributions")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      setDelegates(delegatesData || []);
      setCampaigns(campaignsData || []);
      setManualProfits(profitsData || []);
      setSettlements(settlementsData || []);
      setBalances(balancesData || []);
      setDistributions(distributionsData || []);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل تحميل أرباح المندوبين");
    } finally {
      setLoading(false);
    }
  }

  function getBalanceRemaining(balanceId) {
    const balance = balances.find((item) => item.id === balanceId);

    const spent = distributions
      .filter((item) => item.balance_id === balanceId)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return Number(balance?.received_amount || 0) - spent;
  }

  async function addManualProfit(e) {
    e.preventDefault();

    if (!canAdd) {
      alert("ليس لديك صلاحية الإضافة");
      return;
    }

    if (!selectedDelegate || !profitAmount || Number(profitAmount) <= 0) {
      alert("اختر المندوب واكتب مبلغ صحيح");
      return;
    }

    try {
      setSaving(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const amountValue = Number(profitAmount);
      const notesValue = profitNotes.trim() || null;

      const { error } = await supabase
        .from("delegate_profit_payments")
        .insert([
          {
            project_id: project.id,
            delegate_id: selectedDelegate.id,
            user_id: user.id,
            amount: amountValue,
            notes: notesValue,
          },
        ]);

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "delegate_profit_payments",
        action: "create",
        title: "إضافة ربح مندوب",
        description: `${
          selectedDelegate.full_name || selectedDelegate.name
        } - ${notesValue || "بدون ملاحظات"}`,
        amount: amountValue,
      });

      setSelectedDelegate(null);
      setProfitAmount("");
      setProfitNotes("");

      await loadData();
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل إضافة الربح");
    } finally {
      setSaving(false);
    }
  }

  async function addSettlement(e) {
    e.preventDefault();

    if (!canAdd) {
      alert("ليس لديك صلاحية التسديد");
      return;
    }

    if (!selectedSettlementDelegate) {
      alert("اختر المندوب");
      return;
    }

    if (!selectedBalanceId) {
      alert("اختر كشف الرصيد");
      return;
    }

    if (!settlementAmount || Number(settlementAmount) <= 0) {
      alert("اكتب مبلغ صحيح");
      return;
    }

    const remaining = getBalanceRemaining(selectedBalanceId);

    if (Number(settlementAmount) > remaining) {
      alert("مبلغ التسديد أكبر من الرصيد المتبقي");
      return;
    }

    try {
      setSettling(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const amountValue = Number(settlementAmount);
      const notesValue = settlementNotes.trim() || null;

      const { data: distributionData, error: distributionError } =
        await supabase
          .from("weekly_balance_distributions")
          .insert([
            {
              balance_id: selectedBalanceId,
              project_id: project.id,
              user_id: user.id,
              distribution_type: "delegate",
              delegate_id: selectedSettlementDelegate.id,
              amount: amountValue,
              notes:
                notesValue ||
                `تسديد أرباح ${
                  selectedSettlementDelegate.full_name ||
                  selectedSettlementDelegate.name
                }`,
            },
          ])
          .select()
          .single();

      if (distributionError) throw distributionError;

      const selectedBalance = balances.find(
        (item) => item.id === selectedBalanceId
      );

      const { error: settlementError } = await supabase
        .from("delegate_profit_settlements")
        .insert([
          {
            project_id: project.id,
            delegate_id: selectedSettlementDelegate.id,
            user_id: user.id,
            balance_id: selectedBalanceId,
            distribution_id: distributionData.id,
            amount: amountValue,
            notes: notesValue,
          },
        ]);

      if (settlementError) throw settlementError;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "delegate_profit_settlements",
        action: "create",
        title: "تسديد أرباح مندوب",
        description: `${
          selectedSettlementDelegate.full_name ||
          selectedSettlementDelegate.name
        } - ${selectedBalance?.company_name || "كشف رصيد"} - ${
          notesValue || "بدون ملاحظات"
        }`,
        amount: amountValue,
      });

      setSelectedSettlementDelegate(null);
      setSelectedBalanceId("");
      setSettlementAmount("");
      setSettlementNotes("");

      await loadData();
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل تسديد أرباح المندوب");
    } finally {
      setSettling(false);
    }
  }

  async function deleteManualProfit(profit) {
    if (!canDelete) {
      alert("ليس لديك صلاحية الحذف");
      return;
    }

    const ok = confirm("هل تريد حذف ربح المندوب؟");
    if (!ok) return;

    const { error } = await supabase
      .from("delegate_profit_payments")
      .delete()
      .eq("id", profit.id)
      .eq("project_id", project.id);

    if (error) {
      alert(error.message);
      return;
    }

    await notifyTelegramOperation({
      projectId: project.id,
      tableName: "delegate_profit_payments",
      action: "delete",
      title: "حذف ربح مندوب",
      description: `${profit.notes || "ربح يدوي"}`,
      amount: Number(profit.amount || 0),
    });

    await loadData();
  }

  async function deleteSettlement(settlement) {
    if (!canDelete) {
      alert("ليس لديك صلاحية الحذف");
      return;
    }

    const ok = confirm("هل تريد حذف تسديد المندوب؟");
    if (!ok) return;

    if (settlement.distribution_id) {
      await supabase
        .from("weekly_balance_distributions")
        .delete()
        .eq("id", settlement.distribution_id)
        .eq("project_id", project.id);
    }

    const { error } = await supabase
      .from("delegate_profit_settlements")
      .delete()
      .eq("id", settlement.id)
      .eq("project_id", project.id);

    if (error) {
      alert(error.message);
      return;
    }

    await notifyTelegramOperation({
      projectId: project.id,
      tableName: "delegate_profit_settlements",
      action: "delete",
      title: "حذف تسديد مندوب",
      description: `${settlement.notes || "تسديد أرباح"}`,
      amount: Number(settlement.amount || 0),
    });

    await loadData();
  }

  function getDelegateStats(delegate) {
    const delegateCampaigns = campaigns.filter(
      (campaign) => campaign.delegate_id === delegate.id
    );

    const delegateManualProfits = manualProfits.filter(
      (item) => item.delegate_id === delegate.id
    );

    const delegateSettlements = settlements.filter(
      (item) => item.delegate_id === delegate.id
    );

    const totalOrders = delegateCampaigns.reduce(
      (sum, item) => sum + Number(item.order_price || 0),
      0
    );

    const totalCampaignCost = delegateCampaigns.reduce(
      (sum, item) =>
        sum + Number(item.amount || item.campaign_amount || 0),
      0
    );

    const campaignDelegateProfit = delegateCampaigns.reduce(
      (sum, item) => sum + Number(item.delegate_profit || 0),
      0
    );

    const manualProfit = delegateManualProfits.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const totalSettlements = delegateSettlements.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const totalDelegateProfit = campaignDelegateProfit + manualProfit;

    const remainingForDelegate =
      totalDelegateProfit - totalSettlements;

    const ourProfit =
      totalOrders - campaignDelegateProfit - totalCampaignCost;

    return {
      campaignsCount: delegateCampaigns.length,
      manualCount: delegateManualProfits.length,
      settlementsCount: delegateSettlements.length,
      campaignDelegateProfit,
      manualProfit,
      totalDelegateProfit,
      totalSettlements,
      remainingForDelegate,
      ourProfit,
      delegateManualProfits,
      delegateSettlements,
    };
  }

  const totalManualProfits = manualProfits.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const totalCampaignDelegateProfits = campaigns.reduce(
    (sum, item) => sum + Number(item.delegate_profit || 0),
    0
  );

  const totalSettlements = settlements.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const totalDelegateProfits =
    totalCampaignDelegateProfits + totalManualProfits;

  const totalRemaining =
    totalDelegateProfits - totalSettlements;

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-sm font-black">أرباح المندوبين</h1>
          <p className="text-[9px] text-slate-500">
            التسديد ينخصم مباشرة من كشف الرصيد
          </p>
        </div>

        <button
          onClick={loadData}
          className="bg-slate-800 hover:bg-slate-700 rounded-md px-2 h-7 text-[9px] font-black"
        >
          تحديث
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1 mb-2">
        <MiniStat title="الأرباح" value={totalDelegateProfits} color="text-blue-400" />
        <MiniStat title="المسدد" value={totalSettlements} color="text-red-400" />
        <MiniStat title="المتبقي" value={totalRemaining} color="text-green-400" />
        <MiniStat title="يدوي" value={totalManualProfits} color="text-cyan-400" />
      </div>

      {canAdd && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1 mb-2">
          <form
            onSubmit={addManualProfit}
            className="bg-slate-900 border border-slate-800 rounded-md p-2"
          >
            <h2 className="text-[10px] font-black mb-1">إضافة ربح للمندوب</h2>

            <div className="grid grid-cols-4 gap-1">
              <select
                value={selectedDelegate?.id || ""}
                onChange={(e) => {
                  const found = delegates.find((d) => d.id === e.target.value);
                  setSelectedDelegate(found || null);
                }}
                className="bg-slate-950 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
              >
                <option value="">المندوب</option>
                {delegates.map((delegate) => (
                  <option key={delegate.id} value={delegate.id}>
                    {delegate.full_name || delegate.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                placeholder="مبلغ الربح"
                value={profitAmount}
                onChange={(e) => setProfitAmount(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
              />

              <input
                type="text"
                placeholder="ملاحظات"
                value={profitNotes}
                onChange={(e) => setProfitNotes(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
              />

              <button
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-md text-[10px] font-black"
              >
                {saving ? "..." : "إضافة"}
              </button>
            </div>
          </form>

          <form
            onSubmit={addSettlement}
            className="bg-slate-900 border border-slate-800 rounded-md p-2"
          >
            <h2 className="text-[10px] font-black mb-1">تسديد أرباح مندوب</h2>

            <div className="grid grid-cols-5 gap-1">
              <select
                value={selectedSettlementDelegate?.id || ""}
                onChange={(e) => {
                  const found = delegates.find((d) => d.id === e.target.value);
                  setSelectedSettlementDelegate(found || null);
                }}
                className="bg-slate-950 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
              >
                <option value="">المندوب</option>
                {delegates.map((delegate) => (
                  <option key={delegate.id} value={delegate.id}>
                    {delegate.full_name || delegate.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedBalanceId}
                onChange={(e) => setSelectedBalanceId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
              >
                <option value="">كشف الرصيد</option>
                {balances.map((balance) => (
                  <option key={balance.id} value={balance.id}>
                    {balance.company_name || "شركة التوصيل"} - متبقي{" "}
                    {getBalanceRemaining(balance.id).toLocaleString()}
                  </option>
                ))}
              </select>

              <input
                type="number"
                placeholder="مبلغ التسديد"
                value={settlementAmount}
                onChange={(e) => setSettlementAmount(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
              />

              <input
                type="text"
                placeholder="ملاحظات"
                value={settlementNotes}
                onChange={(e) => setSettlementNotes(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
              />

              <button
                disabled={settling}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-md text-[10px] font-black"
              >
                {settling ? "..." : "تسديد"}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-6 text-[10px] text-slate-500">
          جاري التحميل...
        </div>
      ) : delegates.length === 0 ? (
        <div className="text-center py-6 text-[10px] text-slate-500">
          لا يوجد مندوبين
        </div>
      ) : (
        <div className="space-y-1">
          {delegates.map((delegate) => {
            const stats = getDelegateStats(delegate);

            return (
              <div
                key={delegate.id}
                className="bg-slate-900 border border-slate-800 rounded-md p-2"
              >
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <h2 className="text-[11px] font-black leading-none">
                      {delegate.full_name || delegate.name}
                    </h2>

                    <p className="text-[8px] text-slate-500 mt-1">
                      {stats.manualCount} ربح - {stats.settlementsCount} تسديد
                    </p>
                  </div>

                  <div className="text-left">
                    <h2 className="text-[11px] font-black text-green-400">
                      {stats.remainingForDelegate.toLocaleString()}
                    </h2>

                    <p className="text-[8px] text-slate-500">المتبقي</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1 mb-1">
                  <InfoBox title="الأرباح" value={stats.totalDelegateProfit} color="text-blue-400" />
                  <InfoBox title="المسدد" value={stats.totalSettlements} color="text-red-400" />
                  <InfoBox title="المتبقي" value={stats.remainingForDelegate} color="text-green-400" />
                  <InfoBox title="ربحنا" value={stats.ourProfit} color="text-purple-400" />
                </div>

                {stats.delegateSettlements.length > 0 && (
                  <div className="space-y-1 mt-1">
                    {stats.delegateSettlements.slice(0, 3).map((settlement) => (
                      <div
                        key={settlement.id}
                        className="bg-slate-950 border border-slate-800 rounded-md p-1 flex items-center justify-between"
                      >
                        <div>
                          <h3 className="text-[9px] font-black text-red-400">
                            تسديد:{" "}
                            {Number(settlement.amount || 0).toLocaleString()}
                          </h3>
                          <p className="text-[8px] text-slate-500">
                            {settlement.notes || "تسديد أرباح"}
                          </p>
                        </div>

                        {canDelete && (
                          <button
                            onClick={() => deleteSettlement(settlement)}
                            className="bg-red-600 hover:bg-red-700 rounded-md px-2 h-6 text-[8px] font-black"
                          >
                            حذف
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {stats.delegateManualProfits.length > 0 && (
                  <div className="space-y-1 mt-1">
                    {stats.delegateManualProfits.slice(0, 3).map((profit) => (
                      <div
                        key={profit.id}
                        className="bg-slate-950 border border-slate-800 rounded-md p-1 flex items-center justify-between"
                      >
                        <div>
                          <h3 className="text-[9px] font-black text-green-400">
                            ربح: {Number(profit.amount || 0).toLocaleString()}
                          </h3>
                          <p className="text-[8px] text-slate-500">
                            {profit.notes || "ربح يدوي"}
                          </p>
                        </div>

                        {canDelete && (
                          <button
                            onClick={() => deleteManualProfit(profit)}
                            className="bg-red-600 hover:bg-red-700 rounded-md px-2 h-6 text-[8px] font-black"
                          >
                            حذف
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniStat({ title, value, color }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-md p-2">
      <p className="text-[8px] text-slate-500 mb-1">{title}</p>
      <h2 className={`text-[10px] font-black ${color}`}>
        {Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}

function InfoBox({ title, value, color = "text-white" }) {
  return (
    <div className="bg-slate-950 rounded-md p-1">
      <p className="text-[8px] text-slate-500">{title}</p>
      <h2 className={`text-[9px] font-black truncate ${color}`}>
        {Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}