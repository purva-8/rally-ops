// Tiny in-memory stand-in for the Supabase query builder: enough for the match routes.
// It applies no row-level security; routes using the session client are tested for their own checks.
type Row = Record<string, any>;
export const db: Record<string, Row[]> = {};
export const session: { user: { id: string } | null } = { user: null };
let seq = 0;

class Query {
  private filters: ((r: Row) => boolean)[] = [];
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: any;
  private mode: 'one' | 'maybe' | null = null;
  private max = Infinity;
  private skip = 0;
  private table: string;
  constructor(table: string) { this.table = table; db[table] ??= []; }
  select() { return this; }
  insert(rows: Row | Row[]) { this.op = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
  update(v: Row) { this.op = 'update'; this.payload = v; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c: string, v: any) { this.filters.push((r) => r[c] === v); return this; }
  in(c: string, vs: any[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
  is(c: string, v: any) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
  order() { return this; }
  limit(n: number) { this.max = n; return this; }
  range(from: number, to: number) { this.skip = from; this.max = to - from + 1; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }
  single() { this.mode = 'one'; return this; }
  then(res: any, rej: any) { return Promise.resolve(this.run()).then(res, rej); }
  private run() {
    const t = db[this.table];
    const match = (r: Row) => this.filters.every((f) => f(r));
    let out: Row[];
    if (this.op === 'insert') {
      for (const r of this.payload) {
        if (this.table === 'matches' && r.position != null && t.some((x) => x.tournament_id === r.tournament_id && x.category === r.category && x.round === r.round && x.position === r.position))
          return { data: null, error: { code: '23505', message: 'duplicate key' } };
      }
      out = this.payload.map((r: Row) => ({ id: `${this.table}-${++seq}`, created_at: new Date(seq).toISOString(), ...r }));
      t.push(...out);
    } else if (this.op === 'update') {
      out = t.filter(match); out.forEach((r) => Object.assign(r, this.payload));
    } else if (this.op === 'delete') {
      out = t.filter(match); db[this.table] = t.filter((r) => !match(r));
    } else out = t.filter(match).slice(this.skip, this.skip + this.max);
    out = out.map((r) => ({ ...r }));
    if (this.mode) {
      if (out.length > 1 || (this.mode === 'one' && out.length === 0)) return { data: null, error: { message: 'not single' } };
      return { data: out[0] ?? null, error: null };
    }
    return { data: out, error: null };
  }
}

export const authUsers: Record<string, string> = {};
const client = {
  from: (t: string) => new Query(t),
  auth: {
    getUser: async () => ({ data: { user: session.user } }),
    admin: { getUserById: async (id: string) => ({ data: { user: authUsers[id] ? { id, email: authUsers[id] } : null } }) },
  },
};
export async function createClient() { return client; }
export function createAdminClient() { return client; }
