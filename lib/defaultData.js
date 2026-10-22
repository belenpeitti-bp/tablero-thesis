// Estructura de datos de la tesis y valores iniciales.
// Todo el contenido editable vive en un único JSON (tesis/datos.json en Vercel Blob).

export const CHAPTER_DEFS = [
  { id: 'introduccion', kind: 'intro', label: 'Introducción', short: 'Int.' },
  { id: 'capitulo-1', kind: 'chapter', label: 'Capítulo 1', short: '1' },
  { id: 'capitulo-2', kind: 'chapter', label: 'Capítulo 2', short: '2' },
  { id: 'capitulo-3', kind: 'chapter', label: 'Capítulo 3', short: '3' },
  { id: 'capitulo-4', kind: 'chapter', label: 'Capítulo 4', short: '4' },
  { id: 'capitulo-5', kind: 'chapter', label: 'Capítulo 5', short: '5' },
  { id: 'capitulo-6', kind: 'chapter', label: 'Capítulo 6', short: '6' },
  { id: 'capitulo-7', kind: 'chapter', label: 'Capítulo 7', short: '7' },
  { id: 'conclusion', kind: 'conclusion', label: 'Conclusión', short: 'Concl.' },
];

export const CHAPTER_IDS = CHAPTER_DEFS.map((c) => c.id);

export function isChapterId(id) {
  return typeof id === 'string' && /^[a-z0-9-]{1,40}$/.test(id);
}

export function emptyChapter(def) {
  return {
    id: def.id,
    kind: def.kind,
    label: def.label,
    short: def.short,
    title: '',
    questions: [],
    hypotheses: [],
    debates: [],
    bibliography: [],
    sources: [],
    file: null,
    text: null,
    actors: null,
  };
}

export function createDefaultData() {
  return {
    schema: 1,
    thesis: { title: '', subtitle: '', author: '', institution: '' },
    chapters: CHAPTER_DEFS.map(emptyChapter),
    actorRules: { aliases: {}, hidden: [], noMerge: [], manual: [] },
    meta: { updatedAt: null, ops: null, lastBackupAt: null },
  };
}

const arr = (v) => (Array.isArray(v) ? v : []);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const str = (v) => (typeof v === 'string' ? v : '');

// Completa campos faltantes para que datos viejos o importados no rompan la página.
export function normalizeData(input) {
  const base = createDefaultData();
  if (!input || typeof input !== 'object') return base;
  const d = { ...base, ...input };
  d.thesis = { ...base.thesis, ...obj(input.thesis) };
  const given = arr(input.chapters);
  const byId = new Map(given.map((c) => [c && c.id, c]));
  const known = CHAPTER_DEFS.map((def) => {
    const c = byId.get(def.id) || {};
    return normalizeChapter({ ...emptyChapter(def), ...c, id: def.id, kind: def.kind, label: c.label || def.label, short: c.short || def.short });
  });
  const extra = given
    .filter((c) => c && isChapterId(c.id) && !CHAPTER_IDS.includes(c.id))
    .map((c) => normalizeChapter({ ...emptyChapter({ id: c.id, kind: 'chapter', label: c.label || c.id, short: c.short || '' }), ...c }));
  d.chapters = [...known.slice(0, -1), ...extra, known[known.length - 1]];
  const rules = obj(input.actorRules);
  d.actorRules = {
    aliases: obj(rules.aliases),
    hidden: arr(rules.hidden).filter((x) => typeof x === 'string'),
    noMerge: arr(rules.noMerge).filter((x) => typeof x === 'string'),
    manual: arr(rules.manual).filter((m) => m && typeof m.name === 'string'),
  };
  d.meta = { ...base.meta, ...obj(input.meta) };
  return d;
}

function normalizeChapter(c) {
  const items = (list) => arr(list).filter((x) => x && typeof x === 'object').map((x) => ({ ...x, id: str(x.id) || newId(), text: str(x.text) }));
  return {
    ...c,
    title: str(c.title),
    questions: items(c.questions),
    hypotheses: items(c.hypotheses),
    debates: items(c.debates).map((x) => ({ ...x, title: str(x.title) })),
    bibliography: items(c.bibliography),
    sources: items(c.sources).map((x) => ({ ...x, group: str(x.group) })),
  };
}

export function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().slice(0, 13);
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-3);
}
