import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { notifyTelegramOperation } from "../../services/supabase/telegram";

export default function Expenses({
  project,
  canAdd = true,
  canDelete = true,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseType, setExpenseType] = useState("general");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadExpenses();
  }, []);

  async function loadExpenses() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("project_id", project.id)
        .eq("type", "expense")
        .neq("service_type", "mobile_rental")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setItems(data || []);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();

    if (!canAdd) {
      alert("ليس لديك صلاحية الإضافة");
      return;
    }

    if (submitting) return;

    if (!amount || Number(amount) <= 0) {
      alert("اكتب مبلغ صحيح");
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const titleValue = title.trim() || "مصروف";
      const amountValue = Number(amount);
      const notesValue = notes.trim() || null;

      const { error } = await supabase.from("transactions").insert([
        {
          project_id: project.id,
          user_id: user.id,
          type: "expense",
          service_type: expenseType,
          title: titleValue,
          amount_received: amountValue,
          notes: notesValue,
        },
      ]);

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "transactions",
        action: "create",
        title: "إضافة صرفية مكتب",
        description: `${expenseLabel(expenseType)} - ${titleValue} - ${
          notesValue || "بدون ملاحظات"
        }`,
        amount: amountValue,
      });

      setTitle("");
      setAmount("");
      setExpenseType("general");
      setNotes("");

      await loadExpenses();
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل إضافة المصروف");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteExpense(item) {
    if (!canDelete) {
      alert("ليس لديك صلاحية الحذف");
      return;
    }

    const ok = confirm("هل تريد حذف هذا المصروف؟");
    if (!ok) return;

    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", item.id)
        .eq("project_id", project.id)
        .eq("type", "expense");

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "transactions",
        action: "delete",
        title: "حذف صرفية مكتب",
        description: `${expenseLabel(item.service_type)} - ${
          item.title || "مصروف"
        } - ${item.notes || "بدون ملاحظات"}`,
        amount: Number(item.amount_received || 0),
      });

      await loadExpenses();
    } catch (err) {
      console.log(err);
      alert("فشل حذف المصروف");
    }
  }

  function expenseLabel(type) {
    switch (type) {
      case "mobile_salary":
        return "راتب";
      case "mobile_electricity":
        return "كهرباء";
      case "mobile_maintenance":
        return "صيانة";
      case "mobile_purchase":
        return "شراء";
      case "mobile_delivery":
        return "نقل";
      default:
        return "عام";
    }
  }

  const totalExpenses = items.reduce(
    (sum, item) => sum + Number(item.amount_received || 0),
    0
  );

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-sm font-black">الصرفيات</h1>

          <p className="text-[9px] text-slate-500">
            مصاريف مكتب الحويجة للموبايل
          </p>
        </div>

        <div className="bg-red-600 rounded-md px-2 py-1 text-[10px] font-black">
          {totalExpenses.toLocaleString()}
        </div>
      </div>

      {canAdd && (
        <form onSubmit={handleAdd} className="grid grid-cols-5 gap-1 mb-2">
          <input
            type="text"
            placeholder="العنوان"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
          />

          <input
            type="number"
            placeholder="المبلغ"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
          />

          <select
            value={expenseType}
            onChange={(e) => setExpenseType(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
          >
            <option value="general">عام</option>
            <option value="mobile_salary">راتب</option>
            <option value="mobile_electricity">كهرباء</option>
            <option value="mobile_maintenance">صيانة</option>
            <option value="mobile_purchase">شراء</option>
            <option value="mobile_delivery">نقل</option>
          </select>

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
        </form>
      )}

      {loading ? (
        <div className="text-center py-6 text-[10px] text-slate-500">
          جاري التحميل...
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-6 text-[10px] text-slate-500">
          لا توجد صرفيات
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-800 rounded-md p-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-[11px] font-black leading-none">
                    {item.title}
                  </h2>

                  <p className="text-[9px] text-slate-500 mt-1">
                    {expenseLabel(item.service_type)} -{" "}
                    {item.notes || "بدون ملاحظات"}
                  </p>
                </div>

                <div className="text-left min-w-[90px]">
                  <h2 className="text-xs font-black text-red-400">
                    {Number(item.amount_received || 0).toLocaleString()}
                  </h2>

                  <p className="text-[8px] text-slate-500">
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => deleteExpense(item)}
                      className="mt-1 w-full h-6 bg-red-600 hover:bg-red-700 rounded-md text-[9px] font-black"
                    >
                      حذف
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}