import { supabase } from "../supabase/client";

/**
 * Saves a Web Push subscription without exposing auth/p256dh as table columns.
 * Both keys remain inside the JSONB `subscription` column.
 */
export async function savePushSubscription({
  projectId,
  subscription,
}) {
  if (!projectId) {
    throw new Error("projectId مطلوب لتسجيل الجهاز");
  }

  if (!subscription) {
    throw new Error("تعذر إنشاء اشتراك الإشعارات");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("يجب تسجيل الدخول أولاً");

  const subscriptionJson = subscription.toJSON();

  const payload = {
    user_id: user.id,
    project_id: projectId,
    endpoint: subscriptionJson.endpoint,
    subscription: subscriptionJson,
    is_active: true,
    user_agent: navigator.userAgent,
    last_used_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("push_subscriptions")
    .upsert(payload, {
      onConflict: "endpoint",
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}
