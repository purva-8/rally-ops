// Asks the server whether another account already uses this Qatar ID; returns a message to show, or null if it is free
export async function qidTakenMessage(qid: string): Promise<string | null> {
  const res = await fetch('/api/account/qid-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ qid }) }).catch(() => null);
  const d = res?.ok ? await res.json().catch(() => ({})) : {};
  if (!d.taken) return null;
  return `This Qatar ID is already used by another account${d.hint ? ` (${d.hint})` : ''}. Please sign in with that account and add your family there, so everyone is on one bill. If you can't, ask the organizers.`;
}
