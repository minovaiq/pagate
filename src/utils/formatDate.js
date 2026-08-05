export default function formatDate(
  date,
  locale = "ar-IQ"
) {
  if (!date) return "-";

  return new Date(date).toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDateTime(
  date,
  locale = "ar-IQ"
) {
  if (!date) return "-";

  return new Date(date).toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(
  date,
  locale = "ar-IQ"
) {
  if (!date) return "-";

  return new Date(date).toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function getFirstDayOfMonth() {
  return new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  )
    .toISOString()
    .slice(0, 10);
}

export function getLastDayOfMonth() {
  return new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0
  )
    .toISOString()
    .slice(0, 10);
}

export function isToday(date) {
  if (!date) return false;

  const today = new Date().toISOString().slice(0, 10);

  return new Date(date).toISOString().slice(0, 10) === today;
}

export function isThisMonth(date) {
  if (!date) return false;

  const now = new Date();

  const target = new Date(date);

  return (
    now.getMonth() === target.getMonth() &&
    now.getFullYear() === target.getFullYear()
  );
}

export function daysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const diff = end - start;

  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function formatRelativeDate(date) {
  if (!date) return "-";

  const now = new Date();
  const target = new Date(date);

  const diffInSeconds = Math.floor(
    (now - target) / 1000
  );

  if (diffInSeconds < 60) {
    return "الآن";
  }

  if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)} دقيقة`;
  }

  if (diffInSeconds < 86400) {
    return `${Math.floor(diffInSeconds / 3600)} ساعة`;
  }

  if (diffInSeconds < 2592000) {
    return `${Math.floor(diffInSeconds / 86400)} يوم`;
  }

  return formatDate(date);
}