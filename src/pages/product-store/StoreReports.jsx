import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";

export default function StoreReports({ project }) {
  const today = new Date().toISOString().slice(0, 10);
  const firstDayOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )
    .toISOString()
    .slice(0, 10);

  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState(firstDayOfMonth);
  const [toDate, setToDate] = useState(today);
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    loadReports();
  }, [fromDate, toDate]);

  async function loadReports() {
    try {
      setLoading(true);

      const { data: transactionsData, error: transactionsError } =
        await supabase
          .from("transactions")
          .select("*")
          .eq("project_id", project.id)
          .gte("created_at", `${fromDate}T00:00:00`)
          .lte("created_at", `${toDate}T23:59:59`)
          .order("created_at", { ascending: false });

      if (transactionsError) throw transactionsError;

      const { data: productsData, error: productsError } = await supabase
        .from("store_products")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      if (productsError) throw productsError;

      setTransactions(transactionsData || []);
      setProducts(productsData || []);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل تحميل تقارير المتجر");
    } finally {
      setLoading(false);
    }
  }

  const income = transactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount_received || 0), 0);

  const expenses = transactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount_received || 0), 0);

  const profit = transactions.reduce(
    (sum, item) => sum + Number(item.company_profit || 0),
    0
  );

  const stockValue = products.reduce(
    (sum, item) =>
      sum + Number(item.purchase_price || 0) * Number(item.quantity || 0),
    0
  );

  const expectedSales = products.reduce(
    (sum, item) =>
      sum + Number(item.sale_price || 0) * Number(item.quantity || 0),
    0
  );

  const expectedProfit = expectedSales - stockValue;

  const lowStock = products.filter(
    (item) => Number(item.quantity || 0) <= 3
  ).length;

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-sm font-black">تقارير المتجر</h1>
          <p className="text-[9px] text-slate-500">
            تقارير المبيعات والمخزون والأرباح
          </p>
        </div>

        <button
          onClick={loadReports}
          className="bg-slate-800 hover:bg-slate-700 rounded-md px-2 h-7 text-[9px] font-black"
        >
          تحديث
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-1 mb-2">
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
        />

        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
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

      {loading ? (
        <div className="text-center py-6 text-[10px] text-slate-500">
          جاري التحميل...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1 mb-2">
            <ReportCard title="الدخل" value={income} color="text-green-400" />
            <ReportCard title="الصرف" value={expenses} color="text-red-400" />
            <ReportCard title="الربح المحقق" value={profit} color="text-blue-400" />
            <ReportCard title="قيمة المخزون" value={stockValue} color="text-cyan-400" />
            <ReportCard title="قيمة البيع" value={expectedSales} color="text-emerald-400" />
            <ReportCard title="ربح متوقع" value={expectedProfit} color="text-purple-400" />
            <ReportCard title="المنتجات" value={products.length} color="text-orange-400" simple />
            <ReportCard title="ناقص" value={lowStock} color="text-yellow-400" simple />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-md p-2">
            <h2 className="text-[11px] font-black mb-2">العمليات</h2>

            {transactions.length === 0 ? (
              <div className="text-center py-6 text-[10px] text-slate-500">
                لا توجد عمليات
              </div>
            ) : (
              <div className="space-y-1">
                {transactions.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-950 border border-slate-800 rounded-md p-2 flex items-center justify-between"
                  >
                    <div>
                      <h3 className="text-[10px] font-black">{item.title}</h3>
                      <p className="text-[8px] text-slate-500">
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <h3
                      className={`text-[10px] font-black ${
                        item.type === "income"
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {Number(item.amount_received || 0).toLocaleString()}
                    </h3>
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

function ReportCard({ title, value, color, simple = false }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-md p-2">
      <p className="text-[8px] text-slate-500 mb-1">{title}</p>
      <h2 className={`text-[10px] font-black ${color}`}>
        {simple ? value : Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}