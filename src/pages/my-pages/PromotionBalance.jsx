import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { notifyTelegramOperation } from "../../services/supabase/telegram";

export default function PromotionBalance({
  project,
  canAdd = true,
  canDelete = true,
}) {
  const [balances, setBalances] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [delegates, setDelegates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [companyName, setCompanyName] = useState("");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [notes, setNotes] = useState("");

  const [selectedBalanceId, setSelectedBalanceId] = useState("");
  const [distributionType, setDistributionType] = useState("promotion");
  const [delegateId, setDelegateId] = useState("");
  const [distributionAmount, setDistributionAmount] = useState("");
  const [distributionNotes, setDistributionNotes] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);

      const { data: balancesData, error: balancesError } = await supabase
        .from("weekly_delivery_balances")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      if (balancesError) throw balancesError;

      const { data: distributionsData, error: distributionsError } =
        await supabase
          .from("weekly_balance_distributions")
          .select("*, delegates:delegate_id(full_name, name)")
          .eq("project_id", project.id)
          .order("created_at", { ascending: false });

      if (distributionsError) throw distributionsError;

      const { data: delegatesData, error: delegatesError } = await supabase
        .from("delegates")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      if (delegatesError) throw delegatesError;

      setBalances(balancesData || []);
      setDistributions(distributionsData || []);
      setDelegates(delegatesData || []);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل تحميل الرصيد");
    } finally {
      setLoading(false);
    }
  }

  function getCurrentWeekRange() {
    const now = new Date();

    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return {
      weekStartDate: start.toISOString().slice(0, 10),
      weekEndDate: end.toISOString().slice(0, 10),
    };
  }

  async function addBalance(e) {
    e.preventDefault();

    if (!canAdd) {
      alert("ليس لديك صلاحية الإضافة");
      return;
    }

    if (!receivedAmount || Number(receivedAmount) <= 0) {
      alert("اكتب مبلغ صحيح");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { weekStartDate, weekEndDate } = getCurrentWeekRange();
      const companyValue = companyName.trim() || "شركة التوصيل";
      const amountValue = Number(receivedAmount);
      const notesValue = notes.trim() || null;

      const { error } = await supabase.from("weekly_delivery_balances").insert([
        {
          project_id: project.id,
          user_id: user.id,
          week_start: weekStartDate,
          week_end: weekEndDate,
          company_name: companyValue,
          received_amount: amountValue,
          notes: notesValue,
        },
      ]);

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "weekly_delivery_balances",
        action: "create",
        title: "إضافة كشف رصيد أسبوعي",
        description: `${companyValue} - ${notesValue || "بدون ملاحظات"}`,
        amount: amountValue,
      });

      setCompanyName("");
      setReceivedAmount("");
      setNotes("");

      await loadData();
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل إضافة كشف الرصيد");
    }
  }

  async function addDistribution(e) {
    e.preventDefault();

    if (!canAdd) {
      alert("ليس لديك صلاحية الإضافة");
      return;
    }

    if (!selectedBalanceId) {
      alert("اختر كشف الرصيد");
      return;
    }

    if (!distributionAmount || Number(distributionAmount) <= 0) {
      alert("اكتب مبلغ صحيح");
      return;
    }

    if (distributionType === "delegate" && !delegateId) {
      alert("اختر المندوب");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const amountValue = Number(distributionAmount);
      const notesValue = distributionNotes.trim() || null;
      const selectedDelegate = delegates.find((item) => item.id === delegateId);
      const selectedBalance = balances.find((item) => item.id === selectedBalanceId);

      const { error } = await supabase
        .from("weekly_balance_distributions")
        .insert([
          {
            balance_id: selectedBalanceId,
            project_id: project.id,
            user_id: user.id,
            distribution_type: distributionType,
            delegate_id: distributionType === "delegate" ? delegateId : null,
            amount: amountValue,
            notes: notesValue,
          },
        ]);

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "weekly_balance_distributions",
        action: "create",
        title:
          distributionType === "delegate"
            ? "تسديد مندوب"
            : distributionType === "promotion"
            ? "توزيع للترويج"
            : "توزيع رصيد",
        description:
          distributionType === "delegate"
            ? `${selectedDelegate?.full_name || selectedDelegate?.name || "مندوب"} - ${
                selectedBalance?.company_name || "كشف رصيد"
              } - ${notesValue || "بدون ملاحظات"}`
            : `${selectedBalance?.company_name || "كشف رصيد"} - ${notesValue || "بدون ملاحظات"}`,
        amount: amountValue,
      });

      setSelectedBalanceId("");
      setDistributionType("promotion");
      setDelegateId("");
      setDistributionAmount("");
      setDistributionNotes("");

      await loadData();
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل إضافة التوزيع");
    }
  }

  async function deleteBalance(balance) {
    if (!canDelete) {
      alert("ليس لديك صلاحية الحذف");
      return;
    }

    const ok = confirm("هل تريد حذف كشف الرصيد وكل توزيعاته؟");
    if (!ok) return;

    const { error } = await supabase
      .from("weekly_delivery_balances")
      .delete()
      .eq("id", balance.id)
      .eq("project_id", project.id);

    if (error) {
      alert(error.message);
      return;
    }

    await notifyTelegramOperation({
      projectId: project.id,
      tableName: "weekly_delivery_balances",
      action: "delete",
      title: "حذف كشف رصيد أسبوعي",
      description: `${balance.company_name || "شركة التوصيل"} - ${
        balance.notes || "بدون ملاحظات"
      }`,
      amount: Number(balance.received_amount || 0),
    });

    await loadData();
  }

  async function deleteDistribution(item) {
    if (!canDelete) {
      alert("ليس لديك صلاحية الحذف");
      return;
    }

    const ok = confirm("هل تريد حذف هذا التوزيع؟");
    if (!ok) return;

    const { error } = await supabase
      .from("weekly_balance_distributions")
      .delete()
      .eq("id", item.id)
      .eq("project_id", project.id);

    if (error) {
      alert(error.message);
      return;
    }

    await notifyTelegramOperation({
      projectId: project.id,
      tableName: "weekly_balance_distributions",
      action: "delete",
      title:
        item.distribution_type === "delegate"
          ? "حذف تسديد مندوب"
          : item.distribution_type === "promotion"
          ? "حذف توزيع ترويج"
          : "حذف توزيع",
      description:
        item.delegates?.full_name ||
        item.delegates?.name ||
        item.notes ||
        "بدون ملاحظات",
      amount: Number(item.amount || 0),
    });

    await loadData();
  }

  function getBalanceStats(balanceId) {
    const balance = balances.find((item) => item.id === balanceId);
    const related = distributions.filter((item) => item.balance_id === balanceId);

    const distributed = related.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const toDelegates = related
      .filter((item) => item.distribution_type === "delegate")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const toPromotion = related
      .filter((item) => item.distribution_type === "promotion")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const toOther = related
      .filter((item) => item.distribution_type === "other")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const remaining = Number(balance?.received_amount || 0) - distributed;

    return {
      related,
      distributed,
      toDelegates,
      toPromotion,
      toOther,
      remaining,
    };
  }

  function distributionLabel(type) {
    switch (type) {
      case "delegate":
        return "مندوب";
      case "promotion":
        return "ترويج";
      default:
        return "أخرى";
    }
  }

  const totalReceived = balances.reduce(
    (sum, item) => sum + Number(item.received_amount || 0),
    0
  );

  const totalDistributed = distributions.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const totalRemaining = totalReceived - totalDistributed;

  const totalPromotion = distributions
    .filter((item) => item.distribution_type === "promotion")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-sm font-black">كشف الرصيد الأسبوعي</h1>
          <p className="text-[9px] text-slate-500">
            التاريخ يُحسب تلقائيًا حسب الأسبوع الحالي
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
        <MiniStat title="الواصل" value={totalReceived} color="text-green-400" />
        <MiniStat title="الموزع" value={totalDistributed} color="text-red-400" />
        <MiniStat title="الباقي" value={totalRemaining} color="text-blue-400" />
        <MiniStat title="للترويج" value={totalPromotion} color="text-purple-400" />
      </div>

      {canAdd && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-1 mb-2">
          <form
            onSubmit={addBalance}
            className="bg-slate-900 border border-slate-800 rounded-md p-2"
          >
            <h2 className="text-[10px] font-black mb-1">
              إضافة كشف أسبوعي
            </h2>

            <div className="grid grid-cols-3 gap-1">
              <input
                type="text"
                placeholder="شركة التوصيل"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
              />

              <input
                type="number"
                placeholder="المبلغ الواصل"
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
              />

              <button className="bg-green-600 hover:bg-green-700 rounded-md text-[10px] font-black">
                إضافة كشف
              </button>
            </div>

            <input
              type="text"
              placeholder="ملاحظات"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
            />
          </form>

          <form
            onSubmit={addDistribution}
            className="bg-slate-900 border border-slate-800 rounded-md p-2"
          >
            <h2 className="text-[10px] font-black mb-1">توزيع من الكشف</h2>

            <div className="grid grid-cols-3 gap-1 mb-1">
              <select
                value={selectedBalanceId}
                onChange={(e) => setSelectedBalanceId(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
              >
                <option value="">اختر الكشف</option>
                {balances.map((balance) => (
                  <option key={balance.id} value={balance.id}>
                    {balance.company_name || "شركة التوصيل"} -{" "}
                    {Number(balance.received_amount || 0).toLocaleString()}
                  </option>
                ))}
              </select>

              <select
                value={distributionType}
                onChange={(e) => {
                  setDistributionType(e.target.value);
                  if (e.target.value !== "delegate") setDelegateId("");
                }}
                className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
              >
                <option value="promotion">ترويج حملات</option>
                <option value="delegate">تسديد مندوب</option>
                <option value="other">أخرى</option>
              </select>

              <select
                value={delegateId}
                onChange={(e) => setDelegateId(e.target.value)}
                disabled={distributionType !== "delegate"}
                className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none disabled:opacity-50"
              >
                <option value="">المندوب</option>
                {delegates.map((delegate) => (
                  <option key={delegate.id} value={delegate.id}>
                    {delegate.full_name || delegate.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-1">
              <input
                type="number"
                placeholder="مبلغ التوزيع"
                value={distributionAmount}
                onChange={(e) => setDistributionAmount(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
              />

              <input
                type="text"
                placeholder="ملاحظات"
                value={distributionNotes}
                onChange={(e) => setDistributionNotes(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
              />

              <button className="bg-blue-600 hover:bg-blue-700 rounded-md text-[10px] font-black">
                توزيع
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-6 text-[10px] text-slate-500">
          جاري التحميل...
        </div>
      ) : balances.length === 0 ? (
        <div className="text-center py-6 text-[10px] text-slate-500">
          لا توجد كشوفات رصيد
        </div>
      ) : (
        <div className="space-y-1">
          {balances.map((balance) => {
            const stats = getBalanceStats(balance.id);

            return (
              <div
                key={balance.id}
                className="bg-slate-900 border border-slate-800 rounded-md p-2"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <h2 className="text-[11px] font-black leading-none">
                      {balance.company_name || "شركة التوصيل"}
                    </h2>

                    <p className="text-[8px] text-slate-500 mt-1">
                      {balance.week_start || "-"} إلى {balance.week_end || "-"}
                    </p>
                  </div>

                  <div className="text-left">
                    <h2 className="text-[11px] font-black text-green-400">
                      {Number(balance.received_amount || 0).toLocaleString()}
                    </h2>

                    <p className="text-[8px] text-slate-500">الواصل</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1 mb-1">
                  <InfoBox title="الموزع" value={stats.distributed} color="text-red-400" />
                  <InfoBox title="للمندوبين" value={stats.toDelegates} color="text-cyan-400" />
                  <InfoBox title="للترويج" value={stats.toPromotion} color="text-purple-400" />
                  <InfoBox title="الباقي" value={stats.remaining} color="text-blue-400" />
                </div>

                {stats.related.length > 0 && (
                  <div className="space-y-1 mt-1">
                    {stats.related.map((item) => (
                      <div
                        key={item.id}
                        className="bg-slate-950 border border-slate-800 rounded-md p-1 flex items-center justify-between"
                      >
                        <div>
                          <h3 className="text-[9px] font-black">
                            {distributionLabel(item.distribution_type)}:{" "}
                            {Number(item.amount || 0).toLocaleString()}
                          </h3>

                          <p className="text-[8px] text-slate-500">
                            {item.delegates?.full_name ||
                              item.delegates?.name ||
                              item.notes ||
                              "بدون ملاحظات"}
                          </p>
                        </div>

                        {canDelete && (
                          <button
                            onClick={() => deleteDistribution(item)}
                            className="bg-red-600 hover:bg-red-700 rounded-md px-2 h-6 text-[8px] font-black"
                          >
                            حذف
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {canDelete && (
                  <button
                    onClick={() => deleteBalance(balance)}
                    className="mt-1 w-full bg-red-600 hover:bg-red-700 rounded-md h-6 text-[8px] font-black"
                  >
                    حذف الكشف
                  </button>
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