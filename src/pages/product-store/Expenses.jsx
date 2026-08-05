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

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    loadExpenses();
  }, []);

  async function loadExpenses() {
    setLoading(true);

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("project_id", project.id)
      .eq("type", "expense")
      .eq("service_type", "store_expense")
      .order("created_at", { ascending: false });

    if (!error) setItems(data || []);

    setLoading(false);
  }

  async function addExpense(e) {
    e.preventDefault();

    if (!canAdd) {
      alert("ليس لديك صلاحية");
      return;
    }

    if (!title.trim() || !amount || Number(amount) <= 0) {
      alert("اكتب العنوان والمبلغ");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const titleValue = title.trim();
    const amountValue = Number(amount);

    const { error } = await supabase.from("transactions").insert([
      {
        project_id: project.id,
        user_id: user.id,
        type: "expense",
        service_type: "store_expense",
        title: titleValue,
        amount_received: amountValue,
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

    await notifyTelegramOperation({
      projectId: project.id,
      tableName: "transactions",
      action: "create",
      title: "إضافة صرفية متجر",
      description: titleValue,
      amount: amountValue,
    });

    setTitle("");
    setAmount("");
    loadExpenses();
  }

  async function deleteExpense(item) {
    if (!canDelete) return;

    const ok = confirm("حذف الصرفية؟");
    if (!ok) return;

    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", item.id)
      .eq("project_id", project.id);

    if (error) {
      alert(error.message);
      return;
    }

    await notifyTelegramOperation({
      projectId: project.id,
      tableName: "transactions",
      action: "delete",
      title: "حذف صرفية متجر",
      description: item.title || "صرفية متجر",
      amount: Number(item.amount_received || 0),
    });

    loadExpenses();
  }

  const total = items.reduce(
    (sum, item) => sum + Number(item.amount_received || 0),
    0
  );

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-sm font-black">صرفيات المتجر</h1>
          <p className="text-[9px] text-slate-500">مصاريف المخزن والمتجر</p>
        </div>

        <div className="bg-red-600 rounded-md px-2 py-1 text-[10px] font-black">
          {total.toLocaleString()}
        </div>
      </div>

      {canAdd && (
        <form onSubmit={addExpense} className="grid grid-cols-3 gap-1 mb-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="العنوان"
            className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
          />

          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="المبلغ"
            className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
          />

          <button className="bg-red-600 hover:bg-red-700 rounded-md text-[10px] font-black">
            إضافة
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
              className="bg-slate-900 border border-slate-800 rounded-md p-2 flex items-center justify-between"
            >
              <div>
                <h2 className="text-[11px] font-black">{item.title}</h2>
                <p className="text-[8px] text-slate-500">
                  {new Date(item.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="text-left">
                <h2 className="text-[10px] font-black text-red-400">
                  {Number(item.amount_received || 0).toLocaleString()}
                </h2>

                {canDelete && (
                  <button
                    onClick={() => deleteExpense(item)}
                    className="mt-1 bg-red-600 hover:bg-red-700 px-2 h-6 rounded-md text-[8px] font-black"
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