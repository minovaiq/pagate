import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase/client";

export default function Settings() {
  const navigate = useNavigate();

  const [tab, setTab] = useState("telegram");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [telegramSaving, setTelegramSaving] = useState(false);
  const [telegramTesting, setTelegramTesting] = useState(false);
  const [telegramLoadingChat, setTelegramLoadingChat] = useState(false);
  const [alertSaving, setAlertSaving] = useState(false);

  const [projects, setProjects] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [members, setMembers] = useState([]);
  const [alertRules, setAlertRules] = useState([]);
const [renameProjectId, setRenameProjectId] = useState("");
const [renameProjectName, setRenameProjectName] = useState("");

const [notificationTitle, setNotificationTitle] = useState("");
const [notificationBody, setNotificationBody] = useState("");
const [notificationSending, setNotificationSending] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [createProjectId, setCreateProjectId] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editUserId, setEditUserId] = useState("");

  const [debugError, setDebugError] = useState("");

  const [telegramSettings, setTelegramSettings] = useState({
    bot_token: "",
    chat_id: "",
    enabled: true,
    notify_create: true,
    notify_update: true,
    notify_delete: true,
    notify_daily_missing: true,
    daily_report_enabled: true,
    daily_report_time: "23:59",
  });

  const [alertForm, setAlertForm] = useState({
    project_id: "",
    check_time: "23:00",
    require_income: true,
    require_expense: true,
    enabled: true,
  });

