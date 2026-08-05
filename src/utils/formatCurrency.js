export default function formatCurrency(
  value,
  currency = "IQD",
  locale = "en-US"
) {
  const number = Number(value || 0);

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(number);
}

export function formatNumber(value, locale = "en-US") {
  return Number(value || 0).toLocaleString(locale);
}

export function formatCompactNumber(value, locale = "en-US") {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}

export function formatIQD(value) {
  return formatCurrency(value, "IQD");
}

export function formatUSD(value) {
  return formatCurrency(value, "USD");
}

export function parseNumber(value) {
  if (!value) return 0;

  return Number(
    String(value)
      .replace(/,/g, "")
      .replace(/[^\d.-]/g, "")
  );
}