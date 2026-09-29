// CSV that opens cleanly in Excel: UTF-8 BOM (so Arabic names survive) and proper quoting.
export function toCsv(rows: Record<string, unknown>[], columns?: string[]) {
  const cols = columns ?? (rows.length ? Object.keys(rows[0]) : []);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    // Stop Excel treating a cell as a formula
    const safe = /^[=+\-@]/.test(s) && isNaN(Number(s)) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n');
}
