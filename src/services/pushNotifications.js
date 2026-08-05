import { supabase } from "./supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
const SERVICE_WORKER_PATH = "/push-handler.js";

export function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export function isStandalonePwa() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export function getPushSupportStatus() {
  if (!("serviceWorker" in navigator)) {
    return { supported: false, reason: "service-worker" };
  }

  if (!("PushManager" in window) || !("Notification" in window)) {
    return { supported: false, reason: "push-api" };
  }

  if (isIosDevice() && !isStandalonePwa()) {
    return { supported: false, reason: "ios-install-required" };
  }

  if (!VAPID_PUBLIC_KEY?.trim()) {
    return { supported: false, reason: "missing-vapid-key" };
  }

  return { supported: true, reason: null };
}

export async function registerPushServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("المتصفح لا يدعم Service Worker");
  }

  const registration = await navigator.serviceWorker.register(
    SERVICE_WORKER_PATH,
    { scope: "/" }
  );

  return navigator.serviceWorker.ready;
}

export async function enablePushNotifications(projectId) {
  if (!projectId) {
    throw new Error("معرّف المشروع غير موجود");
  }

  const status = getPushSupportStatus();

  if (!status.supported) {
    if (status.reason === "ios-install-required") {
      throw new Error(
        "على iPhone افتح الموقع من Safari، ثم مشاركة ← إضافة إلى الشاشة الرئيسية، وبعدها افتحه من الأيقونة."
      );
    }

    if (status.reason === "missing-vapid-key") {
      throw new Error(
        "مفتاح VAPID العام غير مضاف إلى VITE_VAPID_PUBLIC_KEY"
      );
    }

    throw new Error("هذا الجهاز أو المتصفح لا يدعم Web Push");
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("لم يتم منح إذن الإشعارات");
  }

  const registration = await registerPushServiceWorker();
  let pushSubscription = await registration.pushManager.getSubscription();

  if (!pushSubscription) {
    pushSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const subscriptionJson = pushSubscription.toJSON();

  if (!subscriptionJson?.endpoint || !subscriptionJson?.keys) {
    throw new Error("اشتراك الإشعارات غير مكتمل");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("يجب تسجيل الدخول قبل تفعيل الإشعارات");

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        project_id: projectId,
        user_id: user.id,
        endpoint: subscriptionJson.endpoint,

        // يحفظ endpoint وkeys.auth وkeys.p256dh داخل عمود JSONB نفسه.
        subscription: subscriptionJson,

        user_agent: navigator.userAgent,
        platform: isIosDevice() ? "ios" : "web",
        is_active: true,
        last_used_at: now,
        updated_at: now,
      },
      { onConflict: "endpoint" }
    );

  if (error) throw error;

  return pushSubscription;
}

export async function disablePushNotifications() {
  if (!("serviceWorker" in navigator)) return false;

  const registration = await navigator.serviceWorker.ready;
  const pushSubscription =
    await registration.pushManager.getSubscription();

  if (!pushSubscription) return false;

  const endpoint = pushSubscription.endpoint;
  const unsubscribed = await pushSubscription.unsubscribe();

  const { error } = await supabase
    .from("push_subscriptions")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq("endpoint", endpoint);

  if (error) throw error;

  return unsubscribed;
}

export async function getPushRegistrationState(projectId) {
  const status = getPushSupportStatus();

  if (!status.supported) {
    return { ...status, enabled: false };
  }

  if (!projectId) {
    return {
      ...status,
      supported: false,
      enabled: false,
      reason: "missing-project-id",
    };
  }

  const registration = await registerPushServiceWorker();
  const pushSubscription =
    await registration.pushManager.getSubscription();

  if (!pushSubscription) {
    return { ...status, enabled: false };
  }

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id,is_active")
    .eq("project_id", projectId)
    .eq("endpoint", pushSubscription.endpoint)
    .maybeSingle();

  if (error) {
    console.warn("تعذر قراءة حالة اشتراك الإشعارات:", error.message);
    return { ...status, enabled: false };
  }

  return { ...status, enabled: data?.is_active === true };
}

function urlBase64ToUint8Array(base64String) {
  const cleanKey = String(base64String || "").trim();

  if (!cleanKey) {
    throw new Error("مفتاح VAPID العام فارغ");
  }

  const padding = "=".repeat((4 - (cleanKey.length % 4)) % 4);
  const base64 = (cleanKey + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((character) => character.charCodeAt(0))
  );
}
