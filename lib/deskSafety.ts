// Score desk safety on the device: typed scores survive a reload, a dropped connection or being signed out until
// the server has them, and requests retry through short network blips. Browser only.

export type Games = [string, string][];
export type SetScore = { player1Score: number; player2Score: number };
// What the desk saw when typing started, so the server can tell if another desk saved in between
export type Base = { status: string; sets: SetScore[] };
export type Draft = { games: Games; base: Base; at: string };

const key = (matchId: string) => `rallyops:draft:${matchId}`;

export function loadDraft(matchId: string): Draft | null {
  try {
    const raw = localStorage.getItem(key(matchId));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
export function saveDraft(matchId: string, d: Draft) {
  try { localStorage.setItem(key(matchId), JSON.stringify(d)); } catch { /* private window or full storage: the screen still has it */ }
}
export function clearDraft(matchId: string) {
  try { localStorage.removeItem(key(matchId)); } catch { /* nothing to clear */ }
}

// fetch that tries again (up to 3 times, 1s then 2s apart) when the network drops, a try hangs for 15s (a stalled
// hotspot) or the server is briefly down. Only for requests that are safe to repeat: the server accepts the same
// score sent twice as one save.
export async function fetchRetry(url: string, init: RequestInit, tries = 3): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
      if (![502, 503, 504].includes(res.status) || i === tries - 1) return res;
    } catch (err) {
      last = err;
      if (i === tries - 1) throw err;
    }
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }
  throw last;
}

// Automatic backups kept on this device (the last 3), in case the server can't be reached at all
const BACKUPS = 'rallyops:backups';
export function keepBackup(json: string) {
  try {
    const list: { at: string; json: string }[] = JSON.parse(localStorage.getItem(BACKUPS) ?? '[]');
    list.unshift({ at: new Date().toISOString(), json });
    localStorage.setItem(BACKUPS, JSON.stringify(list.slice(0, 3)));
  } catch {
    // too big or storage blocked: keep only the newest
    try { localStorage.setItem(BACKUPS, JSON.stringify([{ at: new Date().toISOString(), json }])); } catch { /* give up quietly */ }
  }
}
export function deviceBackups(): { at: string; json: string }[] {
  try { return JSON.parse(localStorage.getItem(BACKUPS) ?? '[]'); } catch { return []; }
}
