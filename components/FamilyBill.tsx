import { categoryFee, categoryLabel, isDoublesCategory } from '@/lib/categories';
import Avatar from '@/components/Avatar';

export type BillPerson = { id: string; name: string; gender: string | null };
export type BillRegistration = {
  id: string;
  category: string;
  status: string;
  payment_status: string | null;
  player_id: string | null;
  partner_id: string | null;
  partner_name: string | null;
  tournaments: { name: string; entry_fee: number } | null;
  player_profiles: { full_name: string } | null;
};

type Line = { key: string; personId: string; label: string; note: string; amount: number; paid: boolean };

// Turns registrations into per-person charges. A doubles fee is per pair (for example 30 + 30):
// with a linked partner each person carries their own half.
export function buildLines(people: BillPerson[], regs: BillRegistration[]): Line[] {
  const mine = new Set(people.map((p) => p.id));
  const lines: Line[] = [];
  for (const r of regs) {
    // Only approved entries are billed; pending, rejected and withdrawn ones cost nothing yet
    if (r.status !== 'approved') continue;
    const fee = categoryFee(r.category, Number(r.tournaments?.entry_fee ?? 0));
    if (fee <= 0 || r.payment_status === 'waived') continue;
    const paid = r.payment_status === 'paid';
    const label = categoryLabel(r.category);
    if (isDoublesCategory(r.category) && (r.partner_id || r.partner_name) && r.player_id) {
      const half = fee / 2;
      if (mine.has(r.player_id)) lines.push({ key: r.id + 'a', personId: r.player_id, label, note: `with ${r.partner_name ?? 'partner'} · half of ${fee}`, amount: half, paid });
      // A partner in this household who has no entry of their own is covered by this one
      const partnerFiled = regs.some((o) => o.id !== r.id && o.player_id === r.partner_id && o.category === r.category && o.status === 'approved');
      if (r.partner_id && mine.has(r.partner_id) && !partnerFiled) lines.push({ key: r.id + 'b', personId: r.partner_id, label, note: `with ${r.player_profiles?.full_name ?? 'partner'} · half of ${fee}`, amount: half, paid });
    } else if (r.player_id && mine.has(r.player_id)) {
      lines.push({ key: r.id, personId: r.player_id, label, note: '', amount: fee, paid });
    }
  }
  return lines;
}

export default function FamilyBill({ people, regs }: { people: BillPerson[]; regs: BillRegistration[] }) {
  const lines = buildLines(people, regs);
  if (lines.length === 0) return null;

  const due = lines.filter((l) => !l.paid).reduce((s, l) => s + l.amount, 0);
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const tournament = regs.find((r) => r.tournaments)?.tournaments?.name;

  return (
    <div className="relative">
      <div
        className="bg-white border border-stone-200 shadow-sm px-5 pt-5 pb-7"
        style={{
          borderRadius: '16px 16px 0 0',
          // zig-zag receipt edge
          WebkitMask: 'conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50%/14px 100%',
          mask: 'conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 50%/14px 100%',
        }}
      >
        <div className="text-center mb-4">
          <p className="text-2xl mb-1">🧾</p>
          <h2 className="text-sm font-extrabold tracking-widest uppercase text-stone-800">Family bill</h2>
          {tournament && <p className="text-xs text-stone-400 mt-0.5">{tournament}</p>}
        </div>

        <div className="border-t-2 border-dashed border-stone-200 pt-4 space-y-5 font-mono">
          {people.map((person) => {
            const mine = lines.filter((l) => l.personId === person.id);
            if (mine.length === 0) return null;
            const sub = mine.reduce((s, l) => s + l.amount, 0);
            return (
              <div key={person.id}>
                <div className="flex items-center gap-2 mb-2">
                  <Avatar seed={person.id} size={22} gender={person.gender as never} />
                  <span className="text-[13px] font-bold text-stone-800 flex-1 truncate">{person.name}</span>
                  <span className="text-[13px] font-bold text-stone-800">{sub}</span>
                </div>
                <ul className="space-y-1.5 pl-1">
                  {mine.map((l) => (
                    <li key={l.key} className="flex items-start justify-between gap-3 text-xs">
                      <span className={l.paid ? 'text-stone-300 line-through' : 'text-stone-600'}>
                        {l.label}
                        {l.note && <span className="block text-[10px] text-stone-400 no-underline">{l.note}</span>}
                      </span>
                      <span className={`shrink-0 ${l.paid ? 'text-emerald-500' : 'text-stone-700'}`}>{l.paid ? 'paid' : l.amount}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="border-t-2 border-dashed border-stone-200 mt-5 pt-4 font-mono">
          <div className="flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-widest text-stone-400">Amount due</span>
            <span className={`text-2xl font-extrabold ${due > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
              {due > 0 ? `QAR ${due}` : 'All paid'}
            </span>
          </div>
          {due > 0 && total !== due && <p className="text-[11px] text-stone-400 text-right mt-0.5">of QAR {total} in total</p>}
          <p className="text-[11px] text-stone-400 text-center mt-4">
            Payment details come from the organizers once entries are approved.
          </p>
          <p className="text-[11px] text-stone-400 text-center mt-1 whitespace-nowrap">Thanks for playing 🏸</p>
        </div>
      </div>
    </div>
  );
}
