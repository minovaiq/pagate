import { useEffect, useState } from "react";
import { supabase } from "../services/supabase/client";

export default function useProjectPermissions(projectId) {
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;

    loadPermissions();
  }, [projectId]);

  async function loadPermissions() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("project_members")
        .select("*")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .single();

      if (error) {
        setPermissions(null);
        return;
      }

      setPermissions(data);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  return {
    permissions,
    loading,
  };
}