import { useState } from "react";
import { supabase } from "../../services/supabase/client";

export default function AddOrder({ project, onDone }) {
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    address: "",
    product_name: "",
    order_price: "",
    notes: "",
  });

  function normalizeOrderPrice(value) {
    const numberValue = Number(value || 0);

    if (!numberValue || numberValue <= 0) return 0;

    // إذا كتب المندوب 25 أو 30 أو 175 نخزنها 25,000 / 30,000 / 175,000
    if (numberValue < 1000) {
      return Math.round(numberValue * 1000);
    }

    return Math.round(numberValue);
  }

  async function submit(e) {
    e.preventDefault();

    if (!form.customer_name.trim()) return alert("اكتب اسم الزبون");
    if (!form.phone.trim()) return alert("اكتب رقم الهاتف");
    if (!form.product_name.trim()) return alert("اكتب اسم المنتج");

    const finalOrderPrice = normalizeOrderPrice(form.order_price);

    if (!finalOrderPrice || finalOrderPrice <= 0) {
      return alert("اكتب سعر الطلب بشكل صحيح");
    }

    try {
      setSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("المستخدم غير مسجل دخول");

      const payload = {
        project_id: project.id,
        my_pages_project_id: project.my_pages_project_id || null,
        user_id: user.id,
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        product_name: form.product_name.trim(),
        order_price: finalOrderPrice,
        notes: form.notes.trim(),
        status: "pending",
      };

      const { error } = await supabase.from("page_orders").insert(payload);

      if (error) throw error;

      setForm({
        customer_name: "",
        phone: "",
        address: "",
        product_name: "",
        order_price: "",
        notes: "",
      });

      alert("تمت إضافة الطلب بنجاح");
      onDone?.();
    } catch (err) {
      console.error(err);
      alert(err.message || "فشل إضافة الطلب");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2" dir="rtl">
      <div className="bg-gradient-to-l from-blue-700 to-slate-950 border border-blue-500/20 rounded-xl p-3">
        <h2 className="text-sm font-black text-white">إضافة طلب جديد</h2>
        <p className="text-[10px] text-blue-100 mt-1">
          أضف بيانات الطلب، وبعد وصول الطلب يتم احتساب الربح تلقائياً.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="bg-slate-950 border border-slate-800 rounded-xl p-2 space-y-2"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <Input
            label="اسم الزبون"
            value={form.customer_name}
            onChange={(v) => setForm({ ...form, customer_name: v })}
            required
          />

          <Input
            label="رقم الهاتف"
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
            required
          />

          <Input
            label="العنوان"
            value={form.address}
            onChange={(v) => setForm({ ...form, address: v })}
          />

          <Input
            label="اسم المنتج"
            value={form.product_name}
            onChange={(v) => setForm({ ...form, product_name: v })}
            required
          />

          <Input
            label="سعر الطلب بالدينار"
            type="number"
            value={form.order_price}
            onChange={(v) => setForm({ ...form, order_price: v })}
            helper="مثال: إذا كتبت 25 ينحفظ 25,000 تلقائياً"
            required
          />
        </div>

        <label className="space-y-1 block">
          <span className="block text-[10px] text-slate-400 font-bold">
            ملاحظات
          </span>

          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={3}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-blue-500 resize-none"
            placeholder="ملاحظات اختيارية..."
          />
        </label>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-[10px] text-slate-400">
          الربح لا ينحسب عند الإدخال. ينحسب فقط عندما تصبح حالة الطلب{" "}
          <span className="text-green-400 font-black">واصل</span>.
        </div>

        <button
          disabled={saving}
          className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[12px] font-black"
        >
          {saving ? "جاري الحفظ..." : "إضافة الطلب"}
        </button>
      </form>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  helper = "",
}) {
  return (
    <label className="space-y-1 block">
      <span className="block text-[10px] text-slate-400 font-bold">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </span>

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 h-9 text-[12px] text-white outline-none focus:border-blue-500"
      />

      {helper && (
        <p className="text-[9px] text-slate-500 leading-4">{helper}</p>
      )}
    </label>
  );
}
