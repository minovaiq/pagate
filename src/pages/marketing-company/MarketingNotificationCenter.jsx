import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../services/supabase/client";

const severityStyles = {
  success:
    "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30",
  warning:
    "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30",
  danger:
    "border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30",
  info: "border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/30",
};

const typeIcons = {
  finance: "💰",
  expense: "💸",
  promotion: "📣",
  client: "👤",
  archive: "📦",
  goal: "🎯",
  system: "⚙️",
};

export default function MarketingNotificationCenter({ project }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef(null);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications]
  );

  useEffect(() => {
    if (!project?.id) return;

    loadNotifications();

    const channel = supabase
      .channel(`marketing-notifications-${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "marketing_notifications",
          filter: `project_id=eq.${project.id}`,
        },
        (payload) => {
          loadNotifications();

          if (payload.eventType === "INSERT" && payload.new) {
            showBrowserNotification(payload.new);
          }
        }
      )
      .subscribe();

    const localCreated = (event) => {
      loadNotifications();
      if (event.detail) showBrowserNotification(event.detail);
    };

    window.addEventListener(
      "marketing-notification-created",
      localCreated
    );

    return () => {
      window.removeEventListener(
        "marketing-notification-created",
        localCreated
      );
      supabase.removeChannel(channel);
    };
  }, [project?.id]);

  useEffect(() => {
    const closeOnOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, []);

  async function loadNotifications() {
    try {
      const { data, error } = await supabase
        .from("marketing_notifications")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.warn("Notifications unavailable:", error.message);
    } finally {
      setLoading(false);
    }
  }

  function showBrowserNotification(item) {
    if (
      !("Notification" in window) ||
      Notification.permission !== "granted" ||
      document.visibilityState === "visible"
    ) {
      return;
    }

    const notification = new Notification(item.title || "تنبيه جديد", {
      body: item.message || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: item.dedupe_key || item.id,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }

  async function requestBrowserPermission() {
    if (!("Notification" in window)) {
      alert("هذا المتصفح لا يدعم الإشعارات");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      new Notification("تم تشغيل الإشعارات", {
        body: "ستصلك التنبيهات أثناء تشغيل النظام أو تثبيته كتطبيق.",
      });
    }
  }

  async function markAsRead(item) {
    if (item.is_read) return;

    const { error } = await supabase
      .from("marketing_notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", item.id);

    if (!error) {
      setNotifications((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, is_read: true } : row
        )
      );
    }
  }

  async function markAllAsRead() {
    const unreadIds = notifications
      .filter((item) => !item.is_read)
      .map((item) => item.id);

    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from("marketing_notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .in("id", unreadIds);

    if (!error) {
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, is_read: true }))
      );
    }
  }

  async function deleteNotification(id) {
    const { error } = await supabase
      .from("marketing_notifications")
      .delete()
      .eq("id", id);

    if (!error) {
      setNotifications((prev) => prev.filter((item) => item.id !== id));
    }
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-black text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
        aria-label="الإشعارات"
      >
        <span>🔔</span>
        <span>التنبيهات</span>

        {unreadCount > 0 && (
          <span className="flex min-w-4 h-4 items-center justify-center rounded-full bg-red-600 px-1 text-[8px] text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-9 z-[200] w-[min(92vw,390px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                مركز التنبيهات
              </h2>
              <p className="text-[9px] text-slate-600 dark:text-slate-300">
                {unreadCount} غير مقروء
              </p>
            </div>

            <div className="flex gap-1">
              <button
                type="button"
                onClick={requestBrowserPermission}
                className="h-7 rounded-md bg-blue-600 px-2 text-[9px] font-black text-white hover:bg-blue-700"
              >
                إشعارات الهاتف
              </button>

              <button
                type="button"
                onClick={markAllAsRead}
                className="h-7 rounded-md bg-slate-100 px-2 text-[9px] font-black text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-white"
              >
                قراءة الكل
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-auto p-2">
            {loading ? (
              <p className="py-6 text-center text-[10px] text-slate-600 dark:text-slate-300">
                جاري التحميل...
              </p>
            ) : notifications.length === 0 ? (
              <p className="py-6 text-center text-[10px] text-slate-600 dark:text-slate-300">
                لا توجد تنبيهات
              </p>
            ) : (
              <div className="space-y-1.5">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => markAsRead(item)}
                    className={`cursor-pointer rounded-lg border p-2.5 ${
                      severityStyles[item.severity] || severityStyles.info
                    } ${item.is_read ? "opacity-70" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 gap-2">
                        <span className="text-base">
                          {typeIcons[item.type] || "🔔"}
                        </span>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <h3 className="truncate text-[11px] font-black text-slate-900 dark:text-white">
                              {item.title}
                            </h3>

                            {!item.is_read && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                            )}
                          </div>

                          {item.message && (
                            <p className="mt-1 text-[9px] leading-4 text-slate-700 dark:text-slate-200">
                              {item.message}
                            </p>
                          )}

                          <p className="mt-1 text-[8px] text-slate-500 dark:text-slate-400">
                            {new Date(item.created_at).toLocaleString("ar-IQ")}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteNotification(item.id);
                        }}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] text-slate-500 hover:bg-black/10 dark:text-slate-300"
                        aria-label="حذف"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
