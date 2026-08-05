import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";

import DailyIncome from "./DailyIncome";
import Expenses from "./Expenses";
import Rentals from "./Rentals";
import MobileReports from "./MobileReports";
import CustomerDebts from "./CustomerDebts";
import Maintenance from "./Maintenance";
import Inventory from "./Inventory";

export default function MobileOfficeDashboard({ project, permissions, isAdmin }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);

  const [income, setIncome] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [rentals, setRentals] = useState(0);
  const [debtsRemaining, setDebtsRemaining] = useState(0);
  const [todayIncome, setTodayIncome] = useState(0);
  const [todayExpenses, setTodayExpenses] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState([]);

  const canAdd = isAdmin || permissions?.can_add === true;
  const canEdit = isAdmin || permissions?.can_edit === true;
  const canDelete = isAdmin || permissions?.can_delete === true;
  const canReports = isAdmin || permissions?.can_reports === true;

  useEffect(() => {
    loadDashboard();

    const channel = supabase
      .channel(`mobile-office-${project.id}`)
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

    return () => supabase.removeChannel(channel);
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

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const { data: debtsData } = await supabase
        .from("mobile_customer_debts")
        .select("remaining_amount")
        .eq("project_id", project.id);

      const all = data || [];

      setIncome(
        all
          .filter((item) => item.type === "income")
          .reduce((sum, item) => sum + Number(item.amount_received || 0), 0)
      );

      setExpenses(
        all
          .filter((item) => item.type === "expense")
          .reduce((sum, item) => sum + Number(item.amount_received || 0), 0)
      );

      setRentals(
        all
          .filter((item) => item.service_type === "mobile_rental")
          .reduce((sum, item) => sum + Number(item.amount_received || 0), 0)
      );

      setDebtsRemaining(
        (debtsData || []).reduce(
          (sum, item) => sum + Number(item.remaining_amount || 0),
          0
        )
      );

      const todayTransactions = all.filter(
        (item) => item.created_at?.slice(0, 10) === today
      );

      setTodayIncome(
        todayTransactions
          .filter((item) => item.type === "income")
          .reduce((sum, item) => sum + Number(item.amount_received || 0), 0)
      );

      setTodayExpenses(
        todayTransactions
          .filter((item) => item.type === "expense")
          .reduce((sum, item) => sum + Number(item.amount_received || 0), 0)
      );

      setRecentTransactions(all.slice(0, 8));
    } catch (err) {
      console.log(err);
      alert("فشل تحميل داشبورد المكتب");
    } finally {
      setLoading(false);
    }
  }

  const netProfit = income - expenses;
  const todayNet = todayIncome - todayExpenses;

  return (
    <div className="space-y-2">
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-1 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          <TabButton label="الرئيسية" active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} color="bg-blue-600" />
          <TabButton label="الدخل" active={activeTab === "income"} onClick={() => setActiveTab("income")} color="bg-green-600" />
          <TabButton label="الصرفيات" active={activeTab === "expenses"} onClick={() => setActiveTab("expenses")} color="bg-red-600" />
          <TabButton label="الإيجارات" active={activeTab === "rentals"} onClick={() => setActiveTab("rentals")} color="bg-orange-600" />
          <TabButton label="الصيانة" active={activeTab === "maintenance"} onClick={() => setActiveTab("maintenance")} color="bg-cyan-600" />
          <TabButton label="المخزن" active={activeTab === "inventory"} onClick={() => setActiveTab("inventory")} color="bg-emerald-600" />
          <TabButton label="الديون" active={activeTab === "debts"} onClick={() => setActiveTab("debts")} color="bg-red-600" />

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
              <div className="text-[10px] text-slate-500">جاري تحميل الداشبورد...</div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-1">
                <StatCard title="إجمالي الدخل" value={income} color="text-green-400" />
                <StatCard title="إجمالي الصرف" value={expenses} color="text-red-400" />
                <StatCard title="الصافي" value={netProfit} color="text-blue-400" />
                <StatCard title="الإيجارات" value={rentals} color="text-orange-400" />
                <StatCard title="ديون باقية" value={debtsRemaining} color="text-red-400" />
                <StatCard title="صافي اليوم" value={todayNet} color="text-cyan-400" />
              </div>

              <div className="grid grid-cols-2 gap-1">
                <MiniStat title="دخل اليوم" value={todayIncome} color="text-green-400" />
                <MiniStat title="صرف اليوم" value={todayExpenses} color="text-red-400" />
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
                <h2 className="text-sm font-black mb-2">آخر العمليات</h2>

                {recentTransactions.length === 0 ? (
                  <div className="text-center py-6 text-[10px] text-slate-500">لا توجد عمليات</div>
                ) : (
                  <div className="space-y-1">
                    {recentTransactions.map((item) => (
                      <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-md p-2">
                        <div className="flex items-center justify-between gap-2">
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
                            <p className="text-[8px] text-slate-500">{item.notes || "بدون ملاحظات"}</p>
                          </div>

                          <div className="text-left min-w-[80px]">
                            <h2
                              className={`text-[10px] font-black ${
                                item.type === "income" ? "text-green-400" : "text-red-400"
                              }`}
                            >
                              {Number(item.amount_received || 0).toLocaleString()}
                            </h2>
                            <p className="text-[8px] text-slate-500">
                              {new Date(item.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {activeTab === "income" && (
        <DailyIncome project={project} canAdd={canAdd} canEdit={canEdit} canDelete={canDelete} />
      )}

      {activeTab === "expenses" && (
        <Expenses project={project} canAdd={canAdd} canEdit={canEdit} canDelete={canDelete} />
      )}

      {activeTab === "rentals" && (
        <Rentals project={project} canAdd={canAdd} canEdit={canEdit} canDelete={canDelete} />
      )}

      {activeTab === "debts" && (
        <CustomerDebts project={project} canAdd={canAdd} canEdit={canEdit} canDelete={canDelete} />
      )}

      {activeTab === "maintenance" && (
        <Maintenance
          project={project}
          canAdd={canAdd}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}

      {activeTab === "inventory" && (
        <Inventory
          project={project}
          canAdd={canAdd}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}

      {activeTab === "reports" && canReports && (
        <MobileReports project={project} />
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

function MiniStat({ title, value, color }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
      <p className="text-[8px] text-slate-500 mb-1">{title}</p>
      <h2 className={`text-[10px] font-black ${color}`}>
        {Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}