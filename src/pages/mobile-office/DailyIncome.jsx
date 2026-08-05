import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { notifyTelegramOperation } from "../../services/supabase/telegram";

export default function DailyIncome({
  project,
  canAdd = true,
  canDelete = true,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadIncome();
  }, []);

  async function loadIncome() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("project_id", project.id)
        .eq("type", "income")
        .eq("service_type", "mobile_daily_income")
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

      const amountValue = Number(amount);
      const titleValue = title.trim() || "دخل يومي";
      const notesValue = notes.trim() || null;

      const { error } = await supabase.from("transactions").insert([
        {
          project_id: project.id,
          user_id: user.id,
          type: "income",
          service_type: "mobile_daily_income",
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
        title: "إضافة دخل يومي",
        description: `${titleValue} - ${notesValue || "بدون ملاحظات"}`,
        amount: amountValue,
      });

      setTitle("");
      setAmount("");
      setNotes("");

      await loadIncome();
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل إضافة الدخل");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteIncome(item) {
    if (!canDelete) {
      alert("ليس لديك صلاحية الحذف");
      return;
    }

    const ok = confirm("هل تريد حذف هذا الدخل؟");
    if (!ok) return;

    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", item.id)
        .eq("project_id", project.id)
        .eq("type", "income")
        .eq("service_type", "mobile_daily_income");

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "transactions",
        action: "delete",
        title: "حذف دخل يومي",
        description: `${item.title || "دخل يومي"} - ${item.notes || "بدون ملاحظات"}`,
        amount: Number(item.amount_received || 0),
      });

      await loadIncome();
    } catch (err) {
      console.log(err);
      alert("فشل حذف الدخل");
    }
  }

  const totalIncome = items.reduce(
    (sum, item) => sum + Number(item.amount_received || 0),
    0
  );

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-sm font-black">الدخل اليومي</h1>
          <p className="text-[9px] text-slate-500">
            مبيعات وصافي دخل مكتب الموبايل
          </p>
        </div>

        <div className="bg-green-600 rounded-md px-2 py-1 text-[10px] font-black">
          {totalIncome.toLocaleString()}
        </div>
      </div>

      {canAdd && (
        <form onSubmit={handleAdd} className="grid grid-cols-4 gap-1 mb-2">
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

          <input
            type="text"
            placeholder="ملاحظات"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
          />

          <button
            disabled={submitting}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-md text-[10px] font-black"
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
          لا يوجد دخل بعد
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
                    {item.notes || "بدون ملاحظات"}
                  </p>
                </div>

                <div className="text-left min-w-[90px]">
                  <h2 className="text-xs font-black text-green-400">
                    {Number(item.amount_received || 0).toLocaleString()}
                  </h2>

                  <p className="text-[8px] text-slate-500">
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => deleteIncome(item)}
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