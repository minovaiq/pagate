import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { notifyTelegramOperation } from "../../services/supabase/telegram";

export default function Delegates({
  project,
  canAdd = true,
  canDelete = true,
}) {
  const [delegates, setDelegates] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("zain_cash");
  const [accountNumber, setAccountNumber] = useState("");
  const [linkedUserId, setLinkedUserId] = useState("");
  const [editingDelegateId, setEditingDelegateId] = useState(null);

  useEffect(() => {
    loadDelegates();
  }, [project.id]);

  async function loadDelegates() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("delegates")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .neq("role", "admin")
        .order("created_at", { ascending: false });

      if (usersError) throw usersError;

      setDelegates(data || []);

      setUsers(
        (usersData || []).map((user) => ({
          user_id: user.id,
          profiles: user,
        }))
      );
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل تحميل المندوبين");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();

    if (!canAdd) {
      alert("ليس لديك صلاحية");
      return;
    }

    if (!fullName.trim()) {
      alert("اكتب اسم المندوب");
      return;
    }

    if (!accountNumber.trim()) {
      alert("اكتب رقم الحساب");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const fullNameValue = fullName.trim();
      const phoneValue = phone.trim() || null;
      const accountValue = accountNumber.trim();

      const payload = {
        project_id: project.id,
        user_id: user.id,
        linked_user_id: linkedUserId || null,
        name: fullNameValue,
        full_name: fullNameValue,
        phone: phoneValue,
        payment_method: paymentMethod,
        account_number: accountValue,
      };

      let error;

      if (editingDelegateId) {
        const response = await supabase
          .from("delegates")
          .update(payload)
          .eq("id", editingDelegateId)
          .eq("project_id", project.id);

        error = response.error;
      } else {
        const response = await supabase.from("delegates").insert([payload]);
        error = response.error;
      }

      if (error) throw error;

      const linkedUser = users.find((item) => item.user_id === linkedUserId);

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "delegates",
        action: editingDelegateId ? "update" : "create",
        title: editingDelegateId ? "تعديل مندوب" : "إضافة مندوب",
        description: `${fullNameValue} - ${paymentLabel(paymentMethod)} - ${accountValue}${
          linkedUser
            ? ` - مربوط بـ ${
                linkedUser.profiles?.full_name ||
                linkedUser.profiles?.email ||
                "مستخدم"
              }`
            : ""
        }`,
        amount: 0,
      });

      clearForm();
      await loadDelegates();

      alert(editingDelegateId ? "تم تعديل المندوب" : "تم إضافة المندوب");
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل العملية");
    }
  }

  function handleEdit(delegate) {
    setEditingDelegateId(delegate.id);
    setFullName(delegate.full_name || delegate.name || "");
    setPhone(delegate.phone || "");
    setPaymentMethod(delegate.payment_method || "zain_cash");
    setAccountNumber(delegate.account_number || "");
    setLinkedUserId(delegate.linked_user_id || "");
  }

  function clearForm() {
    setFullName("");
    setPhone("");
    setPaymentMethod("zain_cash");
    setAccountNumber("");
    setLinkedUserId("");
    setEditingDelegateId(null);
  }

  async function deleteDelegate(delegate) {
    if (!canDelete) {
      alert("ليس لديك صلاحية");
      return;
    }

    const ok = confirm("حذف المندوب؟");
    if (!ok) return;

    try {
      const { error } = await supabase
        .from("delegates")
        .delete()
        .eq("id", delegate.id)
        .eq("project_id", project.id);

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "delegates",
        action: "delete",
        title: "حذف مندوب",
        description: `${delegate.full_name || delegate.name} - ${paymentLabel(
          delegate.payment_method
        )} - ${delegate.account_number || "-"}`,
        amount: 0,
      });

      await loadDelegates();
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل حذف المندوب");
    }
  }

  function getLinkedUserName(userId) {
    if (!userId) return "غير مربوط";

    const found = users.find((item) => item.user_id === userId);

    return (
      found?.profiles?.full_name ||
      found?.profiles?.email ||
      "مستخدم غير معروف"
    );
  }

  function paymentLabel(method) {
    switch (method) {
      case "zain_cash":
        return "زين كاش";
      case "qi_card":
        return "كي كارد";
      default:
        return "تحويل";
    }
  }

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-sm font-black">المندوبين</h1>
          <p className="text-[9px] text-slate-500">
            إدارة حسابات تحويل الأرباح وربط المندوب بحساب مستخدم
          </p>
        </div>

        <div className="bg-orange-600 rounded-md px-2 py-1 text-[10px] font-black">
          {delegates.length}
        </div>
      </div>

      {canAdd && (
        <form onSubmit={handleAdd} className="space-y-1 mb-2">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-1">
            <input
              type="text"
              placeholder="اسم المندوب"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px]"
            />

            <input
              type="text"
              placeholder="الهاتف"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px]"
            />

            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px]"
            >
              <option value="zain_cash">زين كاش</option>
              <option value="qi_card">كي كارد</option>
            </select>

            <input
              type="text"
              placeholder="رقم الحساب"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px]"
            />

            <select
              value={linkedUserId}
              onChange={(e) => setLinkedUserId(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px]"
            >
              <option value="">ربط بحساب مستخدم</option>

              {users.map((item) => (
                <option key={item.user_id} value={item.user_id}>
                  {item.profiles?.full_name ||
                    item.profiles?.email ||
                    item.user_id}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            <button className="w-full bg-orange-600 hover:bg-orange-700 rounded-md h-9 text-[10px] font-black">
              {editingDelegateId ? "حفظ التعديلات" : "إضافة مندوب"}
            </button>

            {editingDelegateId && (
              <button
                type="button"
                onClick={clearForm}
                className="w-full bg-slate-700 hover:bg-slate-600 rounded-md h-9 text-[10px] font-black"
              >
                إلغاء التعديل
              </button>
            )}
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-6 text-[10px] text-slate-500">
          جاري التحميل...
        </div>
      ) : delegates.length === 0 ? (
        <div className="text-center py-6 text-[10px] text-slate-500">
          لا يوجد مندوبين
        </div>
      ) : (
        <div className="space-y-1">
          {delegates.map((delegate) => (
            <div
              key={delegate.id}
              className="bg-slate-900 border border-slate-800 rounded-md p-2 flex items-center justify-between gap-2"
            >
              <div>
                <h2 className="text-[11px] font-black">
                  {delegate.full_name || delegate.name}
                </h2>

                <p className="text-[8px] text-slate-500">
                  {delegate.phone || "-"}
                </p>

                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  <span className="bg-blue-600 rounded-md px-2 py-[2px] text-[8px] font-black">
                    {paymentLabel(delegate.payment_method)}
                  </span>

                  <span className="text-[8px] text-cyan-400 font-black">
                    {delegate.account_number}
                  </span>

                  <span className="bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 rounded-md px-2 py-[2px] text-[8px] font-black">
                    {getLinkedUserName(delegate.linked_user_id)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {canAdd && (
                  <button
                    onClick={() => handleEdit(delegate)}
                    className="bg-blue-600 hover:bg-blue-700 px-2 h-7 rounded-md text-[8px] font-black"
                  >
                    تعديل
                  </button>
                )}

                {canDelete && (
                  <button
                    onClick={() => deleteDelegate(delegate)}
                    className="bg-red-600 hover:bg-red-700 px-2 h-7 rounded-md text-[8px] font-black"
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