// Organizers' request (30/10): some entries are never drawn against each other. Not shown anywhere on screen; the
// dice roll quietly avoids these pairs and the server refuses them with a plain message.
const RULES: { category: string; a: string; b: string[] }[] = [
  { category: 'spouse_doubles_open', a: 'sanjay vaidya', b: ['vaidehi ubale', 'supriya suresh bhat'] },
];

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
// An entry is matched by any of its names ("Sanjay Vaidya & Harshada Vaidya" is Sanjay Vaidya's pair)
const has = (label: string, who: string) => norm(label).split(/\s*[&/]\s*/).some((n) => n === who);

export function keptApart(category: string, x: string, y: string) {
  return RULES.some((r) => r.category === category &&
    ((has(x, r.a) && r.b.some((w) => has(y, w))) || (has(y, r.a) && r.b.some((w) => has(x, w)))));
}
