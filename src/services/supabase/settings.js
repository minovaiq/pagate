import { supabase } from "./client";

export async function getSettingsPageData() {
  const [projectsRes, profilesRes, membersRes] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false }),

    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false }),

    supabase
      .from("project_members")
      .select("*")
      .order("created_at", { ascending: false }),
  ]);

  if (projectsRes.error) throw projectsRes.error;
  if (profilesRes.error) throw profilesRes.error;

  return {
    projects: projectsRes.data || [],
    profiles: profilesRes.data || [],
    members: membersRes.data || [],
  };
}

export async function getProjectSettings(projectId) {
  if (!projectId) return null;

  const { data, error } = await supabase
    .from("project_settings")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function saveProjectSettings(projectId, payload) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("project_settings")
    .upsert(
      {
        project_id: projectId,
        ...payload,
        updated_by: user?.id || null,
      },
      {
        onConflict: "project_id",
      }
    )
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function getPromotionSettings(projectId) {
  if (!projectId) return null;

  const { data, error } = await supabase
    .from("promotion_settings")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function savePromotionSettings(projectId, payload) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("promotion_settings")
    .upsert(
      {
        project_id: projectId,
        ...payload,
        updated_by: user?.id || null,
      },
      {
        onConflict: "project_id",
      }
    )
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function getProjectWallets(projectId) {
  if (!projectId) return [];

  const { data, error } = await supabase
    .from("project_wallets")
    .select("*")
    .eq("project_id", projectId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data || [];
}

export async function saveWallet(payload) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const walletData = {
    ...payload,
    created_by: payload.created_by || user?.id || null,
  };

  const { data, error } = await supabase
    .from("project_wallets")
    .upsert(walletData)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function deleteWallet(walletId) {
  const { error } = await supabase
    .from("project_wallets")
    .delete()
    .eq("id", walletId);

  if (error) throw error;
}

export async function getMemberPermissions(projectId, userId) {
  if (!projectId || !userId) return null;

  const { data, error } = await supabase
    .from("project_members")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function saveMemberPermissions(
  projectId,
  userId,
  permissions
) {
  const row = {
    project_id: projectId,
    user_id: userId,

    can_view: permissions.can_view ?? true,
    can_add: permissions.can_add ?? false,
    can_edit: permissions.can_edit ?? false,
    can_delete: permissions.can_delete ?? false,

    can_export: permissions.can_export ?? false,
    can_manage_debts: permissions.can_manage_debts ?? false,
    can_manage_payments: permissions.can_manage_payments ?? false,
    can_settings: permissions.can_settings ?? false,

    is_active: permissions.is_active ?? true,
  };

  const { data, error } = await supabase
    .from("project_members")
    .upsert(row, {
      onConflict: "project_id,user_id",
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function createWallet(projectId, wallet) {
  const payload = {
    project_id: projectId,
    name: wallet.name,
    wallet_type: wallet.wallet_type || "cash",
    currency: wallet.currency || "IQD",
    opening_balance: Number(wallet.opening_balance || 0),
    current_balance: Number(wallet.current_balance || 0),
    allow_withdraw: wallet.allow_withdraw ?? true,
    is_default: wallet.is_default ?? false,
    is_active: true,
    notes: wallet.notes || "",
  };

  return saveWallet(payload);
}

export async function updateWallet(walletId, updates) {
  const { data, error } = await supabase
    .from("project_wallets")
    .update(updates)
    .eq("id", walletId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function toggleWallet(walletId, isActive) {
  const { data, error } = await supabase
    .from("project_wallets")
    .update({
      is_active: isActive,
    })
    .eq("id", walletId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function getUserPreferences(userId) {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function saveUserPreferences(userId, payload) {
  const { data, error } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: userId,
        ...payload,
      },
      {
        onConflict: "user_id",
      }
    )
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function addSettingsLog(payload) {
  const { data, error } = await supabase
    .from("settings_audit_logs")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;

  return data;
}