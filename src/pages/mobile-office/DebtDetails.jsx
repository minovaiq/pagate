import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { notifyTelegramOperation } from "../../services/supabase/telegram";
import AddDebtPaymentModal from "./AddDebtPaymentModal";

export default function DebtDetails({
  debt,
  onBack,
  onRefresh,
  canAdd = true,
  canDelete = true,
}) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);

  useEffect(() => {
    loadPayments();
  }, [debt.id]);

  async function loadPayments() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("mobile_customer_debt_payments")
        .select("*")
        .eq("debt_id", debt.id)
        .eq("project_id", debt.project_id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setPayments(data || []);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل تحميل الدفعات");
    } finally {
      setLoading(false);
    }
  }

  async function refreshAll() {
    await loadPayments();

    if (onRefresh) {
      await onRefresh();
    }
  }

  async function deletePayment(payment) {
    if (!canDelete) {
      alert("ليس لديك صلاحية الحذف");
      return;
    }

    const ok = confirm("هل تريد حذف هذه الدفعة؟");
    if (!ok) return;

    try {
      const paymentAmount = Number(payment.amount || 0);

      const newPaid = Math.max(
        Number(debt.paid_amount || 0) - paymentAmount,
        0
      );

      const newRemaining = Number(debt.total_amount || 0) - newPaid;

      const { error: deleteError } = await supabase
        .from("mobile_customer_debt_payments")
        .delete()
        .eq("id", payment.id)
        .eq("project_id", debt.project_id);

      if (deleteError) throw deleteError;

      const { error: debtError } = await supabase
        .from("mobile_customer_debts")
        .update({
          paid_amount: newPaid,
          remaining_amount: newRemaining,
          status: newRemaining <= 0 ? "paid" : "open",
        })
        .eq("id", debt.id)
        .eq("project_id", debt.project_id);

      if (debtError) throw debtError;

      await notifyTelegramOperation({
        projectId: debt.project_id,
        tableName: "mobile_customer_debt_payments",
        action: "delete",
        title: "حذف دفعة دين",
        description: `${debt.customer_name} - ${
          debt.device_name || "بدون جهاز"
        } - المتبقي الجديد: ${newRemaining.toLocaleString("en-US")} - ${
          payment.notes || "بدون ملاحظات"
        }`,
        amount: paymentAmount,
      });

      await refreshAll();
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل حذف الدفعة");
    }
  }

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-sm font-black">{debt.customer_name}</h1>

          <p className="text-[9px] text-slate-500">
            {debt.device_name || "بدون جهاز"} -{" "}
            {debt.customer_phone || "-"}
          </p>
        </div>

        <button
          onClick={onBack}
          className="bg-slate-800 hover:bg-slate-700 rounded-md px-2 h-7 text-[9px] font-black"
        >
          رجوع
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1 mb-2">
        <MiniBox
          title="الكلي"
          value={debt.total_amount}
          color="text-green-400"
        />

        <MiniBox
          title="المدفوع"
          value={debt.paid_amount}
          color="text-blue-400"
        />

        <MiniBox
          title="الباقي"
          value={debt.remaining_amount}
          color="text-red-400"
        />
      </div>

      {canAdd && Number(debt.remaining_amount || 0) > 0 && (
        <button
          onClick={() => setShowPayment(true)}
          className="w-full bg-green-600 hover:bg-green-700 rounded-md h-8 text-[10px] font-black mb-2"
        >
          إضافة دفعة
        </button>
      )}

      {!canAdd && (
        <div className="bg-slate-900 border border-slate-800 rounded-md p-2 mb-2 text-[9px] text-slate-500 text-center">
          لا توجد صلاحية لإضافة دفعات
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-md p-2">
        <h2 className="text-[11px] font-black mb-2">الدفعات</h2>

        {loading ? (
          <div className="text-center py-6 text-[10px] text-slate-500">
            جاري التحميل...
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-6 text-[10px] text-slate-500">
            لا توجد دفعات
          </div>
        ) : (
          <div className="space-y-1">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="bg-slate-950 border border-slate-800 rounded-md p-2 flex items-center justify-between"
              >
                <div>
                  <h3 className="text-[11px] font-black text-green-400">
                    {Number(payment.amount || 0).toLocaleString()}
                  </h3>

                  <p className="text-[8px] text-slate-500">
                    {payment.notes || "بدون ملاحظات"}
                  </p>
                </div>

                <div className="text-left">
                  <p className="text-[8px] text-slate-500">
                    {new Date(payment.created_at).toLocaleDateString()}
                  </p>

                  {canDelete && (
                    <button
                      onClick={() => deletePayment(payment)}
                      className="mt-1 bg-red-600 hover:bg-red-700 rounded-md px-2 h-6 text-[8px] font-black"
                    >
                      حذف
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPayment && (
        <AddDebtPaymentModal
          debt={debt}
          onClose={() => setShowPayment(false)}
          onSaved={refreshAll}
          canAdd={canAdd}
        />
      )}
    </div>
  );
}

function MiniBox({ title, value, color }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-md p-2">
      <p className="text-[8px] text-slate-500 mb-1">{title}</p>

      <h2 className={`text-[10px] font-black ${color}`}>
        {Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}