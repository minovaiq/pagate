export const PROJECT_TYPES = {
  MARKETING_COMPANY: "marketing_company",
  MOBILE_OFFICE: "mobile_office",
  PRODUCT_STORE: "product_store",
  MY_PAGES: "my_pages",
};

export const PROJECT_TYPE_LABELS = {
  marketing_company: "شركة ترويج",
  mobile_office: "مكتب الحويجة",
  product_store: "مخزن منتجات",
  my_pages: "بيجاتي",
};

export const SERVICE_TYPES = {
  PROMOTION: "promotion",
  PROGRAMMING: "programming",
  DESIGN: "design",
  VIDEO_EDITING: "video_editing",
  CONSULTING: "consulting",
  OTHER: "other",
};

export const SERVICE_TYPE_LABELS = {
  promotion: "ترويج",
  programming: "برمجة",
  design: "تصميم",
  video_editing: "مونتاج",
  consulting: "استشارة",
  other: "أخرى",
};

export const EXPENSE_TYPES = {
  RENT: "rent",
  SALARY: "salary",
  ELECTRICITY: "electricity",
  PROMOTION: "promotion",
  OTHER: "other",
};

export const EXPENSE_TYPE_LABELS = {
  rent: "إيجار",
  salary: "راتب",
  electricity: "كهرباء",
  promotion: "ترويج",
  other: "أخرى",
};

export const TRANSACTION_TYPES = {
  INCOME: "income",
  EXPENSE: "expense",
};

export const ACTION_TYPES = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  LOGIN: "login",
  LOGOUT: "logout",
  PERMISSION_CHANGE: "permission_change",
};

export const ACTION_TYPE_LABELS = {
  create: "إضافة",
  update: "تعديل",
  delete: "حذف",
  login: "دخول",
  logout: "خروج",
  permission_change: "صلاحيات",
};

export const USER_ROLES = {
  ADMIN: "admin",
  OWNER: "owner",
  STAFF: "staff",
};

export const DEFAULT_PERMISSIONS = {
  can_view: true,
  can_add: true,
  can_edit: false,
  can_delete: false,
  can_reports: true,
};

export const PROMOTION_RATE = {
  TOTAL: 165000,
  AD_SPEND: 140000,
  PROFIT: 25000,
};

export const PROMOTION_PERCENTAGES = {
  AD_SPEND: 140000 / 165000,
  PROFIT: 25000 / 165000,
};

export const CURRENCY = {
  IQD: "IQD",
  USD: "USD",
};

export function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

export function formatMoney(value, currency = "IQD") {
  return `${formatNumber(value)} ${currency}`;
}