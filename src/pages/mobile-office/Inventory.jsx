import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { notifyTelegramOperation } from "../../services/supabase/telegram";

const INPUT_CLASS = "w-full bg-white border border-slate-300 rounded-lg px-3 h-10 text-sm font-medium text-right text-slate-900 placeholder:text-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const SELECT_CLASS = "w-full bg-white border border-slate-300 rounded-lg px-3 h-10 text-sm font-medium text-right text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const CATEGORIES = [
  { value: "accessory", label: "إكسسوارات" },
  { value: "charger", label: "شواحن" },
  { value: "cable", label: "كيبلات" },
  { value: "battery", label: "بطاريات" },
  { value: "case", label: "كفرات" },
  { value: "glass", label: "حماية/كلاس" },
  { value: "device", label: "أجهزة" },
  { value: "part", label: "قطع صيانة" },
  { value: "general", label: "عام" },
];

export default function Inventory({ project, canAdd = true, canDelete = true }) {
  const [items, setItems] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [modalType, setModalType] = useState(null);

  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("accessory");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [defaultSellPrice, setDefaultSellPrice] = useState("");
  const [notes, setNotes] = useState("");

  const [saleItemId, setSaleItemId] = useState("");
  const [saleQuantity, setSaleQuantity] = useState("1");
  const [unitSalePrice, setUnitSalePrice] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [saleNotes, setSaleNotes] = useState("");

  const [requestItemId, setRequestItemId] = useState("");
  const [requestItemName, setRequestItemName] = useState("");
  const [requestCategory, setRequestCategory] = useState("accessory");
  const [requestBrand, setRequestBrand] = useState("");
  const [requestModel, setRequestModel] = useState("");
  const [requestQuantity, setRequestQuantity] = useState("1");
  const [requestNotes, setRequestNotes] = useState("");

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel(`mobile-inventory-${project.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mobile_inventory_items", filter: `project_id=eq.${project.id}` },
        () => loadData(false)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mobile_inventory_sales", filter: `project_id=eq.${project.id}` },
        () => loadData(false)
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [project.id]);

  async function loadData(showLoading = true) {
    try {
      if (showLoading) setLoading(true);

      const [{ data: itemData, error: itemError }, { data: saleData, error: saleError }] = await Promise.all([
        supabase
          .from("mobile_inventory_items")
          .select("*")
          .eq("project_id", project.id)
          .order("request_count", { ascending: false })
          .order("quantity", { ascending: true }),
        supabase
          .from("mobile_inventory_sales")
          .select("*, mobile_inventory_items(item_name, category, brand, model)")
          .eq("project_id", project.id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (itemError) throw itemError;
      if (saleError) throw saleError;

      setItems(itemData || []);
      setSales(saleData || []);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل تحميل المخزن");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      [item.item_name, item.category, item.brand, item.model, item.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [items, search]);

  const selectedSaleItem = items.find((item) => item.id === saleItemId);
  const selectedRequestItem = items.find((item) => item.id === requestItemId);

  const stats = useMemo(() => {
    const totalItems = items.length;
    const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalCost = items.reduce((sum, item) => sum + Number(item.total_cost || 0), 0);
    const zeroStock = items.filter((item) => Number(item.quantity || 0) <= 0).length;
    const lowStock = items.filter((item) => Number(item.quantity || 0) > 0 && Number(item.quantity || 0) <= 2).length;
    const topRequested = [...items].sort((a, b) => Number(b.request_count || 0) - Number(a.request_count || 0))[0];
    const totalSales = sales.reduce((sum, item) => sum + Number(item.total_sale || 0), 0);
    const totalProfit = sales.reduce((sum, item) => sum + Number(item.profit || 0), 0);
    return { totalItems, totalQty, totalCost, zeroStock, lowStock, topRequested, totalSales, totalProfit };
  }, [items, sales]);

  function categoryLabel(value) {
    return CATEGORIES.find((item) => item.value === value)?.label || "عام";
  }

  function avgCost(item) {
    const qty = Number(item.quantity || 0);
    if (qty <= 0) return 0;
    return Number(item.total_cost || 0) / qty;
  }

  function itemTitle(item) {
    return [item.item_name, item.brand, item.model].filter(Boolean).join(" - ");
  }

  async function handleAddPurchase(e) {
    e.preventDefault();
    if (!canAdd) return alert("ليس لديك صلاحية الإضافة");
    if (submitting) return;
    if (!itemName.trim()) return alert("اكتب اسم المادة");
    if (!quantity || Number(quantity) <= 0) return alert("اكتب كمية صحيحة");
    if (!unitCost || Number(unitCost) < 0) return alert("اكتب سعر شراء صحيح");

    try {
      setSubmitting(true);
      const qtyValue = Number(quantity);
      const costValue = Number(unitCost);
      const sellValue = Number(defaultSellPrice || 0);
      const itemNameValue = itemName.trim();
      const brandValue = brand.trim() || null;
      const modelValue = model.trim() || null;
      const notesValue = notes.trim() || null;

      const { error } = await supabase.rpc("mobile_inventory_add_purchase", {
        p_project_id: project.id,
        p_item_name: itemNameValue,
        p_category: category,
        p_brand: brandValue,
        p_model: modelValue,
        p_quantity: qtyValue,
        p_unit_cost: costValue,
        p_default_sell_price: sellValue,
        p_notes: notesValue,
      });
      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "mobile_inventory_items",
        action: "create",
        title: "إضافة/شراء مادة للمخزن",
        description: `${itemNameValue} - ${categoryLabel(category)} - الكمية: ${qtyValue} - شراء القطعة: ${costValue.toLocaleString("en-US")}`,
        amount: qtyValue * costValue,
      });

      setItemName(""); setCategory("accessory"); setBrand(""); setModel(""); setQuantity("1"); setUnitCost(""); setDefaultSellPrice(""); setNotes("");
      await loadData(false);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل إضافة المادة");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecordSale(e) {
    e.preventDefault();
    if (!canAdd) return alert("ليس لديك صلاحية البيع");
    if (!saleItemId) return alert("اختر مادة من المخزن");
    if (!saleQuantity || Number(saleQuantity) <= 0) return alert("اكتب كمية صحيحة");
    if (!unitSalePrice || Number(unitSalePrice) < 0) return alert("اكتب سعر بيع صحيح");

    try {
      setSubmitting(true);
      const qtyValue = Number(saleQuantity);
      const salePriceValue = Number(unitSalePrice);
      const customerNameValue = customerName.trim() || null;
      const customerPhoneValue = customerPhone.trim() || null;
      const notesValue = saleNotes.trim() || null;

      const { error } = await supabase.rpc("mobile_inventory_record_sale", {
        p_project_id: project.id,
        p_item_id: saleItemId,
        p_quantity: qtyValue,
        p_unit_sale_price: salePriceValue,
        p_customer_name: customerNameValue,
        p_customer_phone: customerPhoneValue,
        p_notes: notesValue,
      });
      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "mobile_inventory_sales",
        action: "create",
        title: "بيع مادة من المخزن",
        description: `${selectedSaleItem ? itemTitle(selectedSaleItem) : "مادة"} - الكمية: ${qtyValue} - بيع القطعة: ${salePriceValue.toLocaleString("en-US")}`,
        amount: qtyValue * salePriceValue,
      });

      setSaleItemId(""); setSaleQuantity("1"); setUnitSalePrice(""); setCustomerName(""); setCustomerPhone(""); setSaleNotes("");
      await loadData(false);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل تسجيل البيع");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecordRequest(e) {
    e.preventDefault();
    if (!canAdd) return alert("ليس لديك صلاحية تسجيل الطلب");
    if (!requestItemId && !requestItemName.trim()) return alert("اختر مادة أو اكتب اسم مادة مطلوبة");

    try {
      setSubmitting(true);
      const qtyValue = Math.max(Number(requestQuantity || 1), 1);
      const itemNameValue = requestItemName.trim() || selectedRequestItem?.item_name || "مادة مطلوبة";
      const notesValue = requestNotes.trim() || null;

      const { error } = await supabase.rpc("mobile_inventory_record_request", {
        p_project_id: project.id,
        p_item_id: requestItemId || null,
        p_item_name: itemNameValue,
        p_category: requestCategory,
        p_brand: requestBrand.trim() || null,
        p_model: requestModel.trim() || null,
        p_quantity: qtyValue,
        p_notes: notesValue,
      });
      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "mobile_inventory_items",
        action: "update",
        title: "تسجيل طلب مادة",
        description: `${itemNameValue} - الطلبات: ${qtyValue} - ${notesValue || "بدون ملاحظات"}`,
        amount: 0,
      });

      setRequestItemId(""); setRequestItemName(""); setRequestCategory("accessory"); setRequestBrand(""); setRequestModel(""); setRequestQuantity("1"); setRequestNotes("");
      await loadData(false);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل تسجيل الطلب");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteItem(item) {
    if (!canDelete) return alert("ليس لديك صلاحية الحذف");
    if (!confirm("هل تريد حذف هذه المادة وكل مشترياتها ومبيعاتها؟")) return;
    try {
      const { error } = await supabase
        .from("mobile_inventory_items")
        .delete()
        .eq("id", item.id)
        .eq("project_id", project.id);
      if (error) throw error;
      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "mobile_inventory_items",
        action: "delete",
        title: "حذف مادة من المخزن",
        description: `${itemTitle(item)} - الكمية: ${Number(item.quantity || 0).toLocaleString("en-US")}`,
        amount: Number(item.total_cost || 0),
      });
      await loadData(false);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل حذف المادة");
    }
  }

  return (
    <div dir="rtl" className="space-y-1.5 text-right text-slate-900">
      <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-1">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div>
            <h1 className="text-lg font-extrabold text-slate-950">المخزن</h1>
            <p className="text-xs text-slate-600">مواد المكتب، الإكسسوارات، الأجهزة، وقطع الصيانة</p>
          </div>
          <button
            onClick={() => loadData()}
            className="bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-md px-3 h-8 text-xs font-bold"
          >
            تحديث
          </button>
        </div>

        <div className="grid grid-cols-4 md:grid-cols-8 gap-1 mb-1.5">
          <Stat title="الأصناف" value={stats.totalItems} color="text-cyan-700" />
          <Stat title="الكمية" value={stats.totalQty} color="text-green-700" />
          <Stat title="قيمة المخزن" value={stats.totalCost} color="text-orange-700" />
          <Stat title="نفذت" value={stats.zeroStock} color="text-red-700" />
          <Stat title="قليلة" value={stats.lowStock} color="text-yellow-700" />
          <Stat title="مبيعات أخيرة" value={stats.totalSales} color="text-blue-700" />
          <Stat title="ربح أخير" value={stats.totalProfit} color="text-emerald-700" />
          <Stat title="الأكثر طلباً" value={stats.topRequested?.item_name || "-"} color="text-purple-700" text />
        </div>

        <input
          type="text"
          placeholder="بحث باسم المادة، الفئة، الماركة، الموديل..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-50 border border-slate-300 rounded-md px-3 h-8 text-xs font-medium text-right text-slate-900 placeholder:text-slate-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-1 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          <SectionButton label="المواد" active={!modalType} onClick={() => setModalType(null)} />
          {canAdd && <SectionButton label="شراء / إضافة" active={modalType === "purchase"} onClick={() => setModalType("purchase")} />}
          {canAdd && <SectionButton label="بيع" active={modalType === "sale"} onClick={() => setModalType("sale")} />}
          {canAdd && <SectionButton label="طلب ناقص" active={modalType === "request"} onClick={() => setModalType("request")} />}
          <SectionButton label="آخر المبيعات" active={modalType === "sales"} onClick={() => setModalType("sales")} />
        </div>
      </div>

      <div className="bg-white border border-slate-200 shadow-sm rounded-lg p-1">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div>
              <h2 className="text-sm font-extrabold text-slate-950">مواد المخزن</h2>
              <p className="text-[11px] text-slate-600">{filteredItems.length.toLocaleString()} صنف ظاهر حسب البحث</p>
            </div>
          </div>

          {loading ? <Empty text="جاري التحميل..." /> : filteredItems.length === 0 ? <Empty text="لا توجد مواد" /> : (
            <div
              className={`grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8 gap-1 ${
                filteredItems.length >= 50
                  ? "max-h-[calc(100vh-210px)] overflow-y-auto pr-1"
                  : ""
              }`}
            >
              {filteredItems.map((item) => (
                <InventoryCard
                  key={item.id}
                  item={item}
                  title={itemTitle(item)}
                  category={categoryLabel(item.category)}
                  avgCost={avgCost(item)}
                  canDelete={canDelete}
                  onSale={() => {
                    setSaleItemId(item.id);
                    setUnitSalePrice(String(item.default_sell_price || ""));
                    setModalType("sale");
                  }}
                  onDelete={() => deleteItem(item)}
                />
              ))}
            </div>
          )}
        </div>

      {modalType === "purchase" && canAdd && (
        <Modal title="إضافة / شراء مادة" onClose={() => setModalType(null)}>
          <form onSubmit={handleAddPurchase} className="space-y-2">
            <input className={INPUT_CLASS} placeholder="اسم المادة" value={itemName} onChange={(e) => setItemName(e.target.value)} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select className={SELECT_CLASS} value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
              <input className={INPUT_CLASS} placeholder="الماركة" value={brand} onChange={(e) => setBrand(e.target.value)} />
              <input className={INPUT_CLASS} placeholder="الموديل" value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input className={INPUT_CLASS} type="number" placeholder="الكمية" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              <input className={INPUT_CLASS} type="number" placeholder="شراء القطعة" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
              <input className={INPUT_CLASS} type="number" placeholder="سعر بيع افتراضي" value={defaultSellPrice} onChange={(e) => setDefaultSellPrice(e.target.value)} />
            </div>
            <input className={INPUT_CLASS} placeholder="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <button disabled={submitting} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg h-10 text-sm font-bold">
              {submitting ? "جاري..." : "حفظ الشراء"}
            </button>
          </form>
        </Modal>
      )}

      {modalType === "sale" && canAdd && (
        <Modal title="بيع من المخزن" onClose={() => setModalType(null)}>
          <form onSubmit={handleRecordSale} className="space-y-2">
            <select className={SELECT_CLASS} value={saleItemId} onChange={(e) => { setSaleItemId(e.target.value); const item = items.find((x) => x.id === e.target.value); if (item?.default_sell_price) setUnitSalePrice(String(item.default_sell_price)); }}>
              <option value="">اختر مادة</option>
              {items.map((item) => <option key={item.id} value={item.id}>{itemTitle(item)} | {Number(item.quantity || 0).toLocaleString()} قطعة</option>)}
            </select>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input className={INPUT_CLASS} type="number" placeholder="الكمية" value={saleQuantity} onChange={(e) => setSaleQuantity(e.target.value)} />
              <input className={INPUT_CLASS} type="number" placeholder="سعر بيع القطعة" value={unitSalePrice} onChange={(e) => setUnitSalePrice(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input className={INPUT_CLASS} placeholder="اسم الزبون اختياري" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              <input className={INPUT_CLASS} placeholder="هاتف الزبون اختياري" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </div>
            <input className={INPUT_CLASS} placeholder="ملاحظات" value={saleNotes} onChange={(e) => setSaleNotes(e.target.value)} />
            {selectedSaleItem && <Info text={`متوسط الشراء: ${avgCost(selectedSaleItem).toLocaleString()} | المتوفر: ${Number(selectedSaleItem.quantity || 0).toLocaleString()}`} />}
            <button disabled={submitting} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg h-10 text-sm font-bold">
              {submitting ? "جاري..." : "تسجيل بيع"}
            </button>
          </form>
        </Modal>
      )}

      {modalType === "request" && canAdd && (
        <Modal title="تسجيل طلب ناقص" onClose={() => setModalType(null)}>
          <form onSubmit={handleRecordRequest} className="space-y-2">
            <select className={SELECT_CLASS} value={requestItemId} onChange={(e) => setRequestItemId(e.target.value)}>
              <option value="">طلب مادة جديدة أو اختر موجودة</option>
              {items.map((item) => <option key={item.id} value={item.id}>{itemTitle(item)}</option>)}
            </select>
            {!requestItemId && (
              <>
                <input className={INPUT_CLASS} placeholder="اسم المادة المطلوبة" value={requestItemName} onChange={(e) => setRequestItemName(e.target.value)} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <select className={SELECT_CLASS} value={requestCategory} onChange={(e) => setRequestCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
                  <input className={INPUT_CLASS} placeholder="الماركة" value={requestBrand} onChange={(e) => setRequestBrand(e.target.value)} />
                  <input className={INPUT_CLASS} placeholder="الموديل" value={requestModel} onChange={(e) => setRequestModel(e.target.value)} />
                </div>
              </>
            )}
            <input className={INPUT_CLASS} type="number" placeholder="عدد مرات الطلب" value={requestQuantity} onChange={(e) => setRequestQuantity(e.target.value)} />
            <input className={INPUT_CLASS} placeholder="ملاحظات" value={requestNotes} onChange={(e) => setRequestNotes(e.target.value)} />
            {selectedRequestItem && <Info text={`الطلبات الحالية: ${Number(selectedRequestItem.request_count || 0).toLocaleString()}`} />}
            <button disabled={submitting} className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg h-10 text-sm font-bold">
              {submitting ? "جاري..." : "تسجيل الطلب"}
            </button>
          </form>
        </Modal>
      )}

      {modalType === "sales" && (
        <Modal title="آخر المبيعات" onClose={() => setModalType(null)} wide>
          {sales.length === 0 ? <Empty text="لا توجد مبيعات" /> : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {sales.map((sale) => (
                <div key={sale.id} className="bg-slate-50 border border-slate-200 rounded-lg p-2">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-950">{itemTitle(sale.mobile_inventory_items || {})}</h3>
                      <p className="text-xs text-slate-600">{sale.customer_name || "زبون نقدي"} - {new Date(sale.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="md:text-left">
                      <h3 className="text-base font-extrabold text-green-700">{Number(sale.total_sale || 0).toLocaleString()}</h3>
                      <p className="text-xs text-emerald-700">ربح {Number(sale.profit || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function InventoryCard({ item, title, category, avgCost, canDelete, onSale, onDelete }) {
  const quantity = Number(item.quantity || 0);
  const isOut = quantity <= 0;
  const isLow = quantity > 0 && quantity <= 2;

  return (
    <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
      <div className="px-2 py-1 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-1">
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold border leading-4 ${
            isOut
              ? "bg-red-50 text-red-700 border-red-200"
              : isLow
              ? "bg-yellow-50 text-yellow-700 border-yellow-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}
        >
          {isOut ? "نافذ" : isLow ? "قليل" : `${quantity.toLocaleString()} قطعة`}
        </span>

        <span className="px-1.5 py-0.5 rounded-full bg-white text-slate-700 text-[10px] font-bold border border-slate-200 leading-4 truncate max-w-[80px]">
          {category}
        </span>
      </div>

      <div className="p-2">
        <h3 className="text-[13px] font-extrabold text-slate-950 leading-5 line-clamp-1 min-h-[20px]">
          {title || "مادة بدون اسم"}
        </h3>
        <p className="text-[11px] text-slate-600 truncate leading-4">
          {item.notes || "بدون ملاحظات"}
        </p>

        <div className="grid grid-cols-3 gap-1 mt-1.5">
          <CardMetric title="شراء" value={avgCost} color="text-orange-700" />
          <CardMetric title="بيع" value={item.default_sell_price} color="text-blue-700" />
          <CardMetric title="طلبات" value={item.request_count} color="text-purple-700" />
        </div>

        <div className="grid grid-cols-2 gap-1 mt-1.5">
          <button
            type="button"
            onClick={onSale}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-md h-7 text-[11px] font-extrabold"
          >
            بيع
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="bg-red-600 hover:bg-red-700 text-white rounded-md h-7 text-[11px] font-extrabold"
            >
              حذف
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CardMetric({ title, value, color }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-md px-1 py-0.5 min-w-0">
      <p className="text-[10px] font-bold text-slate-600 leading-4 truncate">{title}</p>
      <h4 className={`text-[11px] font-extrabold leading-4 truncate ${color}`}>
        {Number(value || 0).toLocaleString()}
      </h4>
    </div>
  );
}

function Panel({ title, children }) {
  return <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-2"><h2 className="text-lg font-extrabold mb-3 text-slate-950">{title}</h2>{children}</div>;
}

function Stat({ title, value, color, text = false }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 min-h-[46px]">
      <p className="text-[11px] font-bold text-slate-600 leading-4 truncate">{title}</p>
      <h2 className={`text-base font-extrabold leading-5 truncate ${color}`}>
        {text ? value : Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}

function Small({ title, value, color = "text-slate-900", text = false }) {
  return <div className="bg-white border border-slate-200 rounded-lg p-1.5"><p className="text-sm text-slate-600 mb-1">{title}</p><h2 className={`text-base font-bold truncate ${color}`}>{text ? value : Number(value || 0).toLocaleString()}</h2></div>;
}

function Info({ text }) {
  return <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700">{text}</div>;
}

function Empty({ text }) {
  return <div className="text-center py-8 text-base text-slate-600">{text}</div>;
}


function Modal({ title, children, onClose, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3" dir="rtl">
      <div className={`bg-white rounded-xl shadow-2xl border border-slate-200 w-full ${wide ? "max-w-3xl" : "max-w-2xl"} max-h-[90vh] overflow-y-auto`}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-2">
          <h2 className="text-base font-extrabold text-slate-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg px-3 h-8 text-xs font-bold"
          >
            إغلاق
          </button>
        </div>
        <div className="p-3">
          {children}
        </div>
      </div>
    </div>
  );
}

function SectionButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 h-8 rounded-md text-xs font-bold whitespace-nowrap ${
        active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {label}
    </button>
  );
}
