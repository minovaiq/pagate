import { USER_ROLES } from "../constants/constants";

export function isAdmin(profile) {
  return profile?.role === USER_ROLES.ADMIN;
}

export function isOwner(profile) {
  return profile?.role === USER_ROLES.OWNER;
}

export function isStaff(profile) {
  return profile?.role === USER_ROLES.STAFF;
}

export function canViewProject(permissions, profile) {
  if (isAdmin(profile)) return true;

  return permissions?.can_view === true;
}

export function canAddData(permissions, profile) {
  if (isAdmin(profile)) return true;

  return permissions?.can_add === true;
}

export function canEditData(permissions, profile) {
  if (isAdmin(profile)) return true;

  return permissions?.can_edit === true;
}

export function canDeleteData(permissions, profile) {
  if (isAdmin(profile)) return true;

  return permissions?.can_delete === true;
}

export function canViewReports(permissions, profile) {
  if (isAdmin(profile)) return true;

  return permissions?.can_reports === true;
}

export function hasFullPermissions(permissions, profile) {
  if (isAdmin(profile)) return true;

  return (
    permissions?.can_view &&
    permissions?.can_add &&
    permissions?.can_edit &&
    permissions?.can_delete &&
    permissions?.can_reports
  );
}

export function getPermissionBadgeColor(permission) {
  return permission
    ? "bg-green-600 text-white"
    : "bg-slate-700 text-slate-400";
}

export function getRoleLabel(role) {
  switch (role) {
    case USER_ROLES.ADMIN:
      return "أدمن";

    case USER_ROLES.OWNER:
      return "مالك";

    case USER_ROLES.STAFF:
      return "موظف";

    default:
      return "مستخدم";
  }
}

export function getRoleColor(role) {
  switch (role) {
    case USER_ROLES.ADMIN:
      return "bg-red-600";

    case USER_ROLES.OWNER:
      return "bg-blue-600";

    case USER_ROLES.STAFF:
      return "bg-emerald-600";

    default:
      return "bg-slate-700";
  }
}

export function checkPermission(
  permissions,
  permissionKey,
  profile = null
) {
  if (isAdmin(profile)) return true;

  return permissions?.[permissionKey] === true;
}

export function requirePermission(
  permissions,
  permissionKey,
  profile = null
) {
  const allowed = checkPermission(
    permissions,
    permissionKey,
    profile
  );

  if (!allowed) {
    throw new Error("ليس لديك صلاحية");
  }

  return true;
}