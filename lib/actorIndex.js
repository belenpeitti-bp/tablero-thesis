// Índice cruzado de actores: une las detecciones de cada capítulo y aplica las reglas
// que la autora define (unificar nombres, ocultar, agregar manualmente).
import { normKey } from './actors';

class UnionFind {
  constructor() {
    this.p = new Map();
  }
  find(x) {
    if (!this.p.has(x)) this.p.set(x, x);
    let r = x;
    while (this.p.get(r) !== r) r = this.p.get(r);
    let c = x;
    while (this.p.get(c) !== r) {
      const n = this.p.get(c);
      this.p.set(c, r);
      c = n;
    }
    return r;
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.p.set(rb, ra);
  }
}

/**
 * @returns {Array<{key, name, type, counts: Record<string, number>, total, chapters: string[], variants: string[], roles: Record<string,string>, hidden: boolean, manual: boolean}>}
 */
export function buildActorIndex(chapters, rules = {}) {
  const aliases = rules.aliases || {}; // normKey(variante) -> nombre canónico
  const hiddenSet = new Set((rules.hidden || []).map(normKey));
  const noMerge = new Set((rules.noMerge || []).map(normKey));
  const order = chapters.map((c) => c.id);

  const uf = new UnionFind();
  const raw = [];
  const display = new Map(); // key -> Map(form -> peso)
  const addForm = (key, form, w) => {
    const m = display.get(key) || new Map();
    m.set(form, (m.get(form) || 0) + w);
    display.set(key, m);
  };

  for (const ch of chapters) {
    const items = ch.actors?.items || [];
    for (const it of items) {
      const key = normKey(it.name);
      if (!key) continue;
      uf.find(key);
      addForm(key, it.name, it.count || 1);
      const variants = (it.variants || []).map((v) => [normKey(v), v]).filter(([k]) => k);
      for (const [vk, v] of variants) {
        if (noMerge.has(vk)) continue;
        uf.union(key, vk);
        addForm(vk, v, 0.1);
      }
      raw.push({ ch: ch.id, key, count: it.count || 0, type: it.type || '', role: it.role || '' });
    }
  }

  for (const m of rules.manual || []) {
    const key = normKey(m.name);
    if (!key) continue;
    uf.find(key);
    addForm(key, m.name, 1e6);
    for (const v of m.variants || []) {
      const vk = normKey(v);
      if (vk) uf.union(key, vk);
    }
  }

  const preferred = new Map(); // root -> nombre canónico elegido por la autora
  for (const [variantKey, canonical] of Object.entries(aliases)) {
    const ck = normKey(canonical);
    if (!ck || !variantKey) continue;
    uf.find(ck);
    uf.union(ck, variantKey);
    addForm(ck, canonical, 1e9);
  }

  // Apellido suelto ("Urquiza") -> único nombre completo de toda la tesis que termine así.
  const keys = [...display.keys()];
  const multi = keys.filter((k) => k.includes(' '));
  const byLast = new Map();
  for (const k of multi) {
    const last = k.split(' ').pop();
    const set = byLast.get(last) || new Set();
    set.add(k);
    byLast.set(last, set);
  }
  for (const k of keys) {
    if (k.includes(' ') || k.length < 4 || noMerge.has(k)) continue;
    const cands = byLast.get(k);
    if (!cands) continue;
    const roots = new Set([...cands].map((c) => uf.find(c)));
    if (roots.size === 1) uf.union([...roots][0], k);
  }

  const groups = new Map();
  const getGroup = (root) => {
    let g = groups.get(root);
    if (!g) {
      g = { key: root, counts: {}, types: {}, roles: {}, forms: new Map(), manual: false };
      groups.set(root, g);
    }
    return g;
  };
  for (const r of raw) {
    const g = getGroup(uf.find(r.key));
    g.counts[r.ch] = (g.counts[r.ch] || 0) + r.count;
    if (r.type) g.types[r.type] = (g.types[r.type] || 0) + 1;
    if (r.role && !g.roles[r.ch]) g.roles[r.ch] = r.role;
  }
  for (const m of rules.manual || []) {
    const key = normKey(m.name);
    if (!key) continue;
    const g = getGroup(uf.find(key));
    g.manual = true;
    for (const [ch, n] of Object.entries(m.counts || {})) g.counts[ch] = Math.max(g.counts[ch] || 0, n);
  }
  for (const [key, forms] of display) {
    const g = groups.get(uf.find(key));
    if (!g) continue;
    for (const [f, w] of forms) g.forms.set(f, (g.forms.get(f) || 0) + w);
  }
  for (const [variantKey, canonical] of Object.entries(aliases)) {
    preferred.set(uf.find(normKey(canonical) || variantKey), canonical);
  }

  const out = [];
  for (const [root, g] of groups) {
    const chaptersIn = order.filter((id) => (g.counts[id] || 0) > 0);
    if (!chaptersIn.length && !g.manual) continue;
    const forms = [...g.forms.entries()].sort((a, b) => {
      const multiA = a[0].includes(' ') ? 1 : 0;
      const multiB = b[0].includes(' ') ? 1 : 0;
      return b[1] - a[1] || multiB - multiA || b[0].length - a[0].length;
    });
    let name = preferred.get(root) || forms[0]?.[0] || root;
    if (!preferred.get(root)) {
      const multiForm = forms.find(([f]) => f.includes(' '));
      if (multiForm && !name.includes(' ') && multiForm[1] >= forms[0][1] * 0.3) name = multiForm[0];
    }
    const variants = [...new Set(forms.map(([f]) => f))].filter((f) => f !== name);
    const allKeys = [root, ...variants.map(normKey), normKey(name)];
    const type = Object.entries(g.types).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    const total = chaptersIn.reduce((s, id) => s + g.counts[id], 0);
    out.push({
      key: normKey(name),
      name,
      type,
      counts: g.counts,
      total,
      chapters: chaptersIn,
      variants,
      roles: g.roles,
      manual: g.manual,
      hidden: allKeys.some((k) => hiddenSet.has(k)),
    });
  }
  out.sort((a, b) => b.chapters.length - a.chapters.length || b.total - a.total || a.name.localeCompare(b.name, 'es'));
  return out;
}

/** Actores principales de un capítulo, con los otros capítulos donde reaparecen. */
export function topActorsForChapter(index, chapterId, limit = 10) {
  return index
    .filter((a) => !a.hidden && (a.counts[chapterId] || 0) > 0)
    .sort((a, b) => b.counts[chapterId] - a.counts[chapterId] || b.chapters.length - a.chapters.length)
    .slice(0, limit)
    .map((a) => ({ ...a, here: a.counts[chapterId], elsewhere: a.chapters.filter((id) => id !== chapterId) }));
}
