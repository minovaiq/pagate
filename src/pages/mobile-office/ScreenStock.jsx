import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { notifyTelegramOperation } from "../../services/supabase/telegram";

export default function ScreenStock({
  project,
  canAdd = true,
  canDelete = true,
}) {
  const [stocks, setStocks] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [deviceModel, setDeviceModel] = useState("");
  const [screenName, setScreenName] = useState("");
  const [screenType, setScreenType] = useState("normal");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [defaultSellPrice, setDefaultSellPrice] = useState("");
  const [notes, setNotes] = useState("");

  const [saleStockId, setSaleStockId] = useState("");
  const [saleQuantity, setSaleQuantity] = useState("1");
  const [unitSalePrice, setUnitSalePrice] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [saleNotes, setSaleNotes] = useState("");

  const [requestStockId, setRequestStockId] = useState("");
  const [requestDeviceModel, setRequestDeviceModel] = useState("");
  const [requestScreenName, setRequestScreenName] = useState("");
  const [requestScreenType, setRequestScreenType] = useState("normal");
  const [requestQuantity, setRequestQuantity] = useState("1");
  const [requestNotes, setRequestNotes] = useState("");

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel(`mobile-screen-stock-${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mobile_screen_stock",
          filter: `project_id=eq.${project.id}`,
        },
        () => loadData(false)
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mobile_screen_sales",
          filter: `project_id=eq.${project.id}`,
        },
        () => loadData(false)
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [project.id]);

  async function loadData(showLoading = true) {
    try {
      if (showLoading) setLoading(true);

      const [{ data: stockData, error: stockError }, { data: salesData, error: salesError }] =
        await Promise.all([
          supabase
            .from("mobile_screen_stock")
            .select("*")
            .eq("project_id", project.id)
            .order("request_count", { ascending: false })
            .order("quantity", { ascending: true }),
          supabase
            .from("mobile_screen_sales")
            .select("*, mobile_screen_stock(device_model, screen_name, screen_type)")
            .eq("project_id", project.id)
            .order("created_at", { ascending: false })
            .limit(8),
        ]);

      if (stockError) throw stockError;
      if (salesError) throw salesError;

      setStocks(stockData || []);
      setSales(salesData || []);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل تحميل الشاشات");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const totalModels = stocks.length;
    const totalQty = stocks.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalCost = stocks.reduce((sum, item) => sum + Number(item.total_cost || 0), 0);
    const zeroStock = stocks.filter((item) => Number(item.quantity || 0) <= 0).length;
    const topRequested = [...stocks].sort(
      (a, b) => Number(b.request_count || 0) - Number(a.request_count || 0)
    )[0];
    const totalProfit = sales.reduce((sum, item) => sum + Number(item.profit || 0), 0);

    return {
      totalModels,
      totalQty,
      totalCost,
      zeroStock,
      topRequested,
      totalProfit,
    };
  }, [stocks, sales]);

  const selectedSaleStock = stocks.find((item) => item.id === saleStockId);
  const selectedRequestStock = stocks.find((item) => item.id === requestStockId);

  function avgCost(item) {
    const qty = Number(item.quantity || 0);
    if (qty <= 0) return 0;
    return Number(item.total_cost || 0) / qty;
  }

  function screenTitle(item) {
    return `${item.device_model || "-"}${item.screen_name ? ` - ${item.screen_name}` : ""}`;
  }

  async function handleAddPurchase(e) {
    e.preventDefault();

    if (!canAdd) {
      alert("ليس لديك صلاحية الإضافة");
      return;
    }

    if (submitting) return;

    if (!deviceModel.trim()) {
      alert("اكتب موديل الجهاز");
      return;
    }

    if (!quantity || Number(quantity) <= 0) {
      alert("اكتب كمية صحيحة");
      return;
    }

    if (!unitCost || Number(unitCost) < 0) {
      alert("اكتب سعر شراء صحيح");
      return;
    }

    try {
      setSubmitting(true);

      const qtyValue = Number(quantity);
      const costValue = Number(unitCost);
      const sellValue = Number(defaultSellPrice || 0);
      const modelValue = deviceModel.trim();
      const nameValue = screenName.trim() || null;
      const typeValue = screenType || "normal";
      const notesValue = notes.trim() || null;

      const { error } = await supabase.rpc("mobile_screen_add_purchase", {
        p_project_id: project.id,
        p_device_model: modelValue,
        p_screen_name: nameValue,
        p_screen_type: typeValue,
        p_quantity: qtyValue,
        p_unit_cost: costValue,
        p_default_sell_price: sellValue,
        p_notes: notesValue,
      });

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "mobile_screen_stock",
        action: "create",
        title: "إضافة/شراء شاشة",
        description: `${modelValue} - الكمية: ${qtyValue} - شراء القطعة: ${costValue.toLocaleString("en-US")}`,
        amount: qtyValue * costValue,
      });

      setDeviceModel("");
      setScreenName("");
      setScreenType("normal");
      setQuantity("1");
      setUnitCost("");
      setDefaultSellPrice("");
      setNotes("");

      await loadData(false);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل إضافة الشاشة");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRecordSale(e) {
    e.preventDefault();

    if (!canAdd) {
      alert("ليس لديك صلاحية البيع");
      return;
    }

    if (!saleStockId) {
      alert("اختر شاشة من المخزن");
      return;
    }

    if (!saleQuantity || Number(saleQuantity) <= 0) {
      alert("اكتب كمية بيع صحيحة");
      return;
    }

    if (!unitSalePrice || Number(unitSalePrice) <= 0) {
      alert("اكتب سعر بيع صحيح");
      return;
    }

    try {
      setSubmitting(true);

      const qtyValue = Number(saleQuantity);
      const salePriceValue = Number(unitSalePrice);
      const customerNameValue = customerName.trim() || null;
      const customerPhoneValue = customerPhone.trim() || null;
      const notesValue = saleNotes.trim() || null;

      const { error } = await supabase.rpc("mobile_screen_record_sale", {
        p_stock_id: saleStockId,
        p_quantity: qtyValue,
        p_unit_sale_price: salePriceValue,
        p_customer_name: customerNameValue,
        p_customer_phone: customerPhoneValue,
        p_notes: notesValue,
      });

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "mobile_screen_sales",
        action: "create",
        title: "بيع شاشة",
        description: `${selectedSaleStock ? screenTitle(selectedSaleStock) : "شاشة"} - الكمية: ${qtyValue} - بيع القطعة: ${salePriceValue.toLocaleString("en-US")}`,
        amount: qtyValue * salePriceValue,
      });

      setSaleStockId("");
      setSaleQuantity("1");
      setUnitSalePrice("");
      setCustomerName("");
      setCustomerPhone("");
      setSaleNotes("");

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

    if (!canAdd) {
      alert("ليس لديك صلاحية تسجيل طلب");
      return;
    }

    if (!requestStockId && !requestDeviceModel.trim()) {
      alert("اختر شاشة أو اكتب موديل الشاشة المطلوبة");
      return;
    }

    if (!requestQuantity || Number(requestQuantity) <= 0) {
      alert("اكتب كمية طلب صحيحة");
      return;
    }

    try {
      setSubmitting(true);

      const qtyValue = Number(requestQuantity);
      const modelValue = requestDeviceModel.trim() || null;
      const nameValue = requestScreenName.trim() || null;
      const typeValue = requestScreenType || "normal";
      const notesValue = requestNotes.trim() || null;

      const { error } = await supabase.rpc("mobile_screen_record_request", {
        p_project_id: project.id,
        p_stock_id: requestStockId || null,
        p_device_model: modelValue,
        p_screen_name: nameValue,
        p_screen_type: typeValue,
        p_quantity: qtyValue,
        p_notes: notesValue,
      });

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "mobile_screen_requests",
        action: "create",
        title: "تسجيل طلب شاشة",
        description: `${selectedRequestStock ? screenTitle(selectedRequestStock) : modelValue} - الكمية المطلوبة: ${qtyValue}`,
        amount: 0,
      });

      setRequestStockId("");
      setRequestDeviceModel("");
      setRequestScreenName("");
      setRequestScreenType("normal");
      setRequestQuantity("1");
      setRequestNotes("");

      await loadData(false);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل تسجيل الطلب");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteStock(item) {
    if (!canDelete) {
      alert("ليس لديك صلاحية الحذف");
      return;
    }

    const ok = confirm("هل تريد حذف هذه الشاشة وكل حركاتها؟");
    if (!ok) return;

    try {
      const { error } = await supabase
        .from("mobile_screen_stock")
        .delete()
        .eq("id", item.id)
        .eq("project_id", project.id);

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "mobile_screen_stock",
        action: "delete",
        title: "حذف شاشة من المخزن",
        description: `${screenTitle(item)} - الكمية: ${Number(item.quantity || 0).toLocaleString("en-US")}`,
        amount: Number(item.total_cost || 0),
      });

      await loadData(false);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل حذف الشاشة");
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-1">
        <StatCard title="عدد الموديلات" value={stats.totalModels} color="text-cyan-400" />
        <StatCard title="إجمالي القطع" value={stats.totalQty} color="text-green-400" />
        <StatCard title="قيمة المخزون" value={stats.totalCost} color="text-blue-400" />
        <StatCard title="النافذة" value={stats.zeroStock} color="text-red-400" />
        <StatCard
          title="الأكثر طلباً"
          value={stats.topRequested ? stats.topRequested.device_model : "-"}
          color="text-orange-400"
          isText
        />
        <StatCard title="ربح آخر المبيعات" value={stats.totalProfit} color="text-emerald-400" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-2">
        {canAdd && (
          <form onSubmit={handleAddPurchase} className="bg-slate-950 border border-slate-800 rounded-lg p-2 space-y-1">
            <h2 className="text-[11px] font-black mb-1">إضافة / شراء شاشة</h2>

            <div className="grid grid-cols-2 gap-1">
              <input value={deviceModel} onChange={(e) => setDeviceModel(e.target.value)} placeholder="موديل الجهاز" className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none" />
              <input value={screenName} onChange={(e) => setScreenName(e.target.value)} placeholder="اسم/نوع الشاشة" className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none" />
              <select value={screenType} onChange={(e) => setScreenType(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none">
                <option value="normal">عادي</option>
                <option value="oled">OLED</option>
                <option value="original">أصلي</option>
                <option value="copy">كوبي</option>
                <option value="service_pack">Service Pack</option>
              </select>
              <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="الكمية" className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none" />
              <input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="شراء القطعة" className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none" />
              <input type="number" value={defaultSellPrice} onChange={(e) => setDefaultSellPrice(e.target.value)} placeholder="سعر بيع تقريبي" className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none" />
            </div>

            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات" className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none w-full" />

            <button disabled={submitting} className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 rounded-md h-8 text-[10px] font-black">
              {submitting ? "جاري..." : "حفظ الشاشة"}
            </button>
          </form>
        )}

        {canAdd && (
          <form onSubmit={handleRecordSale} className="bg-slate-950 border border-slate-800 rounded-lg p-2 space-y-1">
            <h2 className="text-[11px] font-black mb-1">تسجيل بيع شاشة</h2>

            <select
              value={saleStockId}
              onChange={(e) => {
                const id = e.target.value;
                setSaleStockId(id);
                const found = stocks.find((item) => item.id === id);
                setUnitSalePrice(found?.default_sell_price ? String(found.default_sell_price) : "");
              }}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none w-full"
            >
              <option value="">اختر الشاشة</option>
              {stocks
                .filter((item) => Number(item.quantity || 0) > 0)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {screenTitle(item)} / المتوفر {item.quantity}
                  </option>
                ))}
            </select>

            <div className="grid grid-cols-2 gap-1">
              <input type="number" value={saleQuantity} onChange={(e) => setSaleQuantity(e.target.value)} placeholder="الكمية" className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none" />
              <input type="number" value={unitSalePrice} onChange={(e) => setUnitSalePrice(e.target.value)} placeholder="سعر بيع القطعة" className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none" />
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="اسم الزبون" className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none" />
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="رقم الهاتف" className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none" />
            </div>

            <input value={saleNotes} onChange={(e) => setSaleNotes(e.target.value)} placeholder="ملاحظات البيع" className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none w-full" />

            {selectedSaleStock && unitSalePrice && (
              <div className="bg-slate-900 border border-slate-800 rounded-md p-2 text-[9px] text-slate-400">
                متوسط الشراء: <span className="text-blue-400 font-black">{avgCost(selectedSaleStock).toLocaleString()}</span>
                <span className="mx-1">|</span>
                ربح القطعة المتوقع: <span className="text-green-400 font-black">{(Number(unitSalePrice || 0) - avgCost(selectedSaleStock)).toLocaleString()}</span>
              </div>
            )}

            <button disabled={submitting} className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-md h-8 text-[10px] font-black">
              {submitting ? "جاري..." : "تسجيل البيع"}
            </button>
          </form>
        )}

        {canAdd && (
          <form onSubmit={handleRecordRequest} className="bg-slate-950 border border-slate-800 rounded-lg p-2 space-y-1">
            <h2 className="text-[11px] font-black mb-1">تسجيل طلب شاشة</h2>

            <select value={requestStockId} onChange={(e) => setRequestStockId(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none w-full">
              <option value="">طلب شاشة غير مسجلة / أو اختر من المخزن</option>
              {stocks.map((item) => (
                <option key={item.id} value={item.id}>
                  {screenTitle(item)} / الطلبات {item.request_count || 0}
                </option>
              ))}
            </select>

            {!requestStockId && (
              <div className="grid grid-cols-2 gap-1">
                <input value={requestDeviceModel} onChange={(e) => setRequestDeviceModel(e.target.value)} placeholder="موديل الجهاز المطلوب" className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none" />
                <input value={requestScreenName} onChange={(e) => setRequestScreenName(e.target.value)} placeholder="اسم/نوع الشاشة" className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none" />
                <select value={requestScreenType} onChange={(e) => setRequestScreenType(e.target.value)} className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none">
                  <option value="normal">عادي</option>
                  <option value="oled">OLED</option>
                  <option value="original">أصلي</option>
                  <option value="copy">كوبي</option>
                  <option value="service_pack">Service Pack</option>
                </select>
                <input type="number" value={requestQuantity} onChange={(e) => setRequestQuantity(e.target.value)} placeholder="كم مرة انطلبت" className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none" />
              </div>
            )}

            {requestStockId && (
              <input type="number" value={requestQuantity} onChange={(e) => setRequestQuantity(e.target.value)} placeholder="كم مرة انطلبت" className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none w-full" />
            )}

            <input value={requestNotes} onChange={(e) => setRequestNotes(e.target.value)} placeholder="ملاحظات الطلب" className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none w-full" />

            <button disabled={submitting} className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 rounded-md h-8 text-[10px] font-black">
              {submitting ? "جاري..." : "تسجيل الطلب"}
            </button>
          </form>
        )}
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-sm font-black">مخزون الشاشات</h1>
            <p className="text-[9px] text-slate-500">المتوفر، الأكثر طلباً، متوسط الشراء، والمبيعات</p>
          </div>
          <button onClick={() => loadData()} className="bg-slate-800 hover:bg-slate-700 rounded-md px-3 h-8 text-[10px] font-black">
            تحديث
          </button>
        </div>

        {loading ? (
          <div className="text-center py-6 text-[10px] text-slate-500">جاري التحميل...</div>
        ) : stocks.length === 0 ? (
          <div className="text-center py-6 text-[10px] text-slate-500">لا توجد شاشات بعد</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1">
            {stocks.map((item) => (
              <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-md p-2">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h2 className="text-[11px] font-black leading-4">{screenTitle(item)}</h2>
                    <p className="text-[8px] text-slate-500 mt-1">{screenTypeLabel(item.screen_type)} - {item.notes || "بدون ملاحظات"}</p>
                  </div>

                  <div className={`rounded-md px-2 py-1 text-[9px] font-black ${Number(item.quantity || 0) > 0 ? "bg-green-600" : "bg-red-600"}`}>
                    {Number(item.quantity || 0) > 0 ? "متوفر" : "نافذ"}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1 mb-2">
                  <SmallBox title="الكمية" value={item.quantity} color="text-green-400" />
                  <SmallBox title="متوسط الشراء" value={avgCost(item)} color="text-blue-400" />
                  <SmallBox title="قيمة المخزون" value={item.total_cost} color="text-cyan-400" />
                  <SmallBox title="طلبات" value={item.request_count} color="text-orange-400" />
                  <SmallBox title="مبيعات" value={item.sales_count} color="text-emerald-400" />
                  <SmallBox title="بيع تقريبي" value={item.default_sell_price} color="text-white" />
                </div>

                <div className="grid grid-cols-2 gap-1">
                  <button type="button" onClick={() => setRequestStockId(item.id)} className="bg-orange-600 hover:bg-orange-700 rounded-md h-7 text-[9px] font-black">
                    تسجيل طلب
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSaleStockId(item.id);
                      setUnitSalePrice(item.default_sell_price ? String(item.default_sell_price) : "");
                    }}
                    disabled={Number(item.quantity || 0) <= 0}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-md h-7 text-[9px] font-black"
                  >
                    بيع
                  </button>
                  {canDelete && (
                    <button type="button" onClick={() => deleteStock(item)} className="col-span-2 bg-red-600 hover:bg-red-700 rounded-md h-7 text-[9px] font-black">
                      حذف
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
        <h2 className="text-sm font-black mb-2">آخر مبيعات الشاشات</h2>

        {sales.length === 0 ? (
          <div className="text-center py-6 text-[10px] text-slate-500">لا توجد مبيعات</div>
        ) : (
          <div className="space-y-1">
            {sales.map((sale) => (
              <div key={sale.id} className="bg-slate-900 border border-slate-800 rounded-md p-2 grid grid-cols-2 md:grid-cols-6 gap-1 items-center">
                <MiniText title="الشاشة" value={sale.mobile_screen_stock?.device_model || "-"} />
                <MiniText title="الكمية" value={sale.quantity} />
                <MiniText title="بيع القطعة" value={Number(sale.unit_sale_price || 0).toLocaleString()} />
                <MiniText title="الكلفة" value={Number(sale.total_cost_at_sale || 0).toLocaleString()} />
                <MiniText title="الربح" value={Number(sale.profit || 0).toLocaleString()} color="text-green-400" />
                <MiniText title="التاريخ" value={new Date(sale.created_at).toLocaleDateString()} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function screenTypeLabel(type) {
  switch (type) {
    case "oled":
      return "OLED";
    case "original":
      return "أصلي";
    case "copy":
      return "كوبي";
    case "service_pack":
      return "Service Pack";
    default:
      return "عادي";
  }
}

function StatCard({ title, value, color, isText = false }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
      <p className="text-[8px] text-slate-500 mb-1">{title}</p>
      <h2 className={`text-[10px] font-black truncate ${color}`}>
        {isText ? value : Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}

function SmallBox({ title, value, color }) {
  return (
    <div className="bg-slate-950 rounded-md p-1">
      <p className="text-[8px] text-slate-500">{title}</p>
      <h2 className={`text-[9px] font-black truncate ${color}`}>
        {Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}

function MiniText({ title, value, color = "text-white" }) {
  return (
    <div>
      <p className="text-[8px] text-slate-500 mb-1">{title}</p>
      <h2 className={`text-[9px] font-black truncate ${color}`}>{value}</h2>
    </div>
  );
}
