import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { notifyTelegramOperation } from "../../services/supabase/telegram";
import DebtDetails from "./DebtDetails";

export default function CustomerDebts({
  project,
  canAdd = true,
  canDelete = true,
}) {
  const [debts, setDebts] = useState([]);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadDebts();
  }, []);

  async function loadDebts() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("mobile_customer_debts")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setDebts(data || []);

      if (selectedDebt) {
        const updated = (data || []).find((item) => item.id === selectedDebt.id);
        if (updated) setSelectedDebt(updated);
      }
    } catch (err) {
      console.log(err);
      alert("فشل تحميل الديون");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddDebt(e) {
    e.preventDefault();

    if (!canAdd) {
      alert("ليس لديك صلاحية الإضافة");
      return;
    }

    if (!customerName.trim() || !totalAmount || Number(totalAmount) <= 0) {
      alert("اكتب اسم الزبون والمبلغ الكلي");
      return;
    }

    try {
      setSubmitting(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const customerNameValue = customerName.trim();
      const customerPhoneValue = customerPhone.trim() || null;
      const deviceNameValue = deviceName.trim() || null;
      const notesValue = notes.trim() || null;

      const total = Number(totalAmount);
      const paid = Number(paidAmount || 0);
      const remaining = Math.max(total - paid, 0);

      const { error } = await supabase.from("mobile_customer_debts").insert([
        {
          project_id: project.id,
          user_id: user.id,
          customer_name: customerNameValue,
          customer_phone: customerPhoneValue,
          device_name: deviceNameValue,
          total_amount: total,
          paid_amount: paid,
          remaining_amount: remaining,
          due_date: dueDate || null,
          status: remaining <= 0 ? "paid" : "open",
          notes: notesValue,
        },
      ]);

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "mobile_customer_debts",
        action: "create",
        title: "إضافة دين زبون",
        description: `${customerNameValue} - ${deviceNameValue || "بدون جهاز"} - المتبقي: ${remaining.toLocaleString("en-US")}`,
        amount: total,
      });

      setCustomerName("");
      setCustomerPhone("");
      setDeviceName("");
      setTotalAmount("");
      setPaidAmount("");
      setDueDate("");
      setNotes("");

      await loadDebts();
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل إضافة الدين");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteDebt(debt) {
    if (!canDelete) {
      alert("ليس لديك صلاحية الحذف");
      return;
    }

    const ok = confirm("هل تريد حذف هذا الدين وكل دفعاته؟");
    if (!ok) return;

    try {
      const { error } = await supabase
        .from("mobile_customer_debts")
        .delete()
        .eq("id", debt.id)
        .eq("project_id", project.id);

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "mobile_customer_debts",
        action: "delete",
        title: "حذف دين زبون",
        description: `${debt.customer_name} - ${debt.device_name || "بدون جهاز"} - المتبقي: ${Number(debt.remaining_amount || 0).toLocaleString("en-US")}`,
        amount: Number(debt.total_amount || 0),
      });

      await loadDebts();
    } catch (err) {
      console.log(err);
      alert("فشل حذف الدين");
    }
  }

  function statusLabel(status) {
    switch (status) {
      case "paid":
        return "مكتمل";
      case "overdue":
        return "متأخر";
      default:
        return "مفتوح";
    }
  }

  const totalDebts = debts.reduce(
    (sum, item) => sum + Number(item.total_amount || 0),
    0
  );

  const totalPaid = debts.reduce(
    (sum, item) => sum + Number(item.paid_amount || 0),
    0
  );

  const totalRemaining = debts.reduce(
    (sum, item) => sum + Number(item.remaining_amount || 0),
    0
  );

  if (selectedDebt) {
    return (
      <DebtDetails
        debt={selectedDebt}
        canAdd={canAdd}
        onBack={() => setSelectedDebt(null)}
        onRefresh={loadDebts}
      />
    );
  }

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-sm font-black">ديون الزبائن</h1>
          <p className="text-[9px] text-slate-500">
            متابعة مبالغ الأجهزة والدفعات
          </p>
        </div>

        <div className="bg-red-600 rounded-md px-2 py-1 text-[10px] font-black">
          {totalRemaining.toLocaleString()}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 mb-2">
        <MiniStat title="الكلي" value={totalDebts} color="text-green-400" />
        <MiniStat title="المدفوع" value={totalPaid} color="text-blue-400" />
        <MiniStat title="الباقي" value={totalRemaining} color="text-red-400" />
      </div>

      {canAdd && (
        <form onSubmit={handleAddDebt} className="space-y-1 mb-2">
          <div className="grid grid-cols-3 gap-1">
            <input
              type="text"
              placeholder="اسم الزبون"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />

            <input
              type="text"
              placeholder="الهاتف"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />

            <input
              type="text"
              placeholder="الجهاز"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />
          </div>

          <div className="grid grid-cols-5 gap-1">
            <input
              type="number"
              placeholder="الكلي"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />

            <input
              type="number"
              placeholder="المدفوع"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />

            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />

            <input
              type="text"
              placeholder="ملاحظات"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />

            <button
              disabled={submitting}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-md text-[10px] font-black"
            >
              {submitting ? "جاري..." : "إضافة"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-6 text-[10px] text-slate-500">
          جاري التحميل...
        </div>
      ) : debts.length === 0 ? (
        <div className="text-center py-6 text-[10px] text-slate-500">
          لا توجد ديون
        </div>
      ) : (
        <div className="space-y-1">
          {debts.map((debt) => (
            <div
              key={debt.id}
              className="bg-slate-900 border border-slate-800 rounded-md p-2"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div>
                  <h2 className="text-[11px] font-black leading-none">
                    {debt.customer_name}
                  </h2>

                  <p className="text-[9px] text-slate-500 mt-1">
                    {debt.device_name || "بدون جهاز"} - {debt.customer_phone || "-"}
                  </p>
                </div>

                <div className="text-left">
                  <h2 className="text-xs font-black text-red-400">
                    {Number(debt.remaining_amount || 0).toLocaleString()}
                  </h2>

                  <p className="text-[8px] text-slate-500">
                    {statusLabel(debt.status)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-5 gap-1">
                <SmallBox title="الكلي" value={debt.total_amount} />
                <SmallBox title="المدفوع" value={debt.paid_amount} />
                <SmallBox title="الباقي" value={debt.remaining_amount} color="text-red-400" />

                <button
                  type="button"
                  onClick={() => setSelectedDebt(debt)}
                  className="bg-blue-600 hover:bg-blue-700 rounded-md h-7 text-[9px] font-black"
                >
                  تفاصيل
                </button>

                {canDelete && (
                  <button
                    type="button"
                    onClick={() => deleteDebt(debt)}
                    className="bg-red-600 hover:bg-red-700 rounded-md h-7 text-[9px] font-black"
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

function SmallBox({ title, value, color = "text-white" }) {
  return (
    <div className="bg-slate-950 rounded-md p-1">
      <p className="text-[8px] text-slate-500">{title}</p>
      <h2 className={`text-[9px] font-black truncate ${color}`}>
        {Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}