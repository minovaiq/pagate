import { useState } from "react";
import { supabase } from "../../services/supabase/client";
import { notifyTelegramOperation } from "../../services/supabase/telegram";

export default function AddDebtPaymentModal({
  debt,
  onClose,
  onSaved,
  canAdd = true,
}) {
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault();

    if (!canAdd) {
      alert("ليس لديك صلاحية إضافة دفعة");
      return;
    }

    if (!amount || Number(amount) <= 0) {
      alert("اكتب مبلغ صحيح");
      return;
    }

    try {
      setSaving(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const paymentAmount = Number(amount);
      const notesValue = notes.trim() || null;

      const oldPaid = Number(debt.paid_amount || 0);
      const totalAmount = Number(debt.total_amount || 0);

      const newPaid = oldPaid + paymentAmount;
      const newRemaining = Math.max(totalAmount - newPaid, 0);

      const { error: paymentError } = await supabase
        .from("mobile_customer_debt_payments")
        .insert([
          {
            debt_id: debt.id,
            project_id: debt.project_id,
            user_id: user.id,
            amount: paymentAmount,
            notes: notesValue,
          },
        ]);

      if (paymentError) throw paymentError;

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
        action: "create",
        title: "تسديد دفعة دين",
        description: `${debt.customer_name || "-"} - ${
          debt.device_name || "بدون جهاز"
        } - المتبقي: ${newRemaining.toLocaleString("en-US")} - ${
          notesValue || "بدون ملاحظات"
        }`,
        amount: paymentAmount,
      });

      onSaved();
      onClose();
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل إضافة الدفعة");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-2">
      <form
        onSubmit={handleSave}
        className="bg-slate-900 border border-slate-800 rounded-lg p-2 w-full max-w-sm"
      >
        <h2 className="text-sm font-black mb-2">إضافة دفعة</h2>

        <div className="bg-slate-950 border border-slate-800 rounded-md p-2 mb-2">
          <p className="text-[9px] text-slate-500 mb-1">الزبون</p>
          <h3 className="text-[11px] font-black">
            {debt.customer_name || "-"}
          </h3>

          <p className="text-[9px] text-slate-500 mt-2">
            المتبقي الحالي:{" "}
            <span className="text-red-400 font-black">
              {Number(debt.remaining_amount || 0).toLocaleString()}
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 gap-1">
          <input
            type="number"
            placeholder="مبلغ الدفعة"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
          />

          <input
            type="text"
            placeholder="ملاحظات"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-1 mt-2">
          <button
            disabled={saving || !canAdd}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-md h-8 text-[10px] font-black"
          >
            {saving ? "جاري..." : "حفظ"}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="bg-slate-700 hover:bg-slate-600 rounded-md h-8 text-[10px] font-black"
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}