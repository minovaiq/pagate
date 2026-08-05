import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { notifyTelegramOperation } from "../../services/supabase/telegram";

export default function Campaigns({
  project,
  canAdd = true,
  canDelete = true,
}) {
  const [campaigns, setCampaigns] = useState([]);
  const [balances, setBalances] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [pageName, setPageName] = useState("");
  const [platform, setPlatform] = useState("facebook");
  const [balanceId, setBalanceId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const { data: campaignsData, error: campaignsError } = await supabase
        .from("page_campaigns")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      if (campaignsError) throw campaignsError;

      const { data: balancesData, error: balancesError } = await supabase
        .from("weekly_delivery_balances")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      if (balancesError) throw balancesError;

      const { data: distributionsData, error: distributionsError } =
        await supabase
          .from("weekly_balance_distributions")
          .select("*")
          .eq("project_id", project.id);

      if (distributionsError) throw distributionsError;

      setCampaigns(campaignsData || []);
      setBalances(balancesData || []);
      setDistributions(distributionsData || []);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل تحميل الحملات");
    } finally {
      setLoading(false);
    }
  }

  function getBalanceRemaining(id) {
    const balance = balances.find((item) => item.id === id);

    const spent = distributions
      .filter((item) => item.balance_id === id)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return Number(balance?.received_amount || 0) - spent;
  }

  async function handleAdd(e) {
    e.preventDefault();

    if (!canAdd) {
      alert("ليس لديك صلاحية");
      return;
    }

    if (!pageName.trim() || !amount || Number(amount) <= 0) {
      alert("اكتب اسم الصفحة ومبلغ الحملة");
      return;
    }

    if (!balanceId) {
      alert("اختر كشف الرصيد حتى يستقطع منه مبلغ الحملة");
      return;
    }

    const remaining = getBalanceRemaining(balanceId);

    if (Number(amount) > remaining) {
      alert("مبلغ الحملة أكبر من الرصيد المتبقي بالكشف");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const pageNameValue = pageName.trim();
      const amountValue = Number(amount);
      const notesValue = notes.trim() || null;

      const { data: campaignData, error: campaignError } = await supabase
        .from("page_campaigns")
        .insert([
          {
            project_id: project.id,
            user_id: user.id,
            page_name: pageNameValue,
            platform,
            amount: amountValue,
            campaign_amount: amountValue,
            notes: notesValue,
          },
        ])
        .select()
        .single();

      if (campaignError) throw campaignError;

      const selectedBalance = balances.find(
        (item) => item.id === balanceId
      );

      const { error: distributionError } = await supabase
        .from("weekly_balance_distributions")
        .insert([
          {
            balance_id: balanceId,
            project_id: project.id,
            user_id: user.id,
            distribution_type: "promotion",
            delegate_id: null,
            amount: amountValue,
            notes: `حملة ${pageNameValue}`,
          },
        ]);

      if (distributionError) throw distributionError;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "page_campaigns",
        action: "create",
        title: "إضافة حملة ترويج",
        description: `${pageNameValue} - ${platform} - ${
          selectedBalance?.company_name || "كشف رصيد"
        } - ${notesValue || "بدون ملاحظات"}`,
        amount: amountValue,
      });

      setPageName("");
      setPlatform("facebook");
      setBalanceId("");
      setAmount("");
      setNotes("");

      await loadData();
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل إضافة الحملة");
    }
  }

  async function deleteCampaign(campaign) {
    if (!canDelete) {
      alert("ليس لديك صلاحية");
      return;
    }

    const ok = confirm("حذف الحملة؟");
    if (!ok) return;

    try {
      const { error } = await supabase
        .from("page_campaigns")
        .delete()
        .eq("id", campaign.id)
        .eq("project_id", project.id);

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "page_campaigns",
        action: "delete",
        title: "حذف حملة ترويج",
        description: `${campaign.page_name} - ${
          campaign.platform || "facebook"
        } - ${campaign.notes || "بدون ملاحظات"}`,
        amount: Number(
          campaign.amount || campaign.campaign_amount || 0
        ),
      });

      await loadData();
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل حذف الحملة");
    }
  }

  const totalCampaigns = campaigns.reduce(
    (sum, item) => sum + Number(item.amount || item.campaign_amount || 0),
    0
  );

  const totalBalances = balances.reduce(
    (sum, item) => sum + Number(item.received_amount || 0),
    0
  );

  const totalPromotionSpent = distributions
    .filter((item) => item.distribution_type === "promotion")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const totalRemaining =
    totalBalances -
    distributions.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-sm font-black">الحملات</h1>

          <p className="text-[9px] text-slate-500">
            مبلغ الحملة يستقطع مباشرة من كشف الرصيد
          </p>
        </div>

        <div className="bg-green-600 rounded-md px-2 py-1 text-[10px] font-black">
          {campaigns.length}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 mb-2">
        <MiniStat
          title="الحملات"
          value={totalCampaigns}
          color="text-orange-400"
        />

        <MiniStat
          title="الرصيد الكلي"
          value={totalBalances}
          color="text-green-400"
        />

        <MiniStat
          title="مصروف الترويج"
          value={totalPromotionSpent}
          color="text-purple-400"
        />

        <MiniStat
          title="المتبقي"
          value={totalRemaining}
          color="text-blue-400"
        />
      </div>

      {canAdd && (
        <form onSubmit={handleAdd} className="space-y-1 mb-2">
          <div className="grid grid-cols-4 gap-1">
            <input
              type="text"
              placeholder="اسم الصفحة"
              value={pageName}
              onChange={(e) => setPageName(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />

            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            >
              <option value="facebook">فيسبوك</option>
              <option value="instagram">انستكرام</option>
              <option value="tiktok">تيك توك</option>
            </select>

            <input
              type="number"
              placeholder="مبلغ الحملة"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />

            <select
              value={balanceId}
              onChange={(e) => setBalanceId(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            >
              <option value="">اختر كشف الرصيد</option>

              {balances.map((balance) => (
                <option key={balance.id} value={balance.id}>
                  {balance.company_name || "شركة التوصيل"} - متبقي{" "}
                  {getBalanceRemaining(balance.id).toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-1">
            <input
              type="text"
              placeholder="ملاحظات"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />

            <button className="bg-blue-600 hover:bg-blue-700 rounded-md text-[10px] font-black">
              إضافة حملة
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-6 text-[10px] text-slate-500">
          جاري التحميل...
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-6 text-[10px] text-slate-500">
          لا توجد حملات
        </div>
      ) : (
        <div className="space-y-1">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="bg-slate-900 border border-slate-800 rounded-md p-2"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div>
                  <h2 className="text-[11px] font-black leading-none">
                    {campaign.page_name}
                  </h2>

                  <p className="text-[8px] text-slate-500 mt-1">
                    {campaign.platform || "facebook"} -{" "}
                    {campaign.notes || "بدون ملاحظات"}
                  </p>
                </div>

                <div className="text-left">
                  <h2 className="text-[10px] font-black text-orange-400">
                    {Number(
                      campaign.amount || campaign.campaign_amount || 0
                    ).toLocaleString()}
                  </h2>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => deleteCampaign(campaign)}
                      className="mt-1 bg-red-600 hover:bg-red-700 px-2 h-6 rounded-md text-[8px] font-black"
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