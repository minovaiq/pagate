import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase/client";

const STATUS_LABELS = {
  all: "الكل",
  pending: "جديد",
  processing: "قيد التجهيز",
  delivered: "واصل",
  returned: "راجع",
  cancelled: "ملغي",
};

const STATUS_CLASSES = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  processing: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  delivered: "bg-green-500/10 text-green-400 border-green-500/30",
  returned: "bg-red-500/10 text-red-400 border-red-500/30",
  cancelled: "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

export default function MyOrders({
  project,
  isAdmin = false,
  permissions = {},
}) {
  const [orders, setOrders] = useState([]);
  const [activeStatus, setActiveStatus] = useState("all");
  const [searchPhone, setSearchPhone] = useState("");
  const [loading, setLoading] = useState(true);

  const [editingOrder, setEditingOrder] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    customer_name: "",
    phone: "",
    address: "",
    product_name: "",
    order_price: "",
    notes: "",
  });

  const canManageAllOrders =
    isAdmin || permissions?.can_manage_all_orders === true;

  const canEdit =
    isAdmin ||
    permissions?.can_edit === true ||
    permissions?.can_manage_all_orders === true;

  useEffect(() => {
    loadOrders();

    const channel = supabase
      .channel(`my-orders-${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "page_orders",
        },
        () => loadOrders()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delegates",
        },
        () => loadOrders()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [project.id]);

  async function loadOrders() {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;

      if (!user) return;

      const { data: delegatesData, error: delegatesError } =
        await supabase
          .from("delegates")
          .select("id, full_name, name, linked_user_id")
          .eq("project_id", project.id);

      if (delegatesError) throw delegatesError;

      const delegateIds = (delegatesData || []).map((d) => d.id);

      let allOrders = [];

      if (delegateIds.length > 0) {
        let delegateOrdersQuery = supabase
          .from("page_orders")
          .select("*")
          .in("delegate_id", delegateIds)
          .order("created_at", { ascending: false });

        if (!canManageAllOrders) {
          delegateOrdersQuery = delegateOrdersQuery.eq("user_id", user.id);
        }

        const { data: delegateOrders, error: delegateOrdersError } =
          await delegateOrdersQuery;

        if (delegateOrdersError) throw delegateOrdersError;

        allOrders = [...allOrders, ...(delegateOrders || [])];
      }

      let directOrdersQuery = supabase
        .from("page_orders")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      if (!canManageAllOrders) {
        directOrdersQuery = directOrdersQuery.eq("user_id", user.id);
      }

      const { data: directOrders, error: directOrdersError } =
        await directOrdersQuery;

      if (directOrdersError) throw directOrdersError;

      allOrders = [...allOrders, ...(directOrders || [])];

      const unique = Array.from(
        new Map(allOrders.map((item) => [item.id, item])).values()
      ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setOrders(unique);
    } catch (err) {
      console.error(err);
      alert(err.message || "فشل تحميل الطلبات");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(orderId, status) {
    try {
      const { error } = await supabase
        .from("page_orders")
        .update({ status })
        .eq("id", orderId);

      if (error) throw error;

      await loadOrders();
    } catch (err) {
      console.error(err);
      alert(err.message || "فشل تحديث حالة الطلب");
    }
  }

  function openEditOrder(order) {
    setEditingOrder(order);
    setEditForm({
      customer_name: order.customer_name || "",
      phone: order.phone || "",
      address: order.address || "",
      product_name: order.product_name || "",
      order_price: order.order_price || "",
      notes: order.notes || "",
    });
  }

  async function saveOrderEdit(e) {
    e?.preventDefault?.();

    if (!editingOrder) return;

    if (!editForm.customer_name.trim()) return alert("اكتب اسم الزبون");
    if (!editForm.phone.trim()) return alert("اكتب رقم الهاتف");
    if (!editForm.product_name.trim()) return alert("اكتب اسم المنتج");

    const price = normalizePriceValue(editForm.order_price);

    if (!price || price <= 0) {
      return alert("اكتب سعر الطلب بشكل صحيح");
    }

    try {
      setSavingEdit(true);

      const { error } = await supabase
        .from("page_orders")
        .update({
          customer_name: editForm.customer_name.trim(),
          phone: editForm.phone.trim(),
          address: editForm.address.trim(),
          product_name: editForm.product_name.trim(),
          order_price: price,
          notes: editForm.notes.trim(),
        })
        .eq("id", editingOrder.id);

      if (error) throw error;

      setEditingOrder(null);
      await loadOrders();
    } catch (err) {
      console.error(err);
      alert(err.message || "فشل تعديل الطلب");
    } finally {
      setSavingEdit(false);
    }
  }

  function normalizePhone(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function normalizePriceValue(value) {
    const numericValue = Number(value || 0);

    if (numericValue > 0 && numericValue < 1000) {
      return numericValue * 1000;
    }

    return numericValue;
  }

  const filteredOrders = useMemo(() => {
    let result = orders;

    if (activeStatus !== "all") {
      result = result.filter((item) => item.status === activeStatus);
    }

    const phoneSearch = normalizePhone(searchPhone);

    if (phoneSearch) {
      result = result.filter((item) =>
        normalizePhone(item.phone).includes(phoneSearch)
      );
    }

    return result;
  }, [orders, activeStatus, searchPhone]);

  const counts = useMemo(
    () => ({
      all: orders.length,
      pending: orders.filter((o) => o.status === "pending").length,
      processing: orders.filter((o) => o.status === "processing").length,
      delivered: orders.filter((o) => o.status === "delivered").length,
      returned: orders.filter((o) => o.status === "returned").length,
      cancelled: orders.filter((o) => o.status === "cancelled").length,
    }),
    [orders]
  );

  return (
    <div className="space-y-2" dir="rtl">
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-1 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveStatus(key)}
              className={`px-3 h-8 rounded-md text-[10px] font-black whitespace-nowrap ${
                activeStatus === key
                  ? "bg-blue-600 text-white"
                  : "bg-slate-900 text-slate-400"
              }`}
            >
              {label} ({counts[key] || 0})
            </button>
          ))}

          <input
            type="text"
            placeholder="بحث برقم الهاتف..."
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-md px-3 h-8 text-[10px] text-white outline-none min-w-[170px]"
          />

          {searchPhone && (
            <button
              onClick={() => setSearchPhone("")}
              className="bg-red-600 hover:bg-red-700 px-3 h-8 rounded-md text-[10px] font-black text-white"
            >
              مسح
            </button>
          )}

          <button
            onClick={loadOrders}
            className="bg-slate-800 hover:bg-slate-700 px-3 h-8 rounded-md text-[10px] font-black text-white"
          >
            تحديث
          </button>
        </div>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between p-2 border-b border-slate-800">
          <h2 className="text-[12px] font-black text-white">طلبات المندوبين</h2>

          <span className="text-[10px] text-slate-500">
            العدد: {filteredOrders.length}
          </span>
        </div>

        {loading ? (
          <EmptyState text="جاري تحميل الطلبات..." />
        ) : filteredOrders.length === 0 ? (
          <EmptyState text="لا توجد طلبات مطابقة" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="p-2 text-right">الزبون</th>
                  <th className="p-2 text-right">الهاتف</th>
                  <th className="p-2 text-right">العنوان</th>
                  <th className="p-2 text-right">المنتج</th>
                  <th className="p-2 text-right">السعر</th>
                  <th className="p-2 text-right">الحالة</th>
                  <th className="p-2 text-right">الربح</th>
                  <th className="p-2 text-right">التاريخ</th>
                  <th className="p-2 text-right">إجراء</th>
                </tr>
              </thead>

              <tbody>
                {filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-t border-slate-800 text-slate-200"
                  >
                    <td className="p-2 font-bold">
                      {order.customer_name || "-"}
                    </td>

                    <td className="p-2 font-black text-blue-300">
                      {order.phone || "-"}
                    </td>

                    <td className="p-2 max-w-[180px] truncate">
                      {order.address || "-"}
                    </td>

                    <td className="p-2">{order.product_name || "-"}</td>

                    <td className="p-2">{formatMoney(order.order_price)}</td>

                    <td className="p-2">
                      {canEdit ? (
                        <select
                          value={order.status || "pending"}
                          onChange={(e) => updateStatus(order.id, e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded-md px-2 h-7 text-[10px] text-white outline-none"
                        >
                          {Object.entries(STATUS_LABELS)
                            .filter(([key]) => key !== "all")
                            .map(([key, label]) => (
                              <option key={key} value={key}>
                                {label}
                              </option>
                            ))}
                        </select>
                      ) : (
                        <StatusBadge status={order.status} />
                      )}
                    </td>

                    <td className="p-2 font-black text-emerald-400">
                      {formatMoney(order.profit_amount)}
                    </td>

                    <td className="p-2 text-slate-400">
                      {formatDate(order.created_at)}
                    </td>

                    <td className="p-2">
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => openEditOrder(order)}
                          className="bg-amber-600 hover:bg-amber-700 px-2 h-7 rounded-md text-[10px] font-black text-white"
                        >
                          تعديل
                        </button>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingOrder && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3">
          <form
            onSubmit={saveOrderEdit}
            className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="text-sm font-black text-white">تعديل الطلب</h2>
                <p className="text-[10px] text-slate-500 mt-1">
                  عدّل بيانات الطلب ثم اضغط حفظ
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="bg-slate-800 hover:bg-slate-700 rounded-md px-3 h-8 text-[10px] font-black text-white"
              >
                إغلاق
              </button>
            </div>

            <EditInput
              label="اسم الزبون"
              value={editForm.customer_name}
              onChange={(v) =>
                setEditForm({ ...editForm, customer_name: v })
              }
              required
            />

            <EditInput
              label="رقم الهاتف"
              value={editForm.phone}
              onChange={(v) => setEditForm({ ...editForm, phone: v })}
              required
            />

            <EditInput
              label="العنوان"
              value={editForm.address}
              onChange={(v) => setEditForm({ ...editForm, address: v })}
            />

            <EditInput
              label="اسم المنتج"
              value={editForm.product_name}
              onChange={(v) =>
                setEditForm({ ...editForm, product_name: v })
              }
              required
            />

            <EditInput
              label="سعر الطلب بالدينار"
              type="number"
              value={editForm.order_price}
              onChange={(v) => setEditForm({ ...editForm, order_price: v })}
              required
              hint="إذا كتبت 25 سيُحفظ 25,000"
            />

            <label className="space-y-1 block">
              <span className="block text-[10px] text-slate-400 font-bold">
                ملاحظات
              </span>
              <textarea
                value={editForm.notes}
                onChange={(e) =>
                  setEditForm({ ...editForm, notes: e.target.value })
                }
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-[12px] text-white outline-none focus:border-blue-500 resize-none"
              />
            </label>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="submit"
                disabled={savingEdit}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg h-10 text-[12px] font-black text-white"
              >
                {savingEdit ? "جاري الحفظ..." : "حفظ التعديل"}
              </button>

              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="bg-red-600 hover:bg-red-700 rounded-lg h-10 text-[12px] font-black text-white"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex px-2 py-1 rounded-md border text-[9px] font-black ${
        STATUS_CLASSES[status] || STATUS_CLASSES.pending
      }`}
    >
      {STATUS_LABELS[status] || status || "جديد"}
    </span>
  );
}

function EmptyState({ text }) {
  return (
    <div className="p-6 text-center text-[11px] text-slate-400">
      {text}
    </div>
  );
}

function EditInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  hint = "",
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

      {hint && <p className="text-[9px] text-slate-500">{hint}</p>}
    </label>
  );
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString()} د.ع`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ar-IQ");
}
