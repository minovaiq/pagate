import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { notifyTelegramOperation } from "../../services/supabase/telegram";

const formatNumberInput=v=>String(v??"").replace(/\D/g,"").replace(/\B(?=(\d{3})+(?!\d))/g,",");
const parseNumberInput=v=>String(v??"").replace(/,/g,"").replace(/\D/g,"");
export default function PromotionBalances({
  project,
  canAdd = true,
  canEdit = true,
  canDelete = true,
}) {
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState("");

  const [transactions, setTransactions] = useState([]);
  const [spendEntries, setSpendEntries] = useState([]);
  const [cards, setCards] = useState([]);
  const [audits, setAudits] = useState([]);

  const [spendClientId, setSpendClientId] = useState("");
  const [spendCardId, setSpendCardId] = useState("");
  const [spendTitle, setSpendTitle] = useState("");
  const [spendAmount, setSpendAmount] = useState("");
  const [spendDate, setSpendDate] = useState(today());
  const [submittingSpend, setSubmittingSpend] = useState(false);

  const [cardName, setCardName] = useState("");
  const [cardBalance, setCardBalance] = useState("");
  const [cardNote, setCardNote] = useState("");
  const [savingCard, setSavingCard] = useState(false);

  const [auditNote, setAuditNote] = useState("");
  const [savingAudit, setSavingAudit] = useState(false);

  useEffect(() => {
    loadAll();
  }, [project?.id]);

  async function loadAll() {
    if (!project?.id) return;

    setLoading(true);
    setDbError("");

    try {
      const [transactionsRes, spendRes, cardsRes, auditsRes] =
        await Promise.all([
          supabase
            .from("transactions")
            .select(`*, clients(full_name, phone, page_name)`)
            .eq("project_id", project.id)
            .eq("type", "income")
            .eq("service_type", "promotion")
            .order("created_at", { ascending: false }),

          supabase
            .from("promotion_ad_spend_entries")
            .select("*")
            .eq("project_id", project.id)
            .order("spend_date", { ascending: false }),

          supabase
            .from("promotion_cards")
            .select("*")
            .eq("project_id", project.id)
            .order("created_at", { ascending: false }),

          supabase
            .from("promotion_weekly_audits")
            .select("*")
            .eq("project_id", project.id)
            .order("audit_date", { ascending: false })
            .limit(10),
        ]);

      if (transactionsRes.error) throw transactionsRes.error;
      if (spendRes.error) throw spendRes.error;
      if (cardsRes.error) throw cardsRes.error;
      if (auditsRes.error) throw auditsRes.error;

      setTransactions(transactionsRes.data || []);
      setSpendEntries(spendRes.data || []);
      setCards(cardsRes.data || []);
      setAudits(auditsRes.data || []);
    } catch (err) {
      setDbError(
        err.message ||
          "تأكد من تنفيذ ملف SQL الخاص بجداول أمانات الترويج أولاً"
      );
    } finally {
      setLoading(false);
    }
  }

  const clientBalances = useMemo(() => {
    const grouped = {};

    for (const item of transactions) {
      const key = item.client_id || item.client_name || item.id;

      if (!grouped[key]) {
        grouped[key] = {
          clientId: item.client_id,
          clientName: item.clients?.full_name || item.client_name || "-",
          phone: item.clients?.phone || item.client_phone || "-",
          pageName: item.clients?.page_name || item.client_page_name || "-",
          received: 0,
          adBudget: 0,
          profit: 0,
          actualSpent: 0,
          remaining: 0,
          count: 0,
        };
      }

      grouped[key].received += Number(item.amount_received || 0);
      grouped[key].adBudget += Number(item.ad_spend_amount || 0);
      grouped[key].profit += Number(item.company_profit || 0);
      grouped[key].count += 1;
    }

    for (const spend of spendEntries) {
      const key = spend.client_id || spend.client_name || spend.id;

      if (!grouped[key]) {
        grouped[key] = {
          clientId: spend.client_id,
          clientName: spend.client_name || "-",
          phone: "-",
          pageName: "-",
          received: 0,
          adBudget: 0,
          profit: 0,
          actualSpent: 0,
          remaining: 0,
          count: 0,
        };
      }

      grouped[key].actualSpent += Number(spend.amount || 0);
    }

    return Object.values(grouped)
      .map((item) => ({
        ...item,
        remaining: item.adBudget - item.actualSpent,
      }))
      .sort((a, b) => b.remaining - a.remaining);
  }, [transactions, spendEntries]);

  const clientsForSelect = clientBalances.filter((item) => item.clientId);

  const totalReceived = sum(clientBalances, "received");
  const totalAdBudget = sum(clientBalances, "adBudget");
  const totalActualSpent = sum(clientBalances, "actualSpent");
  const totalRemaining = totalAdBudget - totalActualSpent;
  const totalCardsBalance = cards.reduce(
    (total, card) => total + Number(card.current_balance || 0),
    0
  );
  const difference = totalCardsBalance - totalRemaining;

  async function handleAddSpend(e) {
    e.preventDefault();

    if (!canAdd) {
      alert("ليس لديك صلاحية الإضافة");
      return;
    }

    if (!spendClientId) {
      alert("اختر الزبون");
      return;
    }

    if (!spendAmount || Number(spendAmount) <= 0) {
      alert("اكتب مبلغ صرف صحيح");
      return;
    }

    setSubmittingSpend(true);

    try {
      const selectedClient = clientBalances.find(
        (item) => String(item.clientId) === String(spendClientId)
      );

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const amount = Math.round(Number(spendAmount || 0));

      const { error } = await supabase.from("promotion_ad_spend_entries").insert([
        {
          project_id: project.id,
          user_id: user.id,
          client_id: selectedClient.clientId,
          client_name: selectedClient.clientName,
          card_id: spendCardId || null,
          title: spendTitle.trim() || "صرف إعلان فعلي",
          amount,
          spend_date: spendDate || today(),
        },
      ]);

      if (error) throw error;

      if (spendCardId) {
        const card = cards.find((item) => String(item.id) === String(spendCardId));

        if (card) {
          const newBalance = Number(card.current_balance || 0) - amount;

          await supabase
            .from("promotion_cards")
            .update({ current_balance: newBalance })
            .eq("id", card.id);
        }
      }

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "promotion_ad_spend_entries",
        action: "create",
        title: "صرف إعلان فعلي",
        description: `${selectedClient.clientName} - ${spendTitle || "صرف إعلان"}`,
        amount,
      });

      setSpendClientId("");
      setSpendCardId("");
      setSpendTitle("");
      setSpendAmount("");
      setSpendDate(today());

      await loadAll();
    } catch (err) {
      alert(err.message || "فشل تسجيل صرف الإعلان");
    } finally {
      setSubmittingSpend(false);
    }
  }

  async function handleAddCard(e) {
    e.preventDefault();

    if (!canAdd) {
      alert("ليس لديك صلاحية الإضافة");
      return;
    }

    if (!cardName.trim()) {
      alert("اكتب اسم البطاقة");
      return;
    }

    setSavingCard(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from("promotion_cards").insert([
        {
          project_id: project.id,
          user_id: user.id,
          name: cardName.trim(),
          current_balance: Math.round(Number(cardBalance || 0)),
          note: cardNote.trim() || null,
        },
      ]);

      if (error) throw error;

      setCardName("");
      setCardBalance("");
      setCardNote("");

      await loadAll();
    } catch (err) {
      alert(err.message || "فشل إضافة البطاقة");
    } finally {
      setSavingCard(false);
    }
  }

  async function updateCardBalance(card, value) {
    if (!canEdit) return;

    const newBalance = Math.round(Number(value || 0));

    const { error } = await supabase
      .from("promotion_cards")
      .update({ current_balance: newBalance })
      .eq("id", card.id);

    if (error) {
      alert(error.message);
      return;
    }

    setCards((prev) =>
      prev.map((item) =>
        item.id === card.id ? { ...item, current_balance: newBalance } : item
      )
    );
  }

  async function deleteCard(card) {
    if (!canDelete) {
      alert("ليس لديك صلاحية الحذف");
      return;
    }

    const ok = confirm(`حذف البطاقة "${card.name}"؟`);
    if (!ok) return;

    const { error } = await supabase
      .from("promotion_cards")
      .delete()
      .eq("id", card.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadAll();
  }

  async function deleteSpend(spend) {
    if (!canDelete) {
      alert("ليس لديك صلاحية الحذف");
      return;
    }

    const ok = confirm("حذف عملية الصرف الفعلي؟");
    if (!ok) return;

    const { error } = await supabase
      .from("promotion_ad_spend_entries")
      .delete()
      .eq("id", spend.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadAll();
  }

  async function saveWeeklyAudit() {
    if (!canAdd) {
      alert("ليس لديك صلاحية الإضافة");
      return;
    }

    setSavingAudit(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { error } = await supabase.from("promotion_weekly_audits").insert([
        {
          project_id: project.id,
          user_id: user.id,
          audit_date: today(),
          total_clients_remaining: Math.round(totalRemaining),
          total_cards_balance: Math.round(totalCardsBalance),
          difference: Math.round(difference),
          note: auditNote.trim() || null,
        },
      ]);

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "promotion_weekly_audits",
        action: "create",
        title: "حفظ جرد أمانات الترويج",
        description: `المتبقي للزبائن: ${formatNumber(totalRemaining)} / الموجود بالبطاقات: ${formatNumber(totalCardsBalance)}`,
        amount: Math.round(difference),
      });

      setAuditNote("");
      await loadAll();
    } catch (err) {
      alert(err.message || "فشل حفظ الجرد");
    } finally {
      setSavingAudit(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-center text-[10px] text-slate-300">
        جاري تحميل أمانات الترويج...
      </div>
    );
  }

  if (dbError) {
    return (
      <div className="bg-red-950/40 border border-red-900 rounded-lg p-3">
        <h2 className="text-sm font-black text-red-300 mb-1">
          تحتاج تنفيذ SQL أولاً
        </h2>
        <p className="text-[10px] text-red-200 leading-5">{dbError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-sm font-black">أمانات الترويج</h1>
            <p className="text-[9px] text-slate-300">
              يوضح شكد باقي للزبائن وشكد متوفر فعلياً بالبطاقات
            </p>
          </div>

          <button
            type="button"
            onClick={loadAll}
            className="bg-slate-800 hover:bg-slate-700 rounded-md px-2 h-7 text-[9px] font-black"
          >
            تحديث
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-1">
          <MiniStat title="المستلم" value={totalReceived} color="text-green-400" />
          <MiniStat title="مخصص الإعلان" value={totalAdBudget} color="text-amber-400" />
          <MiniStat title="المصروف فعلياً" value={totalActualSpent} color="text-red-400" />
          <MiniStat title="باقي للزبائن" value={totalRemaining} color="text-blue-400" />
          <MiniStat
            title={difference < 0 ? "نقص بالبطاقات" : "زيادة/متوفر"}
            value={difference}
            color={difference < 0 ? "text-red-400" : "text-green-400"}
          />
        </div>
      </div>

      <div className="space-y-2">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
            <h2 className="text-xs font-black mb-2">تسجيل صرف إعلان فعلي</h2>

            {canAdd && (
              <form onSubmit={handleAddSpend} className="space-y-1">
                <div className="grid grid-cols-2 gap-1">
                  <select
                    value={spendClientId}
                    onChange={(e) => setSpendClientId(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
                  >
                    <option value="">اختر الزبون</option>
                    {clientsForSelect.map((client) => (
                      <option key={client.clientId} value={client.clientId}>
                        {client.clientName} - باقي {formatNumber(client.remaining)}
                      </option>
                    ))}
                  </select>

                  <select
                    value={spendCardId}
                    onChange={(e) => setSpendCardId(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
                  >
                    <option value="">بدون بطاقة</option>
                    {cards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name} - {formatNumber(card.current_balance)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-1">
                  <input
                    type="text"
                    value={spendTitle}
                    onChange={(e) => setSpendTitle(e.target.value)}
                    placeholder="وصف الصرف"
                    className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
                  />

                  <input
                    type="number"
                    value={spendAmount}
                    onChange={(e) => setSpendAmount(e.target.value)}
                    placeholder="المبلغ"
                    className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
                  />

                  <input
                    type="date"
                    value={spendDate}
                    onChange={(e) => setSpendDate(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
                  />
                </div>

                <button
                  disabled={submittingSpend}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md h-8 text-[10px] font-black"
                >
                  {submittingSpend ? "جاري الحفظ..." : "تسجيل الصرف الفعلي"}
                </button>
              </form>
            )}

            <div className="mt-2 space-y-1 max-h-56 overflow-auto">
              {spendEntries.slice(0, 20).map((spend) => (
                <div
                  key={spend.id}
                  className="bg-slate-900 border border-slate-800 rounded-md p-2 grid grid-cols-4 gap-1 items-center"
                >
                  <div>
                    <p className="text-[10px] font-black truncate">
                      {spend.client_name}
                    </p>
                    <p className="text-[8px] text-slate-300">
                      {spend.spend_date}
                    </p>
                  </div>

                  <p className="text-[9px] text-slate-400 truncate col-span-1">
                    {spend.title}
                  </p>

                  <p className="text-[10px] font-black text-red-400 text-left">
                    {formatNumber(spend.amount)}
                  </p>

                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => deleteSpend(spend)}
                      className="bg-red-600 hover:bg-red-700 rounded-md h-6 text-[9px] font-black"
                    >
                      حذف
                    </button>
                  ) : (
                    <div />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
            <h2 className="text-xs font-black mb-2">البطاقات / المحافظ</h2>

            {canAdd && (
              <form onSubmit={handleAddCard} className="grid grid-cols-4 gap-1 mb-2">
                <input
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="اسم البطاقة"
                  className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
                />

                <input
                  type="number"
                  value={cardBalance}
                  onChange={(e) => setCardBalance(e.target.value)}
                  placeholder="الرصيد"
                  className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
                />

                <input
                  value={cardNote}
                  onChange={(e) => setCardNote(e.target.value)}
                  placeholder="ملاحظة"
                  className="bg-slate-900 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none"
                />

                <button
                  disabled={savingCard}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md text-[10px] font-black"
                >
                  إضافة
                </button>
              </form>
            )}

            <div className="space-y-1">
              {cards.length === 0 ? (
                <EmptyText text="لا توجد بطاقات" />
              ) : (
                cards.map((card) => (
                  <div
                    key={card.id}
                    className="bg-slate-900 border border-slate-800 rounded-md p-2 grid grid-cols-4 gap-1 items-center"
                  >
                    <div>
                      <p className="text-[10px] font-black truncate">{card.name}</p>
                      <p className="text-[8px] text-slate-300 truncate">
                        {card.note || "-"}
                      </p>
                    </div>

                    <input
                      type="number"
                      defaultValue={Math.round(Number(card.current_balance || 0))}
                      onBlur={(e) => updateCardBalance(card, e.target.value)}
                      disabled={!canEdit}
                      className="bg-slate-950 border border-slate-800 rounded-md px-2 h-7 text-[10px] outline-none"
                    />

                    <p className="text-[10px] text-green-400 font-black text-left">
                      {formatNumber(card.current_balance)}
                    </p>

                    {canDelete ? (
                      <button
                        type="button"
                        onClick={() => deleteCard(card)}
                        className="bg-red-600 hover:bg-red-700 rounded-md h-7 text-[9px] font-black"
                      >
                        حذف
                      </button>
                    ) : (
                      <div />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-black">الجرد الأسبوعي</h2>

              <button
                type="button"
                onClick={saveWeeklyAudit}
                disabled={savingAudit || !canAdd}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md px-2 h-7 text-[9px] font-black"
              >
                {savingAudit ? "جاري..." : "حفظ جرد اليوم"}
              </button>
            </div>

            <textarea
              value={auditNote}
              onChange={(e) => setAuditNote(e.target.value)}
              placeholder="ملاحظات الجرد"
              className="w-full bg-slate-900 border border-slate-800 rounded-md px-2 py-2 h-16 text-[10px] outline-none resize-none mb-2"
            />

            <div className="space-y-1">
              {audits.length === 0 ? (
                <EmptyText text="لا توجد جردات محفوظة" />
              ) : (
                audits.map((audit) => (
                  <div
                    key={audit.id}
                    className="bg-slate-900 border border-slate-800 rounded-md p-2"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-black">{audit.audit_date}</p>
                      <p
                        className={`text-[10px] font-black ${
                          Number(audit.difference || 0) < 0
                            ? "text-red-400"
                            : "text-green-400"
                        }`}
                      >
                        الفرق: {formatNumber(audit.difference)}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-1">
                      <InfoBox
                        title="باقي الزبائن"
                        value={formatNumber(audit.total_clients_remaining)}
                      />
                      <InfoBox
                        title="رصيد البطاقات"
                        value={formatNumber(audit.total_cards_balance)}
                      />
                    </div>

                    {audit.note && (
                      <p className="text-[9px] text-slate-400 mt-1">
                        {audit.note}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

        <div className="bg-slate-950 border border-slate-800 rounded-lg p-2">
          <h2 className="text-xs font-black mb-2">رصيد كل زبون</h2>

          {clientBalances.length === 0 ? (
            <EmptyText text="لا توجد معاملات ترويج" />
          ) : (
            <div className="space-y-1">
              {clientBalances.map((client) => (
                <div
                  key={client.clientId || client.clientName}
                  className="bg-slate-900 border border-slate-800 rounded-md p-2"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-[11px] font-black">{client.clientName}</h3>
                      <p className="text-[8px] text-slate-300">
                        {client.pageName} / {client.phone}
                      </p>
                    </div>

                    <div className="text-left">
  <p className="text-[8px] text-slate-300">
    {client.count} حملة
  </p>
</div>
                  </div>

                  <div className="grid grid-cols-4 gap-1">
<InfoBox title="مستلم" value={formatNumber(client.received)} />

<InfoBox
  title="مخصص للإعلان"
  value={formatNumber(client.adBudget)}
/>

<InfoBox
  title="مصروف فعلياً"
  value={formatNumber(client.actualSpent)}
/>

<InfoBox
  title="رصيد الزبون"
  value={formatNumber(client.remaining)}
  color={
    client.remaining > 0
      ? "text-green-400"
      : client.remaining < 0
      ? "text-red-400"
      : "text-slate-400"
  }
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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function sum(list, key) {
  return list.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function formatNumber(value) {
  return Math.round(Number(value || 0)).toLocaleString("en-US");
}

function MiniStat({ title, value, color }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-md p-2">
      <p className="text-[8px] text-slate-300 mb-1">{title}</p>
      <h2 className={`text-[10px] font-black ${color}`}>
        {formatNumber(value)}
      </h2>
    </div>
  );
}

function InfoBox({ title, value, color = "text-white" }) {
  return (
    <div className="bg-slate-950 rounded-md p-2">
      <p className="text-[8px] text-slate-300 mb-1">{title}</p>
      <h2 className={`text-[10px] font-black truncate ${color}`}>
        {value || "-"}
      </h2>
    </div>
  );
}

function EmptyText({ text }) {
  return (
    <div className="text-center py-4 text-[10px] text-slate-300">
      {text}
    </div>
  );
}
