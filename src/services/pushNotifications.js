import { supabase } from "./supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

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

  if (!VAPID_PUBLIC_KEY) {
    return { supported: false, reason: "missing-vapid-key" };
  }

  return { supported: true, reason: null };
}

export async function registerPushServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;

  const registration = await navigator.serviceWorker.register(
    "/push-handler.js",
    { scope: "/" }
  );

  await navigator.serviceWorker.ready;
  return registration;
}

export async function enablePushNotifications(projectId) {
  if (!projectId) throw new Error("معرّف المشروع غير موجود");

  const status = getPushSupportStatus();
  if (!status.supported) {
    if (status.reason === "ios-install-required") {
      throw new Error(
        "على iPhone افتح الموقع من Safari، ثم مشاركة ← إضافة إلى الشاشة الرئيسية، وبعدها افتحه من الأيقونة."
      );
    }
    if (status.reason === "missing-vapid-key") {
      throw new Error("مفتاح VAPID العام غير مضاف إلى VITE_VAPID_PUBLIC_KEY");
    }
    throw new Error("هذا الجهاز أو المتصفح لا يدعم Web Push");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("لم يتم منح إذن الإشعارات");
  }

  const registration = await registerPushServiceWorker();
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const subscriptionJson = subscription.toJSON();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("يجب تسجيل الدخول قبل تفعيل الإشعارات");
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      project_id: projectId,
      user_id: user.id,
      endpoint: subscriptionJson.endpoint,

      user_agent: navigator.userAgent,
      platform: isIosDevice() ? "ios" : "web",
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) throw error;

  return subscription;
}

export async function disablePushNotifications() {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscriptionJson.endpoint;
  await subscription.unsubscribe();

  await supabase
    .from("push_subscriptions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("endpoint", endpoint);
}

export async function getPushRegistrationState(projectId) {
  const status = getPushSupportStatus();
  if (!status.supported) return { ...status, enabled: false };

  const registration = await registerPushServiceWorker();
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) return { ...status, enabled: false };

  const { data } = await supabase
    .from("push_subscriptions")
    .select("id,is_active")
    .eq("project_id", projectId)
    .eq("endpoint", subscriptionJson.endpoint)
    .maybeSingle();

  return { ...status, enabled: data?.is_active === true };
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
