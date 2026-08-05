export const PROJECT_TYPES = {
  MARKETING_COMPANY: "marketing_company",
  MOBILE_OFFICE: "mobile_office",
  PRODUCT_STORE: "product_store",
  MY_PAGES: "my_pages",
};

export const PROJECT_TYPE_OPTIONS = [
  {
    value: PROJECT_TYPES.MARKETING_COMPANY,
    label: "شركة ترويج",
    color: "bg-blue-600",
    icon: "📢",
  },

  {
    value: PROJECT_TYPES.MOBILE_OFFICE,
    label: "مكتب الحويجة",
    color: "bg-emerald-600",
    icon: "📱",
  },

  {
    value: PROJECT_TYPES.PRODUCT_STORE,
    label: "مخزن منتجات",
    color: "bg-orange-600",
    icon: "📦",
  },

  {
    value: PROJECT_TYPES.MY_PAGES,
    label: "بيجاتي",
    color: "bg-purple-600",
    icon: "🌐",
  },
];

export const PROJECT_TYPE_LABELS = {
  marketing_company: "شركة ترويج",
  mobile_office: "مكتب الحويجة",
  product_store: "مخزن منتجات",
  my_pages: "بيجاتي",
};

export const PROJECT_TYPE_COLORS = {
  marketing_company: "bg-blue-600",
  mobile_office: "bg-emerald-600",
  product_store: "bg-orange-600",
  my_pages: "bg-purple-600",
};

export const PROJECT_TYPE_ICONS = {
  marketing_company: "📢",
  mobile_office: "📱",
  product_store: "📦",
  my_pages: "🌐",
};

export function getProjectTypeLabel(type) {
  return PROJECT_TYPE_LABELS[type] || type || "-";
}

export function getProjectTypeColor(type) {
  return PROJECT_TYPE_COLORS[type] || "bg-slate-700";
}

export function getProjectTypeIcon(type) {
  return PROJECT_TYPE_ICONS[type] || "📁";
}

export function getProjectTypeData(type) {
  return {
    label: getProjectTypeLabel(type),
    color: getProjectTypeColor(type),
    icon: getProjectTypeIcon(type),
  };
}