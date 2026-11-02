import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase/client";

export default function MyProfits({ project, isAdmin = false }) {
  const [orders, setOrders] = useState([]);
  const [supervisorCommissions, setSupervisorCommissions] = useState([]);
  const [isHuda, setIsHuda] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfits();

    const supervisorChannel = supabase.channel(`supervisor-profits-${project.id}`).on("postgres_changes", { event: "*", schema: "public", table: "supervisor_order_commissions" }, () => loadProfits()).subscribe();

    const channel = supabase
      .channel(`my-profits-${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "page_orders",
          filter: `project_id=eq.${project.id}`,
        },
        () => loadProfits()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); supabase.removeChannel(supervisorChannel); };
  }, [project.id]);

  async function loadProfits() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const huda = user?.id === "81e70fe4-5d51-44de-ab72-854ad7854484";
      setIsHuda(huda);
      if (huda) {
        const { data: delegate, error: delegateError } = await supabase.from("delegates").select("id").eq("linked_user_id", user.id).maybeSingle();
        if (delegateError) throw delegateError;
        if (delegate?.id) {
          const { data: commissions, error: commissionError } = await supabase.from("supervisor_order_commissions").select("id, amount, created_at, source_order_id").eq("supervisor_delegate_id", delegate.id).order("created_at", { ascending: false });
          if (commissionError) throw commissionError;
          setSupervisorCommissions(commissions || []);
        } else setSupervisorCommissions([]);
      } else setSupervisorCommissions([]);

      let query = supabase
        .from("page_orders")
        .select("*")
        .eq("project_id", project.id)
        .eq("status", "delivered")
        .order("created_at", { ascending: false });

      if (!isAdmin) {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      setOrders(data || []);
    } catch (err) {
      console.error(err);
      alert(err.message || "فشل تحميل الأرباح");
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const totalProfit = orders.reduce(
      (sum, item) => sum + Number(item.profit_amount || 0),
      0
    );

    const totalSales = orders.reduce(
      (sum, item) => sum + Number(item.order_price || 0),
      0
    );

    const today = new Date().toISOString().slice(0, 10);
    const todayProfit = orders
      .filter((item) => item.created_at?.slice(0, 10) === today)
      .reduce((sum, item) => sum + Number(item.profit_amount || 0), 0);

    const supervisorProfit = supervisorCommissions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return {
      supervisorProfit,
      combinedProfit: totalProfit + (isHuda ? supervisorProfit : 0),
      totalOrders: orders.length,
      totalProfit,
      totalSales,
      todayProfit,
    };
  }, [orders, supervisorCommissions, isHuda]);

  return (
    <div className="space-y-2" dir="rtl">
      {isHuda && (
        <div className="grid grid-cols-3 gap-1">
          <ProfitCard title="أرباح طلباتي" value={stats.totalProfit} color="text-emerald-400" />
          <ProfitCard title="أرباح الإشراف" value={stats.supervisorProfit} color="text-blue-400" />
          <ProfitCard title="مجموع أرباحي" value={stats.combinedProfit} color="text-white" />
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
        <ProfitCard title="صافي أرباحي" value={stats.totalProfit} color="text-emerald-400" />
        <ProfitCard title="أرباح اليوم" value={stats.todayProfit} color="text-blue-400" />
        <ProfitCard title="طلبات واصلة" value={stats.totalOrders} color="text-green-400" noCurrency />
        <ProfitCard title="مبيعات واصلة" value={stats.totalSales} color="text-purple-400" />
      </div>

      {isHuda && (
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
          <h2 className="text-[12px] font-black text-white mb-2">عمولات الإشراف (1,000 د.ع لكل طلب واصل)</h2>
          {supervisorCommissions.length === 0 ? <p className="text-[11px] text-slate-400">لا توجد عمولات إشراف جديدة بعد التفعيل</p> : (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {supervisorCommissions.map(item => <div key={item.id} className="flex justify-between text-[11px] border-b border-slate-800 py-1"><span>{formatDate(item.created_at)}</span><span className="text-blue-400 font-bold">{formatMoney(item.amount)}</span></div>)}
            </div>
          )}
        </div>
      )}
      <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between p-2 border-b border-slate-800">
          <h2 className="text-[12px] font-black text-white">تفاصيل الأرباح</h2>

          <button
            onClick={loadProfits}
            className="bg-slate-800 hover:bg-slate-700 px-3 h-8 rounded-md text-[10px] font-black text-white"
          >
            تحديث
          </button>
        </div>

        {loading ? (
          <EmptyState text="جاري تحميل الأرباح..." />
        ) : orders.length === 0 ? (
          <EmptyState text="لا توجد أرباح حالياً" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="p-2 text-right">الزبون</th>
                  <th className="p-2 text-right">الهاتف</th>
                  <th className="p-2 text-right">المنتج</th>
                  <th className="p-2 text-right">سعر الطلب</th>
                  <th className="p-2 text-right">الربح</th>
                  <th className="p-2 text-right">التاريخ</th>
                </tr>
              </thead>

              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-t border-slate-800 text-slate-200">
                    <td className="p-2 font-bold">{order.customer_name || "-"}</td>
                    <td className="p-2">{order.phone || "-"}</td>
                    <td className="p-2">{order.product_name || "-"}</td>
                    <td className="p-2">
                      {formatMoney(order.order_price)}
                    </td>
                    <td className="p-2 font-black text-emerald-400">
                      {formatMoney(order.profit_amount)}
                    </td>
                    <td className="p-2 text-slate-400">
                      {formatDate(order.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfitCard({ title, value, color, noCurrency = false }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
      <p className="text-[9px] text-slate-500 mb-1">{title}</p>
      <h3 className={`text-[13px] font-black ${color}`}>
        {Number(value || 0).toLocaleString()}
        {!noCurrency && " د.ع"}
      </h3>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="p-6 text-center text-[11px] text-slate-400">
      {text}
    </div>
  );
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString()} د.ع`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ar-IQ");
}