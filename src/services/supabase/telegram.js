import { supabase } from "./client";

export async function getTelegramSettings() {
  const { data, error } = await supabase
    .from("telegram_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function saveTelegramSettings(payload) {
  const current = await getTelegramSettings();

  if (current?.id) {
    const { data, error } = await supabase
      .from("telegram_settings")
      .update(payload)
      .eq("id", current.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("telegram_settings")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getProjectAlertRules() {
  const { data, error } = await supabase
    .from("project_alert_rules")
    .select("*, projects(name)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function saveProjectAlertRule(payload) {
  const { data, error } = await supabase
    .from("project_alert_rules")
    .upsert(payload, { onConflict: "project_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function notifyTelegramOperation({
  projectId,
  tableName,
  action,
  title,
  description,
  amount,
}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-telegram-notification`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        projectId,
        tableName,
        action,
        title,
        description,
        amount,
      }),
    }
  );

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || "Telegram notification failed");
  }

  return data;
}