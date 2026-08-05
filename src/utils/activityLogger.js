import { supabase } from "../services/supabase/client";

export async function logActivity({
  projectId,
  actionType,
  tableName,
  recordId = null,
  title,
  details = null,
}) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase.from("activity_logs").insert([
      {
        project_id: projectId,
        user_id: user.id,
        action_type: actionType,
        table_name: tableName,
        record_id: recordId,
        title,
        details,
      },
    ]);
  } catch (err) {
    console.log("Activity Log Error:", err);
  }
}