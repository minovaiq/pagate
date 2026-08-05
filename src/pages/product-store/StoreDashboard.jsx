import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";

import Products from "./Products";
import Income from "./Income";
import Expenses from "./Expenses";
import StoreReports from "./StoreReports";

export default function StoreDashboard({ project, permissions, isAdmin }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    productsCount: 0,
    stockValue: 0,
    income: 0,
    expenses: 0,
    profit: 0,
    todayIncome: 0,
    todayExpenses: 0,
    lowStockCount: 0,
  });

  const [recent, setRecent] = useState([]);

  const canAdd = isAdmin || permissions?.can_add === true;
  const canEdit = isAdmin || permissions?.can_edit === true;
  const canDelete = isAdmin || permissions?.can_delete === true;
  const canReports = isAdmin || permissions?.can_reports === true;

  useEffect(() => {
    loadDashboard();

    const channel = supabase
      .channel(`product-store-${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
          filter: `project_id=eq.${project.id}`,
        },
        () => loadDashboard()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [project.id]);

  useEffect(() => {
    if (activeTab === "reports" && !canReports) {
      setActiveTab("dashboard");
    }
  }, [activeTab, canReports]);

  async function loadDashboard() {
    try {
      setLoading(true);

      const today = new Date().toISOString().slice(0, 10);

      const { data: productsData } = await supabase
        .from("store_products")
        .select("*")
        .eq("project_id", project.id);

      const { data: transactionsData } = await supabase
        .from("transactions")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      const products = productsData || [];
      const transactions = transactionsData || [];

      const stockValue = products.reduce(
        (sum, item) =>
          sum + Number(item.purchase_price || 0) * Number(item.quantity || 0),
        0
      );

      const lowStockCount = products.filter(
        (item) => Number(item.quantity || 0) <= 3
      ).length;

      const income = transactions
        .filter((item) => item.type === "income")
        .reduce((sum, item) => sum + Number(item.amount_received || 0), 0);

      const expenses = transactions
        .filter((item) => item.type === "expense")
        .reduce((sum, item) => sum + Number(item.amount_received || 0), 0);

      const todayTransactions = transactions.filter(
        (item) => item.created_at?.slice(0, 10) === today
      );

      const todayIncome = todayTransactions
        .filter((item) => item.type === "income")
        .reduce((sum, item) => sum + Number(item.amount_received || 0), 0);

      const todayExpenses = todayTransactions
        .filter((item) => item.type === "expense")
        .reduce((sum, item) => sum + Number(item.amount_received || 0), 0);

      setStats({
        productsCount: products.length,
        stockValue,
        income,
        expenses,
        profit: income - expenses,
        todayIncome,
        todayExpenses,
        lowStockCount,
      });

      setRecent(transactions.slice(0, 8));
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل تحميل داشبورد المتجر");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-1 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          <TabButton label="الرئيسية" active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} color="bg-blue-600" />
          <TabButton label="المنتجات" active={activeTab === "products"} onClick={() => setActiveTab("products")} color="bg-green-600" />
          <TabButton label="الدخل" active={activeTab === "income"} onClick={() => setActiveTab("income")} color="bg-emerald-600" />
          <TabButton label="الصرفيات" active={activeTab === "expenses"} onClick={() => setActiveTab("expenses")} color="bg-red-600" />

          {canReports && (
            <TabButton label="التقارير" active={activeTab === "reports"} onClick={() => setActiveTab("reports")} color="bg-purple-600" />
          )}

          <button
            onClick={loadDashboard}
            className="bg-slate-800 hover:bg-slate-700 px-3 h-8 rounded-md text-[10px] font-black whitespace-nowrap"
          >
            تحديث
          </button>
        </div>
      </div>

      {activeTab === "dashboard" && (
        <>
          {loading ? (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-6 text-center">
              <div className="text-[10px] text-slate-500">
                جاري تحميل داشبورد المتجر...
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
                <StatCard title="عدد المنتجات" value={stats.productsCount} color="text-green-400" />
                <StatCard title="قيمة المخزون" value={stats.stockValue} color="text-cyan-400" />
                <StatCard title="الدخل" value={stats.income} color="text-green-400" />
                <StatCard title="الصرف" value={stats.expenses} color="text-red-400" />
                <StatCard title="الربح" value={stats.profit} color="text-blue-400" />
                <StatCard title="دخل اليوم" value={stats.todayIncome} color="text-emerald-400" />
                <StatCard title="صرف اليوم" value={stats.todayExpenses} color="text-orange-400" />
                <StatCard title="منتجات ناقصة" value={stats.lowStockCount} color="text-yellow-400" />
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
                <h2 className="text-sm font-black mb-2">آخر العمليات</h2>

                {recent.length === 0 ? (
                  <div className="text-center py-6 text-[10px] text-slate-500">
                    لا توجد عمليات
                  </div>
                ) : (
                  <div className="space-y-1">
                    {recent.map((item) => (
                      <div
                        key={item.id}
                        className="bg-slate-900 border border-slate-800 rounded-md p-2 flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-1 mb-1">
                            <span
                              className={`px-2 py-1 rounded-md text-[8px] font-black ${
                                item.type === "income" ? "bg-green-600" : "bg-red-600"
                              }`}
                            >
                              {item.type === "income" ? "دخل" : "صرف"}
                            </span>

                            <h2 className="text-[10px] font-black">{item.title}</h2>
                          </div>

                          <p className="text-[8px] text-slate-500">
                            {new Date(item.created_at).toLocaleDateString()}
                          </p>
                        </div>

                        <h2
                          className={`text-[10px] font-black ${
                            item.type === "income" ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {Number(item.amount_received || 0).toLocaleString()}
                        </h2>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {activeTab === "products" && (
        <Products
          project={project}
          canAdd={canAdd}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}

      {activeTab === "income" && (
        <Income
          project={project}
          canAdd={canAdd}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}

      {activeTab === "expenses" && (
        <Expenses
          project={project}
          canAdd={canAdd}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}

      {activeTab === "reports" && canReports && (
        <StoreReports project={project} />
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