// What is still owed on each entry of a family bill, for showing per person and per category (the /board). The cash
// paid for the family covers its entries in the order they were entered, so what is left falls on the newest ones.
// Pure so it can be tested with `node --test`.

export type OwingLine = { regId: string; partnerHalf?: boolean; amount: number; enteredAt?: string };

// Key: entry id, then "half" for a partner's half on that entry or "own" for the player's own share
export const lineKey = (regId: string, partnerHalf?: boolean) => `${regId}|${partnerHalf ? 'half' : 'own'}`;

export function owingByLine(bill: { lines: OwingLine[]; paid: number }): Map<string, number> {
  let left = bill.paid;
  const out = new Map<string, number>();
  const order = bill.lines.map((l, i) => ({ l, i }))
    .sort((a, b) => (a.l.enteredAt ?? '').localeCompare(b.l.enteredAt ?? '') || a.i - b.i);
  for (const { l } of order) {
    const covered = Math.max(0, Math.min(l.amount, left));
    left -= covered;
    out.set(lineKey(l.regId, l.partnerHalf), Math.round((l.amount - covered) * 100) / 100);
  }
  return out;
}
