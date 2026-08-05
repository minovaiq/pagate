import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabase/client";
import { notifyTelegramOperation } from "../../services/supabase/telegram";
import { createMarketingNotification } from "./notificationService";

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
  const [archives, setArchives] = useState([]);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archivingMonth, setArchivingMonth] = useState(false);
  const [expandedArchiveId, setExpandedArchiveId] = useState(null);

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
      const [transactionsRes, spendRes, cardsRes, auditsRes, archivesRes] =
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

          supabase
            .from("promotion_monthly_archives")
            .select("*")
            .eq("project_id", project.id)
            .order("period_end", { ascending: false }),
        ]);

      if (transactionsRes.error) throw transactionsRes.error;
      if (spendRes.error) throw spendRes.error;
      if (cardsRes.error) throw cardsRes.error;
      if (auditsRes.error) throw auditsRes.error;
      if (archivesRes.error) throw archivesRes.error;

      setTransactions(transactionsRes.data || []);
      setSpendEntries(spendRes.data || []);
      setCards(cardsRes.data || []);
      setAudits(auditsRes.data || []);
      setArchives(archivesRes.data || []);
    } catch (err) {
      setDbError(
        err.message ||
          "تأكد من تنفيذ ملف SQL الخاص بجداول أمانات الترويج أولاً"
      );
    } finally {
      setLoading(false);
    }
  }

  const latestArchiveCreatedAt = archives[0]?.created_at || null;

  const activeTransactions = useMemo(
    () =>
      transactions.filter((item) =>
        isAfterArchiveCutoff(item.created_at, latestArchiveCreatedAt)
      ),
    [transactions, latestArchiveCreatedAt]
  );

  const activeSpendEntries = useMemo(
    () =>
      spendEntries.filter((item) =>
        isAfterArchiveCutoff(item.created_at || item.spend_date, latestArchiveCreatedAt)
      ),
    [spendEntries, latestArchiveCreatedAt]
  );

  const clientBalances = useMemo(() => {
    const grouped = {};

    for (const item of activeTransactions) {
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

    for (const spend of activeSpendEntries) {
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
  }, [activeTransactions, activeSpendEntries]);

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

      await createMarketingNotification({
        projectId: project.id,
        title: "تم تسجيل صرف إعلان",
        message: `${selectedClient.clientName}: ${amount.toLocaleString("en-US")} د.ع`,
        type: "promotion",
        severity: "info",
        dedupeKey: `ad-spend-${Date.now()}`,
        actionTab: "balances",
        metadata: { client_id: selectedClient.clientId, amount },
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

      await createMarketingNotification({
        projectId: project.id,
        title: difference < 0 ? "يوجد نقص في أمانات الترويج" : "تم حفظ جرد الترويج",
        message: `المتبقي للزبائن ${formatNumber(totalRemaining)} د.ع، البطاقات ${formatNumber(totalCardsBalance)} د.ع، الفرق ${formatNumber(difference)} د.ع`,
        type: "promotion",
        severity: difference < 0 ? "danger" : "success",
        dedupeKey: `promotion-audit-${today()}`,
        actionTab: "balances",
      });

      setAuditNote("");
      await loadAll();
    } catch (err) {
      alert(err.message || "فشل حفظ الجرد");
    } finally {
      setSavingAudit(false);
    }
  }

  async function archiveCurrentPeriod() {
    if (!canAdd) {
      alert("ليس لديك صلاحية الأرشفة");
      return;
    }

    if (activeTransactions.length === 0 && activeSpendEntries.length === 0) {
      alert("لا توجد مبالغ جديدة لأرشفتها");
      return;
    }

    setArchivingMonth(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const periodStart = findArchivePeriodStart(
        activeTransactions,
        activeSpendEntries,
        latestArchiveEnd
      );
      const periodEnd = today();
      const archiveName = formatArchiveName(periodEnd);

      const snapshot = clientBalances.map((client) => ({
        client_id: client.clientId || null,
        client_name: client.clientName,
        phone: client.phone,
        page_name: client.pageName,
        received: Math.round(client.received),
        ad_budget: Math.round(client.adBudget),
        actual_spent: Math.round(client.actualSpent),
        remaining: Math.round(client.remaining),
        profit: Math.round(client.profit),
        campaigns_count: client.count,
      }));

      const { error } = await supabase
        .from("promotion_monthly_archives")
        .insert([
          {
            project_id: project.id,
            user_id: user.id,
            archive_name: archiveName,
            period_start: periodStart,
            period_end: periodEnd,
            total_received: Math.round(totalReceived),
            total_ad_budget: Math.round(totalAdBudget),
            total_actual_spent: Math.round(totalActualSpent),
            total_remaining: Math.round(totalRemaining),
            total_cards_balance: Math.round(totalCardsBalance),
            difference: Math.round(difference),
            clients_count: clientBalances.length,
            snapshot,
          },
        ]);

      if (error) throw error;

      await notifyTelegramOperation({
        projectId: project.id,
        tableName: "promotion_monthly_archives",
        action: "create",
        title: "أرشفة أمانات الترويج",
        description: `${archiveName} - المتبقي: ${formatNumber(totalRemaining)} - عدد الزبائن: ${clientBalances.length}`,
        amount: Math.round(totalRemaining),
      });

      setShowArchiveModal(false);
      await loadAll();
    } catch (err) {
      alert(err.message || "فشل أرشفة مبالغ الشهر");
    } finally {
      setArchivingMonth(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-lg p-4 text-center text-[10px] text-slate-700 dark:text-slate-300">
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
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-slate-900 dark:text-white">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-sm font-black">أمانات الترويج</h1>
            <p className="text-[9px] text-slate-700 dark:text-slate-300">
              يوضح شكد باقي للزبائن وشكد متوفر فعلياً بالبطاقات
            </p>
          </div>

          <button
            type="button"
            onClick={loadAll}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md px-2 h-7 text-[9px] font-black"
          >
            تحديث
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-1">
          <MiniStat title="المستلم" value={totalReceived} color="text-green-600 dark:text-green-400" />
          <MiniStat title="مخصص الإعلان" value={totalAdBudget} color="text-amber-600 dark:text-amber-400" />
          <MiniStat title="المصروف فعلياً" value={totalActualSpent} color="text-red-600 dark:text-red-400" />
          <MiniStat title="باقي للزبائن" value={totalRemaining} color="text-blue-600 dark:text-blue-400" />
          <MiniStat
            title={difference < 0 ? "نقص بالبطاقات" : "زيادة/متوفر"}
            value={difference}
            color={difference < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}
          />
        </div>
      </div>

      <div className="space-y-2">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-slate-900 dark:text-white">
            <h2 className="text-xs font-black mb-2">تسجيل صرف إعلان فعلي</h2>

            {canAdd && (
              <form onSubmit={handleAddSpend} className="space-y-1">
                <div className="grid grid-cols-2 gap-1">
                  <select
                    value={spendClientId}
                    onChange={(e) => setSpendClientId(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />

                  <input
                    type="number"
                    value={spendAmount}
                    onChange={(e) => setSpendAmount(e.target.value)}
                    placeholder="المبلغ"
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />

                  <input
                    type="date"
                    value={spendDate}
                    onChange={(e) => setSpendDate(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
              {activeSpendEntries.slice(0, 20).map((spend) => (
                <div
                  key={spend.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-2 grid grid-cols-4 gap-1 items-center text-slate-900 dark:text-white"
                >
                  <div>
                    <p className="text-[10px] font-black truncate">
                      {spend.client_name}
                    </p>
                    <p className="text-[8px] text-slate-700 dark:text-slate-300">
                      {spend.spend_date}
                    </p>
                  </div>

                  <p className="text-[9px] text-slate-600 dark:text-slate-400 truncate col-span-1">
                    {spend.title}
                  </p>

                  <p className="text-[10px] font-black text-red-600 dark:text-red-400 text-left">
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

          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-slate-900 dark:text-white">
            <h2 className="text-xs font-black mb-2">البطاقات / المحافظ</h2>

            {canAdd && (
              <form onSubmit={handleAddCard} className="grid grid-cols-4 gap-1 mb-2">
                <input
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="اسم البطاقة"
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />

                <input
                  type="number"
                  value={cardBalance}
                  onChange={(e) => setCardBalance(e.target.value)}
                  placeholder="الرصيد"
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                />

                <input
                  value={cardNote}
                  onChange={(e) => setCardNote(e.target.value)}
                  placeholder="ملاحظة"
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
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
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-2 grid grid-cols-4 gap-1 items-center text-slate-900 dark:text-white"
                  >
                    <div>
                      <p className="text-[10px] font-black truncate">{card.name}</p>
                      <p className="text-[8px] text-slate-700 dark:text-slate-300 truncate">
                        {card.note || "-"}
                      </p>
                    </div>

                    <input
                      type="number"
                      defaultValue={Math.round(Number(card.current_balance || 0))}
                      onBlur={(e) => updateCardBalance(card, e.target.value)}
                      disabled={!canEdit}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md px-2 h-7 text-[10px] outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />

                    <p className="text-[10px] text-green-600 dark:text-green-400 font-black text-left">
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

          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-slate-900 dark:text-white">
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
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-2 py-2 h-16 text-[10px] outline-none resize-none mb-2 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />

            <div className="space-y-1">
              {audits.length === 0 ? (
                <EmptyText text="لا توجد جردات محفوظة" />
              ) : (
                audits.map((audit) => (
                  <div
                    key={audit.id}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-2 text-slate-900 dark:text-white"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-black">{audit.audit_date}</p>
                      <p
                        className={`text-[10px] font-black ${
                          Number(audit.difference || 0) < 0
                            ? "text-red-400"
                            : "text-green-600 dark:text-green-400"
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
                      <p className="text-[9px] text-slate-600 dark:text-slate-400 mt-1">
                        {audit.note}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-slate-900 dark:text-white">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-black">أرشيف المبالغ الشهرية</h2>
              <p className="mt-0.5 text-[8px] text-slate-600 dark:text-slate-300">
                الأرشفة تحفظ ملخص الشهر ولا تحذف العمليات الأصلية
              </p>
            </div>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-[9px] font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {archives.length} أرشيف
            </span>
          </div>

          {archives.length === 0 ? (
            <EmptyText text="لا توجد أشهر مؤرشفة" />
          ) : (
            <div className="space-y-1">
              {archives.map((archive) => {
                const expanded = expandedArchiveId === archive.id;
                const archivedClients = Array.isArray(archive.snapshot)
                  ? archive.snapshot
                  : [];

                return (
                  <div
                    key={archive.id}
                    className="rounded-md border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedArchiveId(expanded ? null : archive.id)
                      }
                      className="flex w-full items-center justify-between gap-2 text-right"
                    >
                      <div>
                        <p className="text-[10px] font-black">
                          {archive.archive_name}
                        </p>
                        <p className="text-[8px] text-slate-600 dark:text-slate-300">
                          {archive.period_start} إلى {archive.period_end}
                        </p>
                      </div>

                      <div className="text-left">
                        <p className="text-[10px] font-black text-blue-600 dark:text-blue-400">
                          المتبقي: {formatNumber(archive.total_remaining)}
                        </p>
                        <p className="text-[8px] text-slate-600 dark:text-slate-300">
                          {archive.clients_count || 0} زبون
                        </p>
                      </div>
                    </button>

                    {expanded && (
                      <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-800">
                        <div className="mb-2 grid grid-cols-2 gap-1 md:grid-cols-5">
                          <InfoBox title="المستلم" value={formatNumber(archive.total_received)} />
                          <InfoBox title="مخصص الإعلان" value={formatNumber(archive.total_ad_budget)} />
                          <InfoBox title="المصروف" value={formatNumber(archive.total_actual_spent)} />
                          <InfoBox title="المتبقي" value={formatNumber(archive.total_remaining)} color="text-blue-600 dark:text-blue-400" />
                          <InfoBox title="فرق البطاقات" value={formatNumber(archive.difference)} />
                        </div>

                        <div className="max-h-56 space-y-1 overflow-auto">
                          {archivedClients.map((client, index) => (
                            <div
                              key={`${archive.id}-${client.client_id || index}`}
                              className="grid grid-cols-2 gap-1 rounded-md border border-slate-200 bg-white p-2 text-[9px] dark:border-slate-800 dark:bg-slate-950 md:grid-cols-5"
                            >
                              <strong className="truncate">{client.client_name}</strong>
                              <span>مستلم: {formatNumber(client.received)}</span>
                              <span>إعلان: {formatNumber(client.ad_budget)}</span>
                              <span>مصروف: {formatNumber(client.actual_spent)}</span>
                              <span className="font-black text-blue-600 dark:text-blue-400">
                                باقي: {formatNumber(client.remaining)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-slate-900 dark:text-white">
          <h2 className="text-xs font-black mb-2">رصيد كل زبون</h2>

          {clientBalances.length === 0 ? (
            <EmptyText text="لا توجد معاملات ترويج" />
          ) : (
            <div className="space-y-1">
              {clientBalances.map((client) => (
                <div
                  key={client.clientId || client.clientName}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-2 text-slate-900 dark:text-white"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-[11px] font-black">{client.clientName}</h3>
                      <p className="text-[8px] text-slate-700 dark:text-slate-300">
                        {client.pageName} / {client.phone}
                      </p>
                    </div>

                    <div className="text-left">
  <p className="text-[8px] text-slate-700 dark:text-slate-300">
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
      </div>      {showArchiveModal && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm"
          onMouseDown={() => !archivingMonth && setShowArchiveModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-black">أرشفة مبالغ الشهر</h2>
                <p className="mt-1 text-[10px] leading-5 text-slate-600 dark:text-slate-300">
                  سيتم حفظ ملخص المبالغ الحالية وإخفاؤها من الجرد النشط. العمليات الأصلية لن تُحذف.
                </p>
              </div>

              <button
                type="button"
                disabled={archivingMonth}
                onClick={() => setShowArchiveModal(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-black text-slate-700 dark:bg-slate-800 dark:text-white"
              >
                ×
              </button>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-1">
              <InfoBox title="إجمالي المستلم" value={formatNumber(totalReceived)} />
              <InfoBox title="باقي الزبائن" value={formatNumber(totalRemaining)} color="text-blue-600 dark:text-blue-400" />
              <InfoBox title="عدد الزبائن" value={String(clientBalances.length)} />
              <InfoBox title="حتى تاريخ" value={today()} />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={archivingMonth}
                onClick={archiveCurrentPeriod}
                className="h-10 flex-1 rounded-lg bg-amber-500 text-[11px] font-black text-slate-950 hover:bg-amber-400 disabled:opacity-50"
              >
                {archivingMonth ? "جاري الأرشفة..." : "تأكيد الأرشفة"}
              </button>

              <button
                type="button"
                disabled={archivingMonth}
                onClick={() => setShowArchiveModal(false)}
                className="h-10 rounded-lg bg-slate-100 px-4 text-[11px] font-black text-slate-700 dark:bg-slate-800 dark:text-white"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function isAfterArchiveCutoff(value, cutoff) {
  if (!cutoff) return true;
  if (!value) return true;

  return new Date(value).getTime() > new Date(cutoff).getTime();
}

function findArchivePeriodStart(transactions, spendEntries, latestArchiveEnd) {
  if (latestArchiveEnd) {
    const date = new Date(`${latestArchiveEnd}T00:00:00`);
    date.setDate(date.getDate() + 1);
    return date.toISOString().slice(0, 10);
  }

  const dates = [
    ...transactions.map((item) => String(item.created_at || "").slice(0, 10)),
    ...spendEntries.map((item) =>
      String(item.spend_date || item.created_at || "").slice(0, 10)
    ),
  ].filter(Boolean);

  return dates.sort()[0] || `${today().slice(0, 7)}-01`;
}

function formatArchiveName(periodEnd) {
  const date = new Date(`${periodEnd}T00:00:00`);
  return `أرشيف ${new Intl.DateTimeFormat("ar-IQ", {
    month: "long",
    year: "numeric",
  }).format(date)}`;
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
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-2 text-slate-900 dark:text-white">
      <p className="text-[8px] text-slate-700 dark:text-slate-300 mb-1">{title}</p>
      <h2 className={`text-[10px] font-black ${color}`}>
        {formatNumber(value)}
      </h2>
    </div>
  );
}

function InfoBox({ title, value, color = "text-slate-900 dark:text-white" }) {
  return (
    <div className="bg-white dark:bg-slate-950 rounded-md p-2 text-slate-900 dark:text-white">
      <p className="text-[8px] text-slate-700 dark:text-slate-300 mb-1">{title}</p>
      <h2 className={`text-[10px] font-black truncate ${color}`}>
        {value || "-"}
      </h2>
    </div>
  );
}

function EmptyText({ text }) {
  return (
    <div className="text-center py-4 text-[10px] text-slate-700 dark:text-slate-300">
      {text}
    </div>
  );
}
