import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { notifyTelegramOperation } from "../../services/supabase/telegram";

export default function Products({
  project,
  canAdd = true,
  canDelete = true,
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [category, setCategory] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [sellProduct, setSellProduct] = useState(null);
  const [sellQty, setSellQty] = useState("1");

  const [search, setSearch] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("store_products")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setProducts(data || []);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل تحميل المنتجات");
    } finally {
      setLoading(false);
    }
  }

  async function addProduct(e) {
    e.preventDefault();

    if (!canAdd) {
      alert("ليس لديك صلاحية الإضافة");
      return;
    }

    if (!name.trim()) {
      alert("اكتب اسم المنتج");
      return;
    }

    try {
      setSaving(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const nameValue = name.trim();
      const barcodeValue = barcode.trim() || null;
      const categoryValue = category.trim() || null;
      const purchaseValue = Number(purchasePrice || 0);
      const saleValue = Number(salePrice || 0);
      const quantityValue = Number(quantity || 0);

      const { error } = await supabase.from("store_products").insert([
        {
          project_id: project.id,
          user_id: user.id,
          name: nameValue,
          barcode: barcodeValue,
          category: categoryValue,
          purchase_price: purchaseValue,
          sale_price: saleValue,
          quantity: quantityValue,
          image_url: imageUrl.trim() || null,
        },
      ]);

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "store_products",
        action: "create",
        title: "إضافة منتج",
        description: `${nameValue} - ${categoryValue || "بدون قسم"} - الكمية: ${quantityValue}`,
        amount: purchaseValue * quantityValue,
      });

      setName("");
      setBarcode("");
      setCategory("");
      setPurchasePrice("");
      setSalePrice("");
      setQuantity("");
      setImageUrl("");

      await loadProducts();
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل إضافة المنتج");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(product) {
    if (!canDelete) {
      alert("ليس لديك صلاحية الحذف");
      return;
    }

    const ok = confirm("هل تريد حذف المنتج؟");
    if (!ok) return;

    const { error } = await supabase
      .from("store_products")
      .delete()
      .eq("id", product.id)
      .eq("project_id", project.id);

    if (error) {
      alert(error.message);
      return;
    }

    await notifyTelegramOperation({
      projectId: project.id,
      tableName: "store_products",
      action: "delete",
      title: "حذف منتج",
      description: `${product.name || "منتج"} - ${product.category || "بدون قسم"} - الكمية: ${Number(product.quantity || 0).toLocaleString("en-US")}`,
      amount: Number(product.purchase_price || 0) * Number(product.quantity || 0),
    });

    await loadProducts();
  }

  async function sellNow(e) {
    e.preventDefault();

    if (!sellProduct) return;

    const qty = Number(sellQty || 0);

    if (qty <= 0) {
      alert("اكتب كمية صحيحة");
      return;
    }

    if (qty > Number(sellProduct.quantity || 0)) {
      alert("الكمية أكبر من المخزون");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const totalSale = Number(sellProduct.sale_price || 0) * qty;
      const totalCost = Number(sellProduct.purchase_price || 0) * qty;
      const profit = totalSale - totalCost;
      const newQty = Number(sellProduct.quantity || 0) - qty;

      const { error: updateError } = await supabase
        .from("store_products")
        .update({ quantity: newQty })
        .eq("id", sellProduct.id)
        .eq("project_id", project.id);

      if (updateError) throw updateError;

      const { error: transactionError } = await supabase
        .from("transactions")
        .insert([
          {
            project_id: project.id,
            user_id: user.id,
            type: "income",
            service_type: "store_sale",
            title: `بيع ${sellProduct.name}`,
            amount_received: totalSale,
            company_profit: profit,
          },
        ]);

      if (transactionError) throw transactionError;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "transactions",
        action: "create",
        title: "بيع منتج",
        description: `${sellProduct.name} - الكمية: ${qty} - الربح: ${profit.toLocaleString("en-US")} - المتبقي: ${newQty}`,
        amount: totalSale,
      });

      if (newQty <= 3) {
        await notifyTelegramOperation({
          projectId: project.id,
          tableName: "store_products",
          action: "low_stock",
          title: "تنبيه نقص مخزون",
          description: `${sellProduct.name} - المتبقي: ${newQty}`,
          amount: 0,
        });
      }

      setSellProduct(null);
      setSellQty("1");

      await loadProducts();
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل بيع المنتج");
    }
  }

  const filteredProducts = products.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;

    return (
      item.name?.toLowerCase().includes(q) ||
      item.barcode?.toLowerCase().includes(q) ||
      item.category?.toLowerCase().includes(q)
    );
  });

  const totalStockValue = products.reduce(
    (sum, item) =>
      sum + Number(item.purchase_price || 0) * Number(item.quantity || 0),
    0
  );

  const expectedSalesValue = products.reduce(
    (sum, item) =>
      sum + Number(item.sale_price || 0) * Number(item.quantity || 0),
    0
  );

  const expectedProfit = expectedSalesValue - totalStockValue;

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-sm font-black">المنتجات</h1>
          <p className="text-[9px] text-slate-500">
            إدارة المخزون والبيع المباشر
          </p>
        </div>

        <button
          onClick={loadProducts}
          className="bg-slate-800 hover:bg-slate-700 rounded-md px-2 h-7 text-[9px] font-black"
        >
          تحديث
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1 mb-2">
        <MiniStat title="المنتجات" value={products.length} color="text-green-400" simple />
        <MiniStat title="قيمة الشراء" value={totalStockValue} color="text-cyan-400" />
        <MiniStat title="قيمة البيع" value={expectedSalesValue} color="text-blue-400" />
        <MiniStat title="ربح متوقع" value={expectedProfit} color="text-purple-400" />
      </div>

      {canAdd && (
        <form onSubmit={addProduct} className="space-y-1 mb-2">
          <div className="grid grid-cols-4 gap-1">
            <input
              type="text"
              placeholder="اسم المنتج"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />

            <input
              type="text"
              placeholder="الباركود"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />

            <input
              type="text"
              placeholder="القسم"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />

            <input
              type="text"
              placeholder="رابط الصورة"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />
          </div>

          <div className="grid grid-cols-4 gap-1">
            <input
              type="number"
              placeholder="سعر الشراء"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />

            <input
              type="number"
              placeholder="سعر البيع"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />

            <input
              type="number"
              placeholder="الكمية"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />

            <button
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-md text-[10px] font-black"
            >
              {saving ? "جاري..." : "إضافة منتج"}
            </button>
          </div>
        </form>
      )}

      <input
        type="text"
        placeholder="بحث بالاسم أو الباركود أو القسم"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none mb-2"
      />

      {sellProduct && (
        <form
          onSubmit={sellNow}
          className="bg-slate-900 border border-green-800 rounded-md p-2 mb-2"
        >
          <h2 className="text-[11px] font-black mb-1">
            بيع: {sellProduct.name}
          </h2>

          <div className="grid grid-cols-3 gap-1">
            <input
              type="number"
              placeholder="الكمية"
              value={sellQty}
              onChange={(e) => setSellQty(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
            />

            <button className="bg-green-600 hover:bg-green-700 rounded-md text-[10px] font-black">
              تأكيد البيع
            </button>

            <button
              type="button"
              onClick={() => setSellProduct(null)}
              className="bg-slate-700 hover:bg-slate-600 rounded-md text-[10px] font-black"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-6 text-[10px] text-slate-500">
          جاري التحميل...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-6 text-[10px] text-slate-500">
          لا توجد منتجات
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1">
          {filteredProducts.map((product) => {
            const itemProfit =
              Number(product.sale_price || 0) -
              Number(product.purchase_price || 0);

            const lowStock = Number(product.quantity || 0) <= 3;

            return (
              <div
                key={product.id}
                className="bg-slate-900 border border-slate-800 rounded-md p-2"
              >
                <div className="flex gap-2 mb-2">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-12 h-12 rounded-md object-cover border border-slate-800"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-md bg-slate-950 border border-slate-800 flex items-center justify-center text-[9px] text-slate-500">
                      صورة
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h2 className="text-[11px] font-black truncate">
                      {product.name}
                    </h2>

                    <p className="text-[8px] text-slate-500 truncate">
                      {product.category || "بدون قسم"}
                    </p>

                    <p className="text-[8px] text-slate-500 truncate">
                      {product.barcode || "بدون باركود"}
                    </p>
                  </div>

                  <div className="text-left">
                    <h2
                      className={`text-[11px] font-black ${
                        lowStock ? "text-red-400" : "text-green-400"
                      }`}
                    >
                      {Number(product.quantity || 0).toLocaleString()}
                    </h2>

                    <p className="text-[8px] text-slate-500">قطعة</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1 mb-1">
                  <InfoBox
                    title="شراء"
                    value={product.purchase_price}
                    color="text-red-400"
                  />

                  <InfoBox
                    title="بيع"
                    value={product.sale_price}
                    color="text-green-400"
                  />

                  <InfoBox
                    title="ربح"
                    value={itemProfit}
                    color="text-blue-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setSellProduct(product)}
                    className="bg-green-600 hover:bg-green-700 rounded-md h-7 text-[9px] font-black"
                  >
                    بيع
                  </button>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => deleteProduct(product)}
                      className="bg-red-600 hover:bg-red-700 rounded-md h-7 text-[9px] font-black"
                    >
                      حذف
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MiniStat({ title, value, color, simple = false }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-md p-2">
      <p className="text-[8px] text-slate-500 mb-1">{title}</p>
      <h2 className={`text-[10px] font-black ${color}`}>
        {simple
          ? Number(value || 0).toLocaleString()
          : Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}

function InfoBox({ title, value, color = "text-white" }) {
  return (
    <div className="bg-slate-950 rounded-md p-1">
      <p className="text-[8px] text-slate-500">{title}</p>
      <h2 className={`text-[9px] font-black truncate ${color}`}>
        {Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}