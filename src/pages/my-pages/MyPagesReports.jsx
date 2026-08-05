import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";

export default function MyPagesReports({ project }) {
  const today = new Date().toISOString().slice(0, 10);
  const firstDayOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString().slice(0, 10);

  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(firstDayOfMonth);
  const [toDate, setToDate] = useState(today);

  const [balances, setBalances] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [manualProfits, setManualProfits] = useState([]);
  const [settlements, setSettlements] = useState([]);

  useEffect(() => {
    loadReports();
  }, [fromDate, toDate]);

  async function loadReports() {
    try {
      setLoading(true);

      const { data: balancesData } = await supabase
        .from("weekly_delivery_balances")
        .select("*")
        .eq("project_id", project.id)
        .gte("created_at", `${fromDate}T00:00:00`)
        .lte("created_at", `${toDate}T23:59:59`)
        .order("created_at", { ascending: false });

      const { data: distributionsData } = await supabase
        .from("weekly_balance_distributions")
        .select("*, delegates:delegate_id(full_name, name)")
        .eq("project_id", project.id)
        .gte("created_at", `${fromDate}T00:00:00`)
        .lte("created_at", `${toDate}T23:59:59`)
        .order("created_at", { ascending: false });

      const { data: campaignsData } = await supabase
        .from("page_campaigns")
        .select("*")
        .eq("project_id", project.id)
        .gte("created_at", `${fromDate}T00:00:00`)
        .lte("created_at", `${toDate}T23:59:59`);

      const { data: profitsData } = await supabase
        .from("delegate_profit_payments")
        .select("*")
        .eq("project_id", project.id)
        .gte("created_at", `${fromDate}T00:00:00`)
        .lte("created_at", `${toDate}T23:59:59`);

      const { data: settlementsData } = await supabase
        .from("delegate_profit_settlements")
        .select("*")
        .eq("project_id", project.id)
        .gte("created_at", `${fromDate}T00:00:00`)
        .lte("created_at", `${toDate}T23:59:59`);

      setBalances(balancesData || []);
      setDistributions(distributionsData || []);
      setCampaigns(campaignsData || []);
      setManualProfits(profitsData || []);
      setSettlements(settlementsData || []);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل تحميل تقارير البيجات");
    } finally {
      setLoading(false);
    }
  }

  const received = balances.reduce(
    (sum, item) => sum + Number(item.received_amount || 0),
    0
  );

  const promotionSpent = distributions
    .filter((item) => item.distribution_type === "promotion")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const delegatePaidFromBalance = distributions
    .filter((item) => item.distribution_type === "delegate")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const totalDistributed = distributions.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const remaining = received - totalDistributed;

  const manualDelegateProfits = manualProfits.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const settlementsTotal = settlements.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const campaignsCost = campaigns.reduce(
    (sum, item) => sum + Number(item.amount || item.campaign_amount || 0),
    0
  );

  const rows = [
    ...balances.map((item) => ({
      id: `b-${item.id}`,
      type: "balance",
      title: item.company_name || "كشف رصيد",
      amount: item.received_amount,
      date: item.created_at,
      color: "text-green-400",
      badge: "واصل",
    })),
    ...distributions.map((item) => ({
      id: `d-${item.id}`,
      type: item.distribution_type,
      title:
        item.distribution_type === "promotion"
          ? "توزيع ترويج"
          : item.delegates?.full_name || item.delegates?.name || "تسديد مندوب",
      amount: item.amount,
      date: item.created_at,
      color: item.distribution_type === "promotion" ? "text-purple-400" : "text-red-400",
      badge: item.distribution_type === "promotion" ? "ترويج" : "مندوب",
    })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="space-y-2">
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-sm font-black">التقارير</h1>
            <p className="text-[9px] text-slate-500">
              تقارير الكشوفات والتوزيعات والحملات
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px]"
          />

          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px]"
          />

          <button
            onClick={() => {
              setFromDate(today);
              setToDate(today);
            }}
            className="bg-blue-600 hover:bg-blue-700 rounded-md text-[10px] font-black"
          >
            اليوم
          </button>

          <button
            onClick={() => {
              setFromDate(firstDayOfMonth);
              setToDate(today);
            }}
            className="bg-purple-600 hover:bg-purple-700 rounded-md text-[10px] font-black"
          >
            هذا الشهر
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-6 text-center">
          <div className="text-[10px] text-slate-500">جاري التحميل...</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
            <ReportCard title="الواصل" value={received} color="text-green-400" />
            <ReportCard title="الترويج" value={promotionSpent || campaignsCost} color="text-purple-400" />
            <ReportCard title="للمندوبين" value={delegatePaidFromBalance || settlementsTotal} color="text-red-400" />
            <ReportCard title="المتبقي" value={remaining} color="text-blue-400" />
            <ReportCard title="أرباح يدوية" value={manualDelegateProfits} color="text-cyan-400" />
            <ReportCard title="عدد الحملات" value={campaigns.length} color="text-orange-400" />
            <ReportCard title="عدد الكشوفات" value={balances.length} color="text-emerald-400" />
            <ReportCard title="عدد التوزيعات" value={distributions.length} color="text-pink-400" />
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
            <h2 className="text-sm font-black mb-2">الحركات</h2>

            {rows.length === 0 ? (
              <div className="text-center py-6 text-[10px] text-slate-500">
                لا توجد بيانات
              </div>
            ) : (
              <div className="space-y-1">
                {rows.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-900 border border-slate-800 rounded-md p-2 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="bg-slate-700 px-2 py-1 rounded-md text-[8px] font-black">
                          {item.badge}
                        </span>

                        <h2 className="text-[10px] font-black">{item.title}</h2>
                      </div>

                      <p className="text-[8px] text-slate-500">
                        {new Date(item.date).toLocaleDateString()}
                      </p>
                    </div>

                    <h2 className={`text-[10px] font-black ${item.color}`}>
                      {Number(item.amount || 0).toLocaleString()}
                    </h2>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ReportCard({ title, value, color }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
      <p className="text-[8px] text-slate-500 mb-1">{title}</p>
      <h2 className={`text-[10px] font-black ${color}`}>
        {Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}