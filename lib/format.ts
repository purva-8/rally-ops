// All user-facing dates are day/month/year.

function toDate(d: string | Date) {
  // Plain YYYY-MM-DD values are calendar dates, so read them as local to avoid a day shift
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-').map(Number);
    return new Date(y, m - 1, day);
  }
  return new Date(d);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return '';
  const x = toDate(d);
  if (isNaN(x.getTime())) return '';
  return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`;
}

export function formatDateTime(d: string | Date | null | undefined) {
  if (!d) return '';
  const x = toDate(d);
  if (isNaN(x.getTime())) return '';
  return `${formatDate(x)} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