const [permissions, setPermissions] = useState({
  can_view: true,
  can_add: true,
  can_edit: false,
  can_delete: false,
  can_reports: true,

  can_pages_dashboard: true,
  can_campaigns: false,
  can_delegates: false,
  can_delegate_profits: false,
  can_user_orders: false,
  can_add_user_order: false,
  can_user_profits: false,
  can_wallet: false,
  can_balance: false,
  can_order_bot: false,

  can_export: false,
  can_manage_debts: false,
  can_manage_payments: false,
  can_settings: false,
  is_active: true,
});
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadSelectedPermissions();
  }, [editProjectId, editUserId]);

  function showError(title, error, data = null) {
    const message = {
      title,
      errorMessage: error?.message || null,
      errorStatus: error?.status || null,
      errorContext: error?.context || null,
      functionData: data,
      rawError: error,
    };

    console.log(message);
    setDebugError(JSON.stringify(message, null, 2));
  }

  async function loadData() {
    try {
      setLoading(true);
      setDebugError("");

      const [projectsRes, profilesRes, membersRes, telegramRes, alertRulesRes] =
        await Promise.all([
          supabase.from("projects").select("*").order("created_at", { ascending: false }),
          supabase.from("profiles").select("*").order("created_at", { ascending: false }),
          supabase.from("project_users").select("*").order("created_at", { ascending: false }),
          supabase.from("telegram_settings").select("*").limit(1).maybeSingle(),
          supabase.from("project_alert_rules").select("*").order("check_time", { ascending: true }),
        ]);

      if (projectsRes.error) throw projectsRes.error;
      if (profilesRes.error) throw profilesRes.error;

      if (membersRes.error) console.log("project_users view error:", membersRes.error);
      if (telegramRes.error) console.log("telegram settings error:", telegramRes.error);
      if (alertRulesRes.error) console.log("project_alert_rules error:", alertRulesRes.error);

      setProjects(projectsRes.data || []);
      setProfiles(profilesRes.data || []);
      setMembers(membersRes.data || []);
      setAlertRules(alertRulesRes.data || []);

      if (telegramRes.data) {
        setTelegramSettings({
          bot_token: telegramRes.data.bot_token || "",
          chat_id: telegramRes.data.chat_id || "",
          enabled: telegramRes.data.enabled !== false,
          notify_create: telegramRes.data.notify_create !== false,
          notify_update: telegramRes.data.notify_update !== false,
          notify_delete: telegramRes.data.notify_delete !== false,
          notify_daily_missing: telegramRes.data.notify_daily_missing !== false,
          daily_report_enabled: telegramRes.data.daily_report_enabled !== false,
          daily_report_time: telegramRes.data.daily_report_time || "23:59",
        });
      }
    } catch (err) {
      showError("loadData", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadSelectedPermissions() {
    if (!editProjectId || !editUserId) return;

    const { data, error } = await supabase
      .from("project_members")
      .select("*")
      .eq("project_id", editProjectId)
      .eq("user_id", editUserId)
      .maybeSingle();

    if (error) {
      console.log(error);
      return;
    }

    if (data) {
      setPermissions({
        can_view: !!data.can_view,
        can_add: !!data.can_add,
        can_edit: !!data.can_edit,
        can_delete: !!data.can_delete,
        can_reports: !!data.can_reports,
        can_export: !!data.can_export,
        can_manage_debts: !!data.can_manage_debts,
        can_manage_payments: !!data.can_manage_payments,
        can_settings: !!data.can_settings,
        is_active: data.is_active !== false,
      });
    } else {
      setPermissions({
        can_view: true,
        can_add: false,
        can_edit: false,
        can_delete: false,
        can_reports: false,
        can_export: false,
        can_manage_debts: false,
        can_manage_payments: false,
        can_settings: false,
        is_active: true,
      });
    }
  }

  async function saveTelegramSettings() {
    if (!telegramSettings.bot_token.trim()) {
      alert("اكتب توكن البوت أولاً");
      return;
    }

    if (!telegramSettings.chat_id.trim()) {
      alert("اكتب Chat ID أو اضغط جلب Chat ID");
      return;
    }

    try {
      setTelegramSaving(true);
      setDebugError("");

      const { data: oldSettings } = await supabase
        .from("telegram_settings")
        .select("id")
        .limit(1)
        .maybeSingle();

      const payload = {
        bot_token: telegramSettings.bot_token.trim(),
        chat_id: telegramSettings.chat_id.trim(),
        enabled: telegramSettings.enabled,
        notify_create: telegramSettings.notify_create,
        notify_update: telegramSettings.notify_update,
        notify_delete: telegramSettings.notify_delete,
        notify_daily_missing: telegramSettings.notify_daily_missing,
        daily_report_enabled: telegramSettings.daily_report_enabled,
        daily_report_time: telegramSettings.daily_report_time,
      };

      let error;

      if (oldSettings?.id) {
        const res = await supabase.from("telegram_settings").update(payload).eq("id", oldSettings.id);
        error = res.error;
      } else {
        const res = await supabase.from("telegram_settings").insert(payload);
        error = res.error;
      }

      if (error) throw error;

      alert("تم حفظ إعدادات التلكرام");
      await loadData();
    } catch (err) {
      showError("saveTelegramSettings", err);
    } finally {
      setTelegramSaving(false);
    }
  }

  async function fetchTelegramChatId() {
    if (!telegramSettings.bot_token.trim()) {
      alert("اكتب توكن البوت أولاً");
      return;
    }

    try {
      setTelegramLoadingChat(true);
      setDebugError("");

      const res = await fetch(
        `https://api.telegram.org/bot${telegramSettings.bot_token.trim()}/getUpdates`
      );

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.description || "فشل جلب Chat ID");
      }

      const updates = data.result || [];
      const lastMessage = [...updates].reverse().find((item) => item.message?.chat?.id);

      if (!lastMessage) {
        alert("ماكو رسالة واصلة للبوت. افتح التلكرام ودز /start للبوت وبعدها اضغط جلب Chat ID");
        return;
      }

      const chatId = String(lastMessage.message.chat.id);

      setTelegramSettings((prev) => ({
        ...prev,
        chat_id: chatId,
      }));

      alert(`تم جلب Chat ID: ${chatId}`);
    } catch (err) {
      showError("fetchTelegramChatId", err);
    } finally {
      setTelegramLoadingChat(false);
    }
  }

  async function testTelegramMessage() {
    if (!telegramSettings.bot_token.trim() || !telegramSettings.chat_id.trim()) {
      alert("اكتب التوكن والـ Chat ID أولاً");
      return;
    }

    try {
      setTelegramTesting(true);
      setDebugError("");

      const message = `
✅ رسالة فحص من نظام Finance OS

البوت شغال بنجاح.
راح توصلك إشعارات الإضافة والتعديل والحذف والتنبيهات اليومية والتقرير اليومي.
`;

      const res = await fetch(
        `https://api.telegram.org/bot${telegramSettings.bot_token.trim()}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramSettings.chat_id.trim(),
            text: message,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.description || "فشل إرسال رسالة الفحص");
      }

      alert("تم إرسال رسالة الفحص بنجاح");
    } catch (err) {
      showError("testTelegramMessage", err);
    } finally {
      setTelegramTesting(false);
    }
  }

  async function saveAlertRule(e) {
    e.preventDefault();

    if (!alertForm.project_id) {
      alert("اختر المشروع");
      return;
    }

    try {
      setAlertSaving(true);
      setDebugError("");

      const { error } = await supabase.from("project_alert_rules").upsert(
        {
          project_id: alertForm.project_id,
          check_time: alertForm.check_time || "23:00",
          require_income: alertForm.require_income,
          require_expense: alertForm.require_expense,
          enabled: alertForm.enabled,
        },
        { onConflict: "project_id" }
      );

      if (error) throw error;

      alert("تم حفظ وقت تنبيه المشروع");
      setAlertForm({
        project_id: "",
        check_time: "23:00",
        require_income: true,
        require_expense: true,
        enabled: true,
      });

      await loadData();
    } catch (err) {
      showError("saveAlertRule", err);
    } finally {
      setAlertSaving(false);
    }
  }

  async function deleteAlertRule(id) {
    const ok = confirm("حذف تنبيه هذا المشروع؟");
    if (!ok) return;

    try {
      const { error } = await supabase.from("project_alert_rules").delete().eq("id", id);
      if (error) throw error;
      await loadData();
    } catch (err) {
      showError("deleteAlertRule", err);
    }
  }

  function editAlertRule(rule) {
    setAlertForm({
      project_id: rule.project_id,
      check_time: String(rule.check_time || "23:00").slice(0, 5),
      require_income: !!rule.require_income,
      require_expense: !!rule.require_expense,
      enabled: rule.enabled !== false,
    });
    setTab("alerts");
  }

  async function createProjectUser(e) {
    e.preventDefault();

    if (!fullName.trim() || !email.trim() || !password.trim() || !createProjectId) {
      alert("اكتب الاسم والإيميل والباسورد واختر المشروع");
      return;
    }

    try {
      setCreating(true);
      setDebugError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-project-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${
              session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY
            }`,
          },
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: email.trim(),
            password: password.trim(),
            projectId: createProjectId,
            role: "user",
            permissions,
          }),
        }
      );

      const text = await response.text();

      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!response.ok || !data?.success) {
        showError(
          "Edge Function Error",
          {
            message: data?.error || data?.raw || "Unknown error",
            status: response.status,
            context: data,
          },
          data
        );
        return;
      }

      alert("تم إنشاء الحساب بنجاح");

      setFullName("");
      setEmail("");
      setPassword("");
      setCreateProjectId("");

      await loadData();
    } catch (err) {
      showError("createProjectUser", err);
    } finally {
      setCreating(false);
    }
  }

  async function savePermissions() {
    if (!editProjectId || !editUserId) {
      alert("اختر المشروع والحساب أولاً");
      return;
    }

    try {
      setSaving(true);
      setDebugError("");

      const { error } = await supabase.from("project_members").upsert(
        {
          project_id: editProjectId,
          user_id: editUserId,
          ...permissions,
        },
        { onConflict: "project_id,user_id" }
      );

      if (error) throw error;

      alert("تم حفظ الصلاحيات");
      await loadData();
    } catch (err) {
      showError("savePermissions", err);
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(id) {
    const ok = confirm("حذف الربط؟");
    if (!ok) return;

    try {
      const { error } = await supabase.from("project_members").delete().eq("id", id);
      if (error) throw error;
      await loadData();
    } catch (err) {
      showError("removeMember", err);
    }
  }

  function togglePermission(key) {
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }
async function updateProjectName() {
  if (!renameProjectId || !renameProjectName.trim()) {
    alert("اختر المشروع واكتب الاسم الجديد");
    return;
  }

  const { error } = await supabase
    .from("projects")
    .update({ name: renameProjectName.trim() })
    .eq("id", renameProjectId);

  if (error) {
    showError("updateProjectName", error);
    return;
  }

  alert("تم تعديل اسم المشروع");
  setRenameProjectId("");
  setRenameProjectName("");
  await loadData();
}

async function sendAppNotification() {
  if (!notificationTitle.trim() || !notificationBody.trim()) {
    alert("اكتب عنوان ونص الإشعار");
    return;
  }

  try {
    setNotificationSending(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push-notification`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${
            session?.access_token ||
            import.meta.env.VITE_SUPABASE_ANON_KEY
          }`,
        },
        body: JSON.stringify({
          title: notificationTitle.trim(),
          body: notificationBody.trim(),
        }),
      }
    );

    const result = await response.json();

    if (!response.ok || !result?.success) {
      throw new Error(result?.error || "فشل إرسال الإشعار");
    }

    alert(
      `تم إرسال الإشعار\n\nوصل: ${result.sent}\nفشل: ${result.failed}`
    );

    setNotificationTitle("");
    setNotificationBody("");
  } catch (err) {
    showError("sendAppNotification", err);
  } finally {
    setNotificationSending(false);
  }
}  function getProjectName(projectId) {
    return projects.find((p) => p.id === projectId)?.name || "-";
  }

  const normalProfiles = profiles.filter((profile) => profile.role !== "admin");

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        تحميل...
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-950 text-white p-2 text-[11px]">
      <div className="max-w-[1400px] mx-auto space-y-2">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-black">الإعدادات</h1>
            <p className="text-[9px] text-slate-500">
              إدارة التلكرام، التنبيهات، الحسابات، والصلاحيات
            </p>
          </div>

          <button
            onClick={() => navigate("/dashboard")}
            className="bg-slate-800 hover:bg-slate-700 rounded-md px-2 h-7 text-[9px] font-black"
          >
            رجوع
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-1 grid grid-cols-2 md:grid-cols-7 gap-1">
          <TabButton title="تلكرام" value="telegram" tab={tab} setTab={setTab} />
          <TabButton title="تنبيهات" value="alerts" tab={tab} setTab={setTab} />
          <TabButton title="حسابات" value="accounts" tab={tab} setTab={setTab} />
          <TabButton title="صلاحيات" value="permissions" tab={tab} setTab={setTab} />
          <TabButton title="المرتبطين" value="members" tab={tab} setTab={setTab} />
