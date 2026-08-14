import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject =
      Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error("VAPID secrets are not configured");
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { notification_id } = await request.json();
    if (!notification_id) throw new Error("notification_id is required");

    const { data: notification, error: notificationError } = await admin
      .from("marketing_notifications")
      .select("*")
      .eq("id", notification_id)
      .single();
    if (notificationError || !notification) throw new Error("Notification not found");

    const { data: project, error: projectError } = await admin
      .from("projects")
      .select("id,owner_user_id,created_by")
      .eq("id", notification.project_id)
      .single();
    if (projectError || !project) throw new Error("Project not found");

    let allowed =
      project.owner_user_id === user.id || project.created_by === user.id;

    if (!allowed) {
      const { data: membership } = await admin
        .from("project_members")
        .select("user_id")
        .eq("project_id", project.id)
        .eq("user_id", user.id)
        .maybeSingle();
      allowed = Boolean(membership);
    }

    if (!allowed) throw new Error("Forbidden");

    const { data: subscriptions, error: subscriptionsError } = await admin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("project_id", notification.project_id)
      .eq("is_active", true);
    if (subscriptionsError) throw subscriptionsError;

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const projectUrl = `/projects/${notification.project_id}`;
    const payload = JSON.stringify({
      title: notification.title || "Finance OS",
      body: notification.message || "وصل تنبيه جديد",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: notification.dedupe_key || notification.id,
      notification_id: notification.id,
      url: projectUrl,
      data: {
        project_id: notification.project_id,
        action_tab: notification.action_tab,
        type: notification.type,
      },
    });

    let sent = 0;
    let removed = 0;

    await Promise.all(
      (subscriptions || []).map(async (row) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: row.endpoint,
              keys: { p256dh: row.p256dh, auth: row.auth },
            },
            payload,
            { TTL: 60 * 60 }
          );
          sent += 1;
        } catch (error) {
          const statusCode = Number(error?.statusCode || 0);
          console.error("Push send failed", row.id, statusCode, error?.message);

          if (statusCode === 404 || statusCode === 410) {
            await admin
              .from("push_subscriptions")
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq("id", row.id);
            removed += 1;
          }
        }
      })
    );

    return new Response(JSON.stringify({ ok: true, sent, removed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ ok: false, error: error?.message || "Unknown error" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
