import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";

export default function MobileReports({ project }) {
  const today = new Date().toISOString().slice(0, 10);

  const firstDayOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )
    .toISOString()
    .slice(0, 10);

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [fromDate, setFromDate] = useState(firstDayOfMonth);
  const [toDate, setToDate] = useState(today);

  useEffect(() => {
    loadReports();
  }, [fromDate, toDate]);

  async function loadReports() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("project_id", project.id)
        .gte("created_at", `${fromDate}T00:00:00`)
        .lte("created_at", `${toDate}T23:59:59`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTransactions(data || []);
    } catch (err) {
      console.log(err);
      alert("فشل تحميل التقارير");
    } finally {
      setLoading(false);
    }
  }

  function setTodayFilter() {
    setFromDate(today);
    setToDate(today);
  }

  function setMonthFilter() {
    setFromDate(firstDayOfMonth);
    setToDate(today);
  }

  const income = transactions
    .filter((item) => item.type === "income")
    .reduce(
      (sum, item) => sum + Number(item.amount_received || 0),
      0
    );

  const expenses = transactions
    .filter((item) => item.type === "expense")
    .reduce(
      (sum, item) => sum + Number(item.amount_received || 0),
      0
    );

  const net = income - expenses;

  const rentals = transactions
    .filter((item) => item.service_type === "mobile_rental")
    .reduce(
      (sum, item) => sum + Number(item.amount_received || 0),
      0
    );

  const dailyIncome = transactions
    .filter((item) => item.service_type === "mobile_daily_income")
    .reduce(
      (sum, item) => sum + Number(item.amount_received || 0),
      0
    );

  const groupedDays = Object.values(
    transactions.reduce((acc, item) => {
      const day = item.created_at?.slice(0, 10);

      if (!acc[day]) {
        acc[day] = {
          date: day,
          income: 0,
          expenses: 0,
          operations: 0,
        };
      }

      if (item.type === "income") {
        acc[day].income += Number(item.amount_received || 0);
      }

      if (item.type === "expense") {
        acc[day].expenses += Number(item.amount_received || 0);
      }

      acc[day].operations += 1;

      return acc;
    }, {})
  ).sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-sm font-black">تقارير المكتب</h1>

          <p className="text-[9px] text-slate-500">
            تقارير الأرباح والخسائر اليومية
          </p>
        </div>
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
          onClick={setTodayFilter}
          className="bg-blue-600 hover:bg-blue-700 rounded-md text-[10px] font-black"
        >
          اليوم
        </button>

        <button
          onClick={setMonthFilter}
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-1 mb-2">
            <StatCard
              title="الدخل"
              value={income}
              color="text-green-400"
            />

            <StatCard
              title="الصرف"
              value={expenses}
              color="text-red-400"
            />

            <StatCard
              title="الصافي"
              value={net}
              color="text-blue-400"
            />

            <StatCard
              title="الإيجارات"
              value={rentals}
              color="text-orange-400"
            />

            <StatCard
              title="الدخل اليومي"
              value={dailyIncome}
              color="text-cyan-400"
            />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-md p-2">
            <h2 className="text-[11px] font-black mb-2">
              تفصيل الأيام
            </h2>

            {groupedDays.length === 0 ? (
              <div className="text-center py-6 text-[10px] text-slate-500">
                لا توجد بيانات
              </div>
            ) : (
              <div className="space-y-1">
                {groupedDays.map((day) => (
                  <div
                    key={day.date}
                    className="grid grid-cols-4 gap-1 bg-slate-950 rounded-md p-2"
                  >
                    <MiniCard
                      title="التاريخ"
                      value={day.date}
                    />

                    <MiniCard
                      title="الدخل"
                      value={day.income}
                      color="text-green-400"
                    />

                    <MiniCard
                      title="الصرف"
                      value={day.expenses}
                      color="text-red-400"
                    />

                    <MiniCard
                      title="الصافي"
                      value={day.income - day.expenses}
                      color="text-blue-400"
                    />
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

function StatCard({ title, value, color }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-md p-2">
      <p className="text-[8px] text-slate-500 mb-1">
        {title}
      </p>

      <h2 className={`text-[10px] font-black ${color}`}>
        {Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}

function MiniCard({
  title,
  value,
  color = "text-white",
}) {
  return (
    <div>
      <p className="text-[8px] text-slate-500 mb-1">
        {title}
      </p>

      <h2 className={`text-[9px] font-black ${color}`}>
        {typeof value === "number"
          ? value.toLocaleString()
          : value}
      </h2>
    </div>
  );
}