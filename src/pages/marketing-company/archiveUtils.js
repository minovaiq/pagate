import { supabase } from "../../services/supabase/client";

export async function getLatestArchive(projectId) {
  if (!projectId) return null;

  const { data, error } = await supabase
    .from("promotion_monthly_archives")
    .select("id,archive_name,period_start,period_end,created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    // إذا الجدول غير موجود بعد، لا نوقف النظام القديم.
    console.warn("Archive lookup failed:", error.message);
    return null;
  }

  return data || null;
}

export function isAfterArchive(itemDate, archiveCreatedAt) {
  if (!archiveCreatedAt) return true;
  if (!itemDate) return true;

  return new Date(itemDate).getTime() > new Date(archiveCreatedAt).getTime();
}