<TabButton title="المشاريع" value="projects" tab={tab} setTab={setTab} />
<TabButton title="إشعارات التطبيق" value="push" tab={tab} setTab={setTab} />
        </div>

        {debugError && (
          <div className="bg-red-950 border border-red-800 rounded-lg p-2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[11px] font-black text-red-300">
                سبب الخطأ الحقيقي
              </h2>

              <button
                onClick={() => navigator.clipboard.writeText(debugError)}
                className="bg-red-700 hover:bg-red-600 rounded-md px-2 h-7 text-[9px] font-black"
              >
                نسخ الخطأ
              </button>
            </div>

            <pre className="bg-slate-950 border border-red-900 rounded-md p-2 text-[10px] text-red-200 overflow-auto max-h-[250px] whitespace-pre-wrap">
              {debugError}
            </pre>
          </div>
        )}

        {tab === "telegram" && (
          <Section title="بوت التلكرام" subtitle="إعداد البوت وفحص الإشعارات والتقرير اليومي">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 mb-2">
              <input
                value={telegramSettings.bot_token}
                onChange={(e) =>
                  setTelegramSettings((prev) => ({
                    ...prev,
                    bot_token: e.target.value,
                  }))
                }
                placeholder="Telegram Bot Token"
                className="bg-slate-950 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
              />

              <div className="grid grid-cols-[1fr_auto] gap-1">
                <input
                  value={telegramSettings.chat_id}
                  onChange={(e) =>
                    setTelegramSettings((prev) => ({
                      ...prev,
                      chat_id: e.target.value,
                    }))
                  }
                  placeholder="Chat ID"
                  className="bg-slate-950 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
                />

                <button
                  type="button"
                  onClick={fetchTelegramChatId}
                  disabled={telegramLoadingChat}
                  className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 rounded-md px-3 h-9 text-[9px] font-black"
                >
                  {telegramLoadingChat ? "جلب..." : "جلب Chat ID"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-1 mb-2">
              <SwitchButton label="تفعيل البوت" active={telegramSettings.enabled} onClick={() => setTelegramSettings((p) => ({ ...p, enabled: !p.enabled }))} />
              <SwitchButton label="إشعار إضافة" active={telegramSettings.notify_create} onClick={() => setTelegramSettings((p) => ({ ...p, notify_create: !p.notify_create }))} />
              <SwitchButton label="إشعار تعديل" active={telegramSettings.notify_update} onClick={() => setTelegramSettings((p) => ({ ...p, notify_update: !p.notify_update }))} />
              <SwitchButton label="إشعار حذف" active={telegramSettings.notify_delete} onClick={() => setTelegramSettings((p) => ({ ...p, notify_delete: !p.notify_delete }))} />
              <SwitchButton label="تنبيه يومي" active={telegramSettings.notify_daily_missing} onClick={() => setTelegramSettings((p) => ({ ...p, notify_daily_missing: !p.notify_daily_missing }))} />
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-md p-2 mb-2">
              <h3 className="text-[11px] font-black mb-1">التقرير اليومي التلقائي</h3>

              <div className="grid grid-cols-2 gap-1">
                <SwitchButton
                  label="تفعيل التقرير"
                  active={telegramSettings.daily_report_enabled}
                  onClick={() =>
                    setTelegramSettings((prev) => ({
                      ...prev,
                      daily_report_enabled: !prev.daily_report_enabled,
                    }))
                  }
                />

                <input
                  type="time"
                  value={telegramSettings.daily_report_time}
                  onChange={(e) =>
                    setTelegramSettings((prev) => ({
                      ...prev,
                      daily_report_time: e.target.value,
                    }))
                  }
                  className="bg-slate-900 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
                />
              </div>

              <p className="text-[8px] text-slate-500 mt-1">
                الفنكشن تشتغل كل دقيقة، وترسل التقرير فقط عند هذا الوقت.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={saveTelegramSettings}
                disabled={telegramSaving}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md h-9 text-[10px] font-black"
              >
                {telegramSaving ? "جاري الحفظ..." : "حفظ إعدادات التلكرام"}
              </button>

              <button
                type="button"
                onClick={testTelegramMessage}
                disabled={telegramTesting}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md h-9 text-[10px] font-black"
              >
                {telegramTesting ? "جاري الفحص..." : "فحص إرسال رسالة"}
              </button>
            </div>

            <p className="text-[9px] text-slate-500 mt-2">
              ملاحظة: حتى يشتغل جلب Chat ID، افتح البوت بالتلكرام ودزله /start أولاً.
            </p>
          </Section>
        )}

        {tab === "alerts" && (
          <Section title="تنبيهات المشاريع" subtitle="وقت فحص تسجيل الدخل والصرفيات لكل مشروع">
            <form onSubmit={saveAlertRule} className="grid grid-cols-2 md:grid-cols-6 gap-1 mb-2">
              <select
                value={alertForm.project_id}
                onChange={(e) => setAlertForm((prev) => ({ ...prev, project_id: e.target.value }))}
                className="bg-slate-950 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
              >
                <option value="">اختر المشروع</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>

              <input
                type="time"
                value={alertForm.check_time}
                onChange={(e) => setAlertForm((prev) => ({ ...prev, check_time: e.target.value }))}
                className="bg-slate-950 border border-slate-800 rounded-md px-2 h-9 text-[10px] outline-none"
              />

              <SwitchButton label="يتطلب دخل" active={alertForm.require_income} onClick={() => setAlertForm((p) => ({ ...p, require_income: !p.require_income }))} />
              <SwitchButton label="يتطلب صرفيات" active={alertForm.require_expense} onClick={() => setAlertForm((p) => ({ ...p, require_expense: !p.require_expense }))} />
              <SwitchButton label="مفعل" active={alertForm.enabled} onClick={() => setAlertForm((p) => ({ ...p, enabled: !p.enabled }))} />

              <button
                disabled={alertSaving}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-md h-9 text-[10px] font-black"
              >
                {alertSaving ? "حفظ..." : "حفظ الوقت"}
              </button>
            </form>

            <div className="space-y-1">
              {alertRules.map((rule) => (
                <div
                  key={rule.id}
                  className="bg-slate-950 border border-slate-800 rounded-md p-2 flex items-center justify-between gap-2"
                >
                  <div>
                    <h3 className="text-[11px] font-black">
                      {getProjectName(rule.project_id)}
                    </h3>

                    <p className="text-[8px] text-slate-500">
                      وقت الفحص: {String(rule.check_time || "23:00").slice(0, 5)} -{" "}
                      {rule.require_income ? "دخل" : ""}{" "}
                      {rule.require_expense ? "صرفيات" : ""} -{" "}
                      {rule.enabled ? "مفعل" : "متوقف"}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => editAlertRule(rule)}
                      className="bg-slate-800 hover:bg-slate-700 rounded-md px-2 h-7 text-[9px] font-black"
                    >
                      تعديل
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteAlertRule(rule.id)}
                      className="bg-red-600 hover:bg-red-700 rounded-md px-2 h-7 text-[9px] font-black"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}

              {alertRules.length === 0 && (
                <div className="text-center text-slate-500 py-4">
                  لا توجد أوقات متابعة محفوظة
                </div>
              )}
            </div>
          </Section>
        )}

        {tab === "accounts" && (
          <Section title="إنشاء حساب" subtitle="إنشاء حساب وربطه بمشروع مباشرة">
            <form onSubmit={createProjectUser}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1 mb-2">
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="اسم الحساب" className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="الإيميل" className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none" />
                <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="الباسورد" className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none" />

                <select value={createProjectId} onChange={(e) => setCreateProjectId(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-md px-2 h-8 text-[10px] outline-none">
                  <option value="">اختر المشروع</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </div>

              <PermissionsGrid permissions={permissions} togglePermission={togglePermission} />

              <button disabled={creating} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md h-9 text-[10px] font-black">
                {creating ? "جاري الإنشاء..." : "إنشاء الحساب"}
              </button>
            </form>
          </Section>
        )}

        {tab === "permissions" && (
          <Section title="تعديل الصلاحيات" subtitle="تعديل صلاحيات حساب مرتبط بمشروع">
            <div className="grid grid-cols-2 gap-1 mb-2">
              <select value={editProjectId} onChange={(e) => setEditProjectId(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-md px-2 h-9 text-[10px]">
                <option value="">اختر المشروع</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>

              <select value={editUserId} onChange={(e) => setEditUserId(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-md px-2 h-9 text-[10px]">
                <option value="">اختر الحساب</option>
                {normalProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name || profile.email || "بدون اسم"}
                  </option>
                ))}
              </select>
            </div>

            <PermissionsGrid permissions={permissions} togglePermission={togglePermission} />

            <button onClick={savePermissions} disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md h-10 text-[10px] font-black">
              {saving ? "جاري حفظ الصلاحيات..." : "حفظ الصلاحيات"}
            </button>
          </Section>
        )}
{tab === "projects" && (
  <Section title="تعديل اسم المشروع">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
      <select
        value={renameProjectId}
        onChange={(e) => {
          const projectId = e.target.value;
          setRenameProjectId(projectId);
          setRenameProjectName(
            projects.find((p) => p.id === projectId)?.name || ""
          );
        }}
        className="bg-slate-950 border border-slate-800 rounded-md px-2 h-9 text-[10px]"
      >
        <option value="">اختر المشروع</option>

        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>

      <input
        value={renameProjectName}
        onChange={(e) => setRenameProjectName(e.target.value)}
        placeholder="الاسم الجديد"
        className="bg-slate-950 border border-slate-800 rounded-md px-2 h-9 text-[10px]"
      />

      <button
        onClick={updateProjectName}
        className="bg-amber-600 hover:bg-amber-700 rounded-md h-9 text-[10px] font-black"
      >
        حفظ اسم المشروع
      </button>
    </div>
  </Section>
)}

{tab === "push" && (
  <Section title="إشعارات التطبيق">
    <div className="space-y-1">
      <input
        value={notificationTitle}
        onChange={(e) => setNotificationTitle(e.target.value)}
        placeholder="عنوان الإشعار"
        className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 h-9 text-[10px]"
      />

      <textarea
        value={notificationBody}
        onChange={(e) => setNotificationBody(e.target.value)}
        placeholder="نص الإشعار"
        rows={4}
        className="w-full bg-slate-950 border border-slate-800 rounded-md px-2 py-2 text-[10px]"
      />

      <button
        onClick={sendAppNotification}
        disabled={notificationSending}
        className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-md h-9 text-[10px] font-black"
      >
        إرسال الإشعار
      </button>
    </div>
  </Section>
)}

        {tab === "members" && (
          <Section title="الحسابات المرتبطة" subtitle="عرض كل المستخدمين المرتبطين بالمشاريع">
            <div className="flex justify-end mb-2">
              <button onClick={loadData} className="bg-slate-800 hover:bg-slate-700 rounded-md px-2 h-7 text-[9px] font-black">
                تحديث
              </button>
            </div>

            {members.length > 0 ? (
              <div className="space-y-1">
                {members.map((member) => (
                  <div key={member.id} className="bg-slate-950 border border-slate-800 rounded-md p-2">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <h3 className="text-[11px] font-black">
                          {member.full_name || member.email || "بدون اسم"}
                        </h3>

                        <p className="text-[8px] text-slate-500">
                          {member.project_name || getProjectName(member.project_id)}
                        </p>
                      </div>

                      <button onClick={() => removeMember(member.id)} className="bg-red-600 hover:bg-red-700 rounded-md px-2 h-6 text-[9px] font-black">
                        حذف الربط
                      </button>
                    </div>

                    <div className="grid grid-cols-5 md:grid-cols-9 gap-1">
                      <MiniPermission title="عرض" active={member.can_view} />
                      <MiniPermission title="إضافة" active={member.can_add} />
                      <MiniPermission title="تعديل" active={member.can_edit} />
                      <MiniPermission title="حذف" active={member.can_delete} />
                      <MiniPermission title="تقارير" active={member.can_reports} />
                      <MiniPermission title="تصدير" active={member.can_export} />
                      <MiniPermission title="ديون" active={member.can_manage_debts} />
                      <MiniPermission title="مدفوعات" active={member.can_manage_payments} />
                      <MiniPermission title="إعدادات" active={member.can_settings} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-500 py-6">لا توجد حسابات مرتبطة</div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-2">
      <div className="mb-2">
        <h2 className="text-[12px] font-black">{title}</h2>
        {subtitle && <p className="text-[9px] text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function TabButton({ title, value, tab, setTab }) {
  const active = tab === value;

  return (
    <button
      type="button"
      onClick={() => setTab(value)}
      className={`h-9 rounded-md text-[10px] font-black border ${
        active
          ? "bg-blue-600 text-white border-blue-500"
          : "bg-slate-950 border-slate-800 text-slate-500 hover:text-white"
      }`}
    >
      {title}
    </button>
  );
}

function PermissionsGrid({ permissions, togglePermission }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-1 mb-2">

      <PermissionButton
        label="عرض"
        active={permissions.can_view}
        color="blue"
        onClick={() => togglePermission("can_view")}
      />

      <PermissionButton
        label="إضافة"
        active={permissions.can_add}
        color="green"
        onClick={() => togglePermission("can_add")}
      />

      <PermissionButton
        label="تعديل"
        active={permissions.can_edit}
        color="yellow"
        onClick={() => togglePermission("can_edit")}
      />

      <PermissionButton
        label="حذف"
        active={permissions.can_delete}
        color="red"
        onClick={() => togglePermission("can_delete")}
      />

      <PermissionButton
        label="تقارير"
        active={permissions.can_reports}
        color="purple"
        onClick={() => togglePermission("can_reports")}
      />

      <PermissionButton
        label="الرئيسية"
        active={permissions.can_pages_dashboard}
        color="blue"
        onClick={() => togglePermission("can_pages_dashboard")}
      />

      <PermissionButton
        label="الحملات"
        active={permissions.can_campaigns}
        color="green"
        onClick={() => togglePermission("can_campaigns")}
      />

      <PermissionButton
        label="المندوبين"
        active={permissions.can_delegates}
        color="yellow"
        onClick={() => togglePermission("can_delegates")}
      />

      <PermissionButton
        label="أرباح المندوب"
        active={permissions.can_delegate_profits}
        color="purple"
        onClick={() => togglePermission("can_delegate_profits")}
      />

      <PermissionButton
        label="طلبات المندوبين"
        active={permissions.can_user_orders}
        color="blue"
        onClick={() => togglePermission("can_user_orders")}
      />

      <PermissionButton
        label="إضافة طلب"
        active={permissions.can_add_user_order}
        color="green"
        onClick={() => togglePermission("can_add_user_order")}
      />

      <PermissionButton
        label="أرباح الطلبات"
        active={permissions.can_user_profits}
        color="yellow"
        onClick={() => togglePermission("can_user_profits")}
      />

      <PermissionButton
        label="محفظتي"
        active={permissions.can_wallet}
        color="purple"
        onClick={() => togglePermission("can_wallet")}
      />

      <PermissionButton
        label="الرصيد"
        active={permissions.can_balance}
        color="red"
        onClick={() => togglePermission("can_balance")}
      />

      <PermissionButton
        label="بوت الطلبات"
        active={permissions.can_order_bot}
        color="green"
        onClick={() => togglePermission("can_order_bot")}
      />

      <PermissionButton
        label="إعدادات"
        active={permissions.can_settings}
        color="red"
        onClick={() => togglePermission("can_settings")}
      />
    </div>
  );
}

function PermissionButton({ label, active, onClick, color }) {
  const colors = {
    blue: active ? "bg-blue-600 text-white" : "",
    green: active ? "bg-green-600 text-white" : "",
    yellow: active ? "bg-yellow-500 text-black" : "",
    red: active ? "bg-red-600 text-white" : "",
    purple: active ? "bg-purple-600 text-white" : "",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 rounded-md text-[10px] font-black border ${
        active ? colors[color] : "bg-slate-950 border-slate-800 text-slate-500"
      }`}
    >
      {label}
    </button>
  );
}

function SwitchButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 rounded-md text-[9px] font-black border ${
        active
          ? "bg-emerald-600 text-white border-emerald-500"
          : "bg-slate-950 border-slate-800 text-slate-500"
      }`}
    >
      {label}
    </button>
  );
}

function MiniPermission({ title, active }) {
  return (
    <div
      className={`rounded-md p-1 text-center text-[8px] font-black ${
        active ? "bg-green-600 text-white" : "bg-slate-800 text-slate-500"
      }`}
    >
      {title}
    </div>
  );
}