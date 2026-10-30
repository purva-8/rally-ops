// Entries the organizers never want drawn against each other. The list lives in a server setting (KEEP_APART), not
// in the code, and never reaches the browser. Format: category:name>name,name;category:name>name
// e.g. "doubles_cat:ann lee>bo chan,cy dee" keeps Ann Lee's entry away from Bo Chan's and Cy Dee's.
const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

function rules() {
  return (process.env.KEEP_APART ?? '').split(';').map((r) => {
    const [category, rest = ''] = r.split(':');
    const [a = '', b = ''] = rest.split('>');
    return { category: category.trim(), a: norm(a), b: b.split(',').map(norm).filter(Boolean) };
  }).filter((r) => r.category && r.a && r.b.length);
}

// An entry is matched by any of its names ("Ann Lee / Ben Lee" is Ann Lee's pair)
const has = (label: string, who: string) => norm(label).split(/\s*[&/]\s*/).some((n) => n === who);

export function keptApart(category: string, x: string, y: string) {
  return rules().some((r) => r.category === category &&
    ((has(x, r.a) && r.b.some((w) => has(y, w))) || (has(y, r.a) && r.b.some((w) => has(x, w)))));
}
