import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { notifyTelegramOperation } from "../../services/supabase/telegram";

const formatNumberInput=v=>String(v??"").replace(/\D/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,",");
const parseNumberInput=v=>String(v??"").replace(/,/g,"").replace(/\D/g,"");
export default function Expenses({
  project,
  canAdd = true,
  canDelete = true,
}) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [serviceType, setServiceType] = useState("other");

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
        .order("created_at", { ascending: false });

      if (error) throw error;

      setExpenses(data || []);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddExpense(e) {
    e.preventDefault();

    if (!canAdd) {
      alert("ليس لديك صلاحية الإضافة");
      return;
    }

    if (!title || !amount) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const amountValue = Number(amount);
      const expenseTitle = title.trim();

      const { error } = await supabase.from("transactions").insert([
        {
          project_id: project.id,
          user_id: user.id,
          type: "expense",
          service_type: serviceType,
          title: expenseTitle,
          amount_received: amountValue,
        },
      ]);

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "transactions",
        action: "create",
        title: "إضافة صرفية",
        description: `${expenseTitle} - ${expenseType(serviceType)}`,
        amount: amountValue,
      });

      setTitle("");
      setAmount("");
      setServiceType("other");

      loadExpenses();
    } catch (err) {
      console.log(err);
      alert("فشل إضافة الصرفية");
    }
  }

  async function deleteExpense(item) {
    if (!canDelete) {
      alert("ليس لديك صلاحية الحذف");
      return;
    }

    const ok = confirm("هل تريد حذف هذه الصرفية؟");
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
        title: "حذف صرفية",
        description: `${item.title || "-"} - ${expenseType(item.service_type)}`,
        amount: Number(item.amount_received || 0),
      });

      loadExpenses();
    } catch (err) {
      console.log(err);
      alert("فشل حذف الصرفية");
    }
  }

  const totalExpenses = expenses.reduce(
    (sum, item) => sum + Number(item.amount_received || 0),
    0
  );

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-sm font-black">الصرفيات</h1>
          <p className="text-[9px] text-slate-300">
            إيجارات، رواتب، كهرباء وغيرها
          </p>
        </div>

        <div className="bg-red-600 rounded-md px-2 py-1 text-[10px] font-black">
          {totalExpenses.toLocaleString()}
        </div>
      </div>

      {canAdd && (
        <form
          onSubmit={handleAddExpense}
          className="grid grid-cols-4 gap-1 mb-2"
        >
          <input
            type="text"
            placeholder="العنوان"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
          />

          <input
            type="text"
            inputMode="numeric"
            placeholder="المبلغ"
            value={formatNumberInput(amount)}
            onChange={(e)=>setAmount(parseNumberInput(e.target.value))}
            className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
          />

          <select
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
          >
            <option value="rent">إيجار</option>
            <option value="salary">راتب</option>
            <option value="electricity">كهرباء</option>
            <option value="promotion">ترويج</option>
            <option value="other">أخرى</option>
          </select>

          <button className="bg-red-600 hover:bg-red-700 rounded-md text-[10px] font-black">
            إضافة
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-center py-6 text-[10px] text-slate-300">
          جاري التحميل...
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-6 text-[10px] text-slate-300">
          لا توجد صرفيات
        </div>
      ) : (
        <div className="space-y-1">
          {expenses.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-800 rounded-md p-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-[11px] font-black leading-none">
                    {item.title}
                  </h2>

                  <p className="text-[9px] text-slate-300 mt-1">
                    {expenseType(item.service_type)}
                  </p>
                </div>

                <div className="text-left min-w-[85px]">
                  <h2 className="text-xs font-black text-red-400">
                    {Number(item.amount_received || 0).toLocaleString()}
                  </h2>

                  <p className="text-[8px] text-slate-300">
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

function expenseType(type) {
  switch (type) {
    case "rent":
      return "إيجار";
    case "salary":
      return "راتب";
    case "electricity":
      return "كهرباء";
    case "promotion":
      return "ترويج";
    default:
      return "أخرى";
  }
}