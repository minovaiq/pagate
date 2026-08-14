import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase/client";
import { notifyTelegramOperation } from "../../services/supabase/telegram";

const formatNumberInput=v=>String(v??"").replace(/\D/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,",");
const parseNumberInput=v=>String(v??"").replace(/,/g,"").replace(/\D/g,"");
export default function ClientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  const [addingPayment, setAddingPayment] = useState(false);
  const [paymentTitle, setPaymentTitle] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");

  useEffect(() => {
    loadSecureClient();
  }, [id]);

  async function loadSecureClient() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (clientError || !clientData) {
        setAllowed(false);
        setClient(null);
        return;
      }

      if (profile?.role !== "admin") {
        const { data: member } = await supabase
          .from("project_members")
          .select("id")
          .eq("project_id", clientData.project_id)
          .eq("user_id", user.id)
          .eq("can_view", true)
          .maybeSingle();

        if (!member) {
          setAllowed(false);
          setClient(null);
          return;
        }
      }

      setAllowed(true);
      setClient(clientData);

      const { data: transactionsData, error: transactionsError } =
        await supabase
          .from("transactions")
          .select("*")
          .eq("client_id", id)
          .eq("project_id", clientData.project_id)
          .order("created_at", { ascending: false });

      if (transactionsError) throw transactionsError;

      setTransactions(transactionsData || []);
    } catch (err) {
      console.log(err);
      setAllowed(false);
    } finally {
      setLoading(false);
    }
  }

  async function addManualPayment(e) {
    e.preventDefault();

    if (!paymentAmount || Number(paymentAmount) <= 0) {
      alert("اكتب مبلغ صحيح");
      return;
    }

    try {
      setAddingPayment(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const amountValue = Number(paymentAmount);
      const titleValue = paymentTitle.trim() || "دفعة جديدة";

      const { error } = await supabase.from("transactions").insert([
        {
          project_id: client.project_id,
          user_id: user.id,
          client_id: client.id,
          type: "income",
          service_type: "manual_payment",
          title: titleValue,
          amount_received: amountValue,
          company_profit: amountValue,
          client_name: client.full_name,
          client_phone: client.phone || null,
          client_page_name: client.page_name || null,
        },
      ]);

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: client.project_id,
        tableName: "transactions",
        action: "create",
        title: "إضافة دفعة للزبون",
        description: `${client.full_name} - ${titleValue}`,
        amount: amountValue,
      });

      setPaymentTitle("");
      setPaymentAmount("");

      await loadSecureClient();
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل إضافة الدفعة");
    } finally {
      setAddingPayment(false);
    }
  }

  async function deleteTransaction(item) {
    const ok = confirm("حذف العملية؟");
    if (!ok) return;

    try {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", item.id)
        .eq("client_id", client.id);

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: client.project_id,
        tableName: "transactions",
        action: "delete",
        title: "حذف عملية زبون",
        description: `${client.full_name} - ${item.title || "-"}`,
        amount: Number(item.amount_received || 0),
      });

      await loadSecureClient();
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل حذف العملية");
    }
  }

  function serviceName(type) {
    switch (type) {
      case "promotion":
        return "ترويج";
      case "programming":
        return "برمجة";
      case "design":
        return "تصميم";
      case "video_editing":
        return "مونتاج";
      case "consulting":
        return "استشارة";
      case "manual_payment":
        return "دفعة";
      default:
        return "أخرى";
    }
  }

  const totalAmount = transactions.reduce(
    (sum, item) => sum + Number(item.amount_received || 0),
    0
  );

  const totalProfit = transactions.reduce(
    (sum, item) => sum + Number(item.company_profit || 0),
    0
  );

  const totalAdSpend = transactions.reduce(
    (sum, item) => sum + Number(item.ad_spend_amount || 0),
    0
  );

  const campaignsCount = transactions.filter(
    (item) => item.service_type === "promotion"
  ).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        جاري التحميل...
      </div>
    );
  }

  if (!allowed || !client) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-slate-950 flex items-center justify-center p-4 text-white"
      >
        <div className="bg-slate-900 border border-red-900 rounded-2xl p-4 text-center">
          <h1 className="text-lg font-black text-red-400 mb-2">
            ليس لديك صلاحية
          </h1>

          <p className="text-[10px] text-slate-300 mb-3">
            لا يمكنك عرض هذا العميل
          </p>

          <button
            onClick={() => navigate("/")}
            className="bg-blue-600 hover:bg-blue-700 rounded-md px-4 h-8 text-[10px] font-black"
          >
            رجوع
          </button>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-white p-3">
      <div className="max-w-[1400px] mx-auto space-y-2">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-black">{client.full_name}</h1>

            <p className="text-[9px] text-slate-300 mt-1">
              {client.page_name || "-"}
            </p>
          </div>

          <button
            onClick={() => navigate(`/projects/${client.project_id}`)}
            className="bg-slate-800 hover:bg-slate-700 rounded-md px-2 h-7 text-[9px] font-black"
          >
            رجوع للمشروع
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
          <StatCard
            title="إجمالي المدفوع"
            value={totalAmount}
            color="text-green-400"
          />

          <StatCard
            title="أرباح الشركة"
            value={totalProfit}
            color="text-blue-400"
          />

          <StatCard
            title="صرف الإعلانات"
            value={totalAdSpend}
            color="text-red-400"
          />

          <StatCard
            title="عدد الحملات"
            value={campaignsCount}
            color="text-purple-400"
          />
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
          <h2 className="text-sm font-black mb-2">معلومات الزبون</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
            <InfoBox title="الاسم" value={client.full_name} />
            <InfoBox title="الهاتف" value={client.phone || "-"} />
            <InfoBox title="اسم البيج" value={client.page_name || "-"} />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
          <h2 className="text-sm font-black mb-2">إضافة دفعة</h2>

          <form
            onSubmit={addManualPayment}
            className="grid grid-cols-3 gap-1"
          >
            <input
              type="text"
              placeholder="عنوان الدفعة"
              value={paymentTitle}
              onChange={(e) => setPaymentTitle(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />

            <input
              type="number"
              placeholder="المبلغ"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
            />

            <button
              disabled={addingPayment}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md text-[10px] font-black"
            >
              {addingPayment ? "جاري..." : "إضافة دفعة"}
            </button>
          </form>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
          <h2 className="text-sm font-black mb-2">العمليات</h2>

          {transactions.length === 0 ? (
            <div className="text-center py-6 text-[10px] text-slate-300">
              لا توجد عمليات
            </div>
          ) : (
            <div className="space-y-1">
              {transactions.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-950 border border-slate-800 rounded-md p-2"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div>
                      <h3 className="text-[11px] font-black">
                        {item.title}
                      </h3>

                      <p className="text-[8px] text-slate-300">
                        {serviceName(item.service_type)}
                      </p>
                    </div>

                    <div className="text-left">
                      <h3 className="text-[10px] font-black text-green-400">
                        {Number(item.amount_received || 0).toLocaleString()}
                      </h3>

                      <button
                        onClick={() => deleteTransaction(item)}
                        className="mt-1 bg-red-600 hover:bg-red-700 rounded-md px-2 h-6 text-[8px] font-black"
                      >
                        حذف
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1">
                    <MiniBox
                      title="الترويج"
                      value={item.ad_spend_amount}
                      color="text-red-400"
                    />

                    <MiniBox
                      title="الربح"
                      value={item.company_profit}
                      color="text-blue-400"
                    />

                    <MiniBox
                      title="التاريخ"
                      value={new Date(item.created_at).toLocaleDateString()}
                      text
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, color }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
      <p className="text-[8px] text-slate-300 mb-1">{title}</p>

      <h2 className={`text-[10px] font-black ${color}`}>
        {Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}

function InfoBox({ title, value }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-md p-2">
      <p className="text-[8px] text-slate-300 mb-1">{title}</p>

      <h2 className="text-[10px] font-black">{value}</h2>
    </div>
  );
}

function MiniBox({ title, value, color = "text-white", text = false }) {
  return (
    <div className="bg-slate-900 rounded-md p-1">
      <p className="text-[8px] text-slate-300">{title}</p>

      <h2 className={`text-[9px] font-black ${color}`}>
        {text ? value : Number(value || 0).toLocaleString()}
      </h2>
    </div>
  );
}