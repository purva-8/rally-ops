// Cash at the desk. A bill's balance is what it still needs: positive means they owe, negative means we owe them.

// Change to hand back when someone pays more than they owe
export function changeFor(balance: number, received: number) {
  return Math.max(0, received - Math.max(0, balance));
}

// What a payment does to a bill: the bill is credited what was received minus the change given back
export function afterPayment(balance: number, received: number, change: number) {
  const credited = received - change;
  return { credited, balance: balance - credited };
}

// Bill status from what it costs and what has been paid towards it
export type PayState = 'due' | 'partial' | 'paid' | 'refund';
export function payState(due: number, paid: number): PayState {
  const balance = due - paid;
  if (balance < 0) return 'refund';
  if (balance === 0) return 'paid';
  return paid > 0 ? 'partial' : 'due';
}

// A sane cash amount: a number from 0 up to 100,000 with at most 2 decimals
export function validCash(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100000 && Math.round(v * 100) === v * 100;
}
