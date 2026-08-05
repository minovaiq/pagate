import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase/client";

export default function OrderTelegramSettings({ project }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchingChatId, setFetchingChatId] = useState(false);

  const [form, setForm] = useState({
    bot_token: "",
    chat_ids: [""],
    enabled: true,
    notify_new: true,
    notify_status: true,
  });

  useEffect(() => {
    loadSettings();
  }, [project.id]);

  function splitChatIds(value) {
    const ids = String(value || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    return ids.length ? ids : [""];
  }

  function cleanChatIds(ids) {
    return ids.map((v) => String(v || "").trim()).filter(Boolean);
  }

  async function loadSettings() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("order_telegram_settings")
        .select("*")
        .eq("project_id", project.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setForm({
          bot_token: data.bot_token || "",
          chat_ids: splitChatIds(data.chat_id),
          enabled: data.enabled !== false,
          notify_new: data.notify_new !== false,
          notify_status: data.notify_status !== false,
        });
      }
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل تحميل إعدادات بوت الطلبات");
    } finally {
      setLoading(false);
    }
  }

  function updateChatId(index, value) {
    setForm((prev) => {
      const next = [...prev.chat_ids];
      next[index] = value;
      return { ...prev, chat_ids: next };
    });
  }

  function addChatIdField() {
    setForm((prev) => ({
      ...prev,
      chat_ids: [...prev.chat_ids, ""],
    }));
  }

  function removeChatIdField(index) {
    setForm((prev) => {
      const next = prev.chat_ids.filter((_, i) => i !== index);
      return { ...prev, chat_ids: next.length ? next : [""] };
    });
  }

  async function fetchChatIds() {
    if (!form.bot_token.trim()) {
      alert("اكتب Bot Token أولاً");
      return;
    }

    try {
      setFetchingChatId(true);

      const res = await fetch(
        `https://api.telegram.org/bot${form.bot_token.trim()}/getUpdates`
      );

      const json = await res.json();

      if (!json.ok) {
        throw new Error(json.description || "فشل جلب Chat ID");
      }

      const foundIds = [];

      for (const item of json.result || []) {
        const id =
          item.message?.chat?.id ||
          item.channel_post?.chat?.id ||
          item.my_chat_member?.chat?.id ||
          item.chat_member?.chat?.id;

        if (id && !foundIds.includes(String(id))) {
          foundIds.push(String(id));
        }
      }

      if (!foundIds.length) {
        alert("لم يتم العثور على Chat ID. أرسل /start للبوت أو أضفه للكروب ثم أرسل رسالة.");
        return;
      }

      setForm((prev) => ({
        ...prev,
        chat_ids: foundIds,
      }));

      alert(`تم جلب ${foundIds.length} Chat ID`);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل جلب Chat ID");
    } finally {
      setFetchingChatId(false);
    }
  }

  async function saveSettings(e) {
    e.preventDefault();

    const chatIds = cleanChatIds(form.chat_ids);

    if (!form.bot_token.trim()) {
      alert("اكتب Bot Token");
      return;
    }

    if (!chatIds.length) {
      alert("اكتب Chat ID واحد على الأقل");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        project_id: project.id,
        bot_token: form.bot_token.trim(),
        chat_id: chatIds.join(","),
        enabled: form.enabled,
        notify_new: form.notify_new,
        notify_status: form.notify_status,
      };

      const { error } = await supabase
        .from("order_telegram_settings")
        .upsert(payload, { onConflict: "project_id" });

      if (error) throw error;

      alert("تم حفظ إعدادات بوت الطلبات");
      await loadSettings();
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    const chatIds = cleanChatIds(form.chat_ids);

    if (!form.bot_token.trim() || !chatIds.length) {
      alert("اكتب Bot Token و Chat ID أولاً");
      return;
    }

    try {
      const text = `✅ اختبار بوت الطلبات\n\nالمشروع: ${
        project.name || "بيجاتي"
      }\nالحالة: البوت يعمل بنجاح`;

      let success = 0;

      for (const chatId of chatIds) {
        const res = await fetch(
          `https://api.telegram.org/bot${form.bot_token.trim()}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text,
              parse_mode: "HTML",
            }),
          }
        );

        const json = await res.json();

        if (json.ok) success++;
        else console.log("Telegram Error:", json);
      }

      if (!success) throw new Error("فشل إرسال الاختبار لكل المحادثات");

      alert(`تم إرسال الاختبار إلى ${success} محادثة`);
    } catch (err) {
      console.log(err);
      alert(err.message || "فشل اختبار البوت");
    }
  }

  if (loading) {
    return (
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-6 text-center text-[11px] text-slate-400">
        جاري تحميل إعدادات البوت...
      </div>
    );
  }

  return (
    <div className="space-y-2" dir="rtl">
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
        <h1 className="text-sm font-black text-white">بوت الطلبات</h1>
        <p className="text-[10px] text-slate-500 mt-1">
          إعداد بوت تيليگرام لإشعارات طلبات المندوبين مع دعم أكثر من محادثة.
        </p>
      </div>

      <form
        onSubmit={saveSettings}
        className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-3"
      >
        <Input
          label="Bot Token"
          value={form.bot_token}
          onChange={(v) => setForm({ ...form, bot_token: v })}
          placeholder="123456:ABC..."
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-400 font-bold">
              Chat IDs
            </span>

            <button
              type="button"
              onClick={fetchChatIds}
              disabled={fetchingChatId}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-3 h-8 rounded-md text-[10px] font-black text-white"
            >
              {fetchingChatId ? "جاري الجلب..." : "جلب Chat ID تلقائيًا"}
            </button>
          </div>

          {form.chat_ids.map((chatId, index) => (
            <div key={index} className="grid grid-cols-[1fr_auto] gap-2">
              <input
                type="text"
                value={chatId}
                onChange={(e) => updateChatId(index, e.target.value)}
                placeholder="-100xxxxxxxxxx أو رقم المحادثة"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 h-10 text-[12px] text-white outline-none focus:border-teal-500"
              />

              <button
                type="button"
                onClick={() => removeChatIdField(index)}
                className="bg-red-600 hover:bg-red-700 px-3 h-10 rounded-lg text-[10px] font-black text-white"
              >
                حذف
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addChatIdField}
            className="w-full bg-slate-800 hover:bg-slate-700 rounded-lg h-9 text-[10px] font-black text-white"
          >
            + إضافة محادثة
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Check
            label="تفعيل البوت"
            checked={form.enabled}
            onChange={(v) => setForm({ ...form, enabled: v })}
          />

          <Check
            label="إشعار طلب جديد"
            checked={form.notify_new}
            onChange={(v) => setForm({ ...form, notify_new: v })}
          />

          <Check
            label="إشعار تغيير الحالة"
            checked={form.notify_status}
            onChange={(v) => setForm({ ...form, notify_status: v })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <button
            disabled={saving}
            className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 rounded-lg h-10 text-[11px] font-black text-white"
          >
            {saving ? "جاري الحفظ..." : "حفظ إعدادات البوت"}
          </button>

          <button
            type="button"
            onClick={sendTest}
            className="bg-slate-800 hover:bg-slate-700 rounded-lg h-10 text-[11px] font-black text-white"
          >
            إرسال رسالة اختبار
          </button>
        </div>
      </form>

      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
        <h2 className="text-[12px] font-black text-white mb-2">
          ملاحظات مهمة
        </h2>
        <div className="space-y-1 text-[10px] text-slate-400 leading-5">
          <p>1. أرسل /start للبوت حتى يظهر Chat ID الخاص.</p>
          <p>2. للكروبات أضف البوت للكروب وأرسل رسالة داخل الكروب.</p>
          <p>3. اضغط جلب Chat ID تلقائيًا وسيتم تعبئة الحقول.</p>
          <p>4. عند الحفظ، كل المحادثات ستستلم إشعارات الطلبات.</p>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder = "" }) {
  return (
    <label className="space-y-1 block">
      <span className="block text-[10px] text-slate-400 font-bold">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 h-10 text-[12px] text-white outline-none focus:border-teal-500"
      />
    </label>
  );
}

function Check({ label, checked, onChange }) {
  return (
    <label className="bg-slate-900 border border-slate-800 rounded-lg px-3 h-10 flex items-center gap-2 text-[11px] text-white font-bold">
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}