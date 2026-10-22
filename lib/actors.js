// Detección de actores (personas, instituciones, grupos con nombre propio) en textos en castellano.
// Funciona sin servicios externos: busca secuencias de palabras con mayúscula inicial,
// descarta las que solo están en mayúscula por iniciar oración, separa a los autores citados
// (p. ej. "Halperin Donghi (1972)") y une apellidos sueltos con el nombre completo.

const JOINERS = new Set(['de', 'del', 'la', 'las', 'los', 'da', 'das', 'do', 'dos', 'van', 'von', 'der', 'di', 'du', 'le']);

// Títulos y tratamientos que se quitan del comienzo de un nombre.
const TITLES = new Set([
  'sr', 'sra', 'srta', 'señor', 'señora', 'don', 'doña', 'dr', 'dra', 'doctor', 'doctora', 'gral', 'gen', 'general',
  'cnel', 'coronel', 'tte', 'teniente', 'cap', 'capitán', 'comandante', 'cmte', 'sgto', 'sargento', 'pbro', 'presbítero',
  'mons', 'monseñor', 'fray', 'padre', 'ing', 'lic', 'prof', 'profesor', 'profesora', 'presidente', 'presidenta', 'pte',
  'gobernador', 'gobernadora', 'ministro', 'ministra', 'diputado', 'diputada', 'senador', 'senadora', 'intendente',
  'obispo', 'arzobispo', 'cardenal', 'brigadier', 'mayor', 'almirante', 'comodoro', 'virrey', 'canónigo', 'deán',
]);

// Tratamientos abreviados ("Gral. Paz"): el punto no corta el nombre.
const TITLE_ABBR = new Set(['sr', 'sra', 'srta', 'dr', 'dra', 'gral', 'gen', 'cnel', 'tte', 'cap', 'cmte', 'sgto', 'pbro', 'mons', 'ing', 'lic', 'prof', 'pte', 'dn', 'fr', 'sto', 'sta', 'gob', 'min', 'brig', 'cor', 'alte', 'cmdro', 'presb']);

// Abreviaturas cuyo punto no cierra la oración.
const ABBREV = new Set([
  ...TITLE_ABBR, 'sto', 'sta', 'dn', 'gob', 'min', 'ob', 'op', 'cit', 'cf', 'vol', 'vols', 'fol', 'fs', 'leg', 'exp', 'pág', 'pag',
  'págs', 'pp', 'p', 't', 'nº', 'no', 'núm', 'n', 'etc', 'ed', 'eds', 'comp', 'comps', 'coord', 'coords', 's', 'ss', 'ca',
  'c', 'art', 'inc', 'vid', 'id', 'ibid', 'ibíd', 'cfr', 'trad', 'aprox', 'esp', 'ej', 'vs', 'av', 'gral', 'cía', 'hnos', 'sres',
]);

const STOP = new Set(`
el la los las lo un una unos unas y e o u ni que qué quien quién quienes cual cuál cuales cuáles como cómo cuando cuándo
donde dónde en de del al a por para con sin sobre entre hacia hasta desde durante tras ante bajo según mediante contra
este esta estos estas ese esa esos esas aquel aquella aquellos aquellas esto eso aquello su sus mi mis tu tus nuestro nuestra
nuestros nuestras se no sí si también tampoco ya aún así además asimismo aunque pero sino mientras luego después antes
entonces incluso embargo otro otra otros otras todo toda todos todas cada ambos ambas varios varias muchos muchas pocos pocas
algunos algunas algún alguna ningún ninguna uno dos tres cuatro cinco primer primero primera primeros primeras segundo segunda
tercer tercero tercera último última últimos últimas finalmente efecto es era fue son eran fueron ha han había habían hay
puede pueden podía cabe vale resulta parece sería será serían allí aquí ahí allá hoy ayer ello él ella ellos ellas nosotros
nosotras yo le les nos me te cuyo cuya cuyos cuyas dicho dicha dichos dichas tal tales tanto tanta tantos tantas tan más menos
muy mucho mucha poco poca bien mal sólo solo solamente principalmente particularmente especialmente precisamente justamente
efectivamente evidentemente probablemente posiblemente quizás quizá acaso nótese véase ver cf ibid ibíd ibídem ídem idem op cit
capítulo capítulos cap sección parte partes introducción conclusión conclusiones nota notas fuente fuentes bibliografía anexo
anexos apéndice cuadro cuadros tabla tablas gráfico gráficos figura figuras imagen imágenes mapa mapas tomo tomos vol volumen
folio folios foja fojas fs legajo leg caja sala expediente exp documento doc carta cartas pág página páginas págs pp
enero febrero marzo abril mayo junio julio agosto septiembre setiembre octubre noviembre diciembre
lunes martes miércoles jueves viernes sábado domingo siglo siglos año años década décadas ahora mismo misma mismos mismas
respecto frente través pesar fin cuenta modo manera forma caso casos vez veces punto lugar momento hecho hechos sentido medida
medio orden tiempo época período periodo pues porque aunque mediados fines principios comienzos hacia otra parte lado
ésta éste éstos éstas aquél aquélla esa ese ante ellas cuál cuánto cuánta cuántos cuántas dónde adónde cuyo sea sean fuera
fueran estaba estaban estuvo hubo había hace hacía tenía tenían tiene tienen existe existen existía aparece aparecen
`.trim().split(/\s+/));

// Signos tras los cuales la palabra siguiente puede estar en mayúscula solo por iniciar oración.
const BOUNDARY = new Set(['.', '!', '?', '¿', '¡', '\n', '(', '[', '«', '"', '“', '—', '–', '…', '•', '·', '*']);

const TOKEN_RE = /[\p{L}\p{M}][\p{L}\p{M}'’-]*|\d+|\n|[^\s\p{L}\p{M}\d]/gu;
const ROMAN_RE = /^(?=[IVXLCDM]+$)M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;

const isWord = (t) => /^[\p{L}\p{M}]/u.test(t);
const isCap = (t) => /^\p{Lu}/u.test(t);
const isAllCaps = (t) => /^[\p{Lu}\p{M}'’.-]+$/u.test(t) && /\p{Lu}.*\p{Lu}/u.test(t);
const lower = (t) => t.toLocaleLowerCase('es');

export function normKey(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

// Limpieza general del texto extraído de .docx/.pdf
export function cleanText(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/­/g, '')
    .replace(/[   ]/g, ' ')
    .replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Quita la sección final de bibliografía/fuentes para que los autores listados no cuenten como actores.
export function stripReferenceSection(text) {
  const re = /^\s*(bibliograf[íi]a( citada| general)?|fuentes( y bibliograf[íi]a)?( consultadas| citadas)?|referencias( bibliogr[áa]ficas)?|obras citadas)\s*:?\s*$/gim;
  let cut = -1;
  for (const m of text.matchAll(re)) {
    if (m.index > text.length * 0.5) {
      cut = m.index;
      break;
    }
  }
  return cut > 0 ? text.slice(0, cut) : text;
}

function isAcronym(tokens) {
  return tokens.length === 1 && /^\p{Lu}{2,7}$/u.test(tokens[0]);
}

function cleanTokens(rawTokens, initial) {
  let t = rawTokens.slice();
  let titled = false;
  const bare = (x) => lower(x.replace(/\.$/, ''));
  const dropLeadingJoiners = () => {
    while (t.length && JOINERS.has(bare(t[0]))) t.shift();
  };
  let changed = true;
  while (changed && t.length) {
    changed = false;
    if ((TITLES.has(bare(t[0])) || TITLE_ABBR.has(bare(t[0]))) && t.length > 1) {
      t.shift();
      dropLeadingJoiners();
      titled = true;
      changed = true;
    } else if (initial && STOP.has(bare(t[0]))) {
      t.shift();
      dropLeadingJoiners();
      changed = true;
    }
  }
  while (t.length && JOINERS.has(bare(t[t.length - 1]))) t.pop();
  // Los puntos solo se conservan en iniciales ("Julio A. Roca").
  t = t.map((x) => (/^\p{Lu}\.$/u.test(x) ? x : x.replace(/\.$/, '')));
  if (!t.length) return null;
  if (t.length === 1) {
    const w = t[0];
    const lw = bare(w);
    if (STOP.has(lw) || TITLES.has(lw)) return null;
    if (ROMAN_RE.test(w)) return null;
    if (w.length < 3 && !isAcronym(t)) return null;
    if (/^\p{Lu}\.$/u.test(w)) return null;
  }
  if (t.every((x) => STOP.has(bare(x)) || JOINERS.has(bare(x)) || ROMAN_RE.test(x))) return null;
  // Secuencias enteras en mayúsculas de más de una palabra suelen ser títulos o encabezados.
  if (t.length > 1 && t.every((x) => isAllCaps(x) || JOINERS.has(bare(x)) || /^\p{Lu}\.?$/u.test(x))) return null;
  return { tokens: t, titled };
}

/**
 * Extrae candidatos a actores de un texto.
 * Devuelve { items: [{name, count, variants}], cited: [{name, count}], words }
 */
export function extractActors(rawText, { maxItems = 600, noMerge = [] } = {}) {
  const noMergeSet = new Set(noMerge.map(normKey));
  // Las líneas escritas enteras en mayúsculas (encabezados) no se analizan.
  const text = stripReferenceSection(cleanText(rawText))
    .split('\n')
    .map((line) => {
      const letters = line.match(/\p{L}/gu) || [];
      const upper = line.match(/\p{Lu}/gu) || [];
      return letters.length > 8 && upper.length / letters.length > 0.8 ? '' : line;
    })
    .join('\n');
  const tokens = [];
  for (const m of text.matchAll(TOKEN_RE)) tokens.push({ t: m[0], i: m.index });

  const stats = new Map(); // key -> {forms: Map, count, mid, cite, tokens}
  let boundary = true;
  let cur = [];
  let curInitial = false;
  let curEnd = 0;
  let pending = [];

  const flush = () => {
    if (cur.length) {
      const res = cleanTokens(cur, curInitial);
      if (res) record(res.tokens, curInitial && !res.titled, curEnd);
    }
    cur = [];
    pending = [];
  };

  const record = (tk, initial, end) => {
    const name = tk.join(' ');
    const key = normKey(name);
    if (!key) return;
    let s = stats.get(key);
    if (!s) {
      s = { forms: new Map(), count: 0, mid: 0, cite: 0, tokens: tk };
      stats.set(key, s);
    }
    s.count++;
    s.forms.set(name, (s.forms.get(name) || 0) + 1);
    // Una palabra al comienzo de la oración podría estar en mayúscula solo por eso.
    if (!initial || tk.length > 1 || isAcronym(tk)) s.mid++;
    const after = text.slice(end, end + 160);
    if (/^\s*,?\s*\(?\s*(1[5-9]\d\d|20\d\d|s\.\s?f\.)[a-z]?\s*[),:;.]/.test(after)) s.cite++;
    else if (/^\s*,?\s*(op|ob)\.\s*cit/i.test(after)) s.cite++;
    else if (/^\s*,\s*[«“"]/.test(after)) s.cite++;
    else if (tk.length > 1 && /^\s*,\s*[^.;\n]{3,140}?,\s*(1[5-9]\d\d|20\d\d)\s*[,.;)]/.test(after)) s.cite++;
    else if (tk.every((x) => isAllCaps(x) || JOINERS.has(lower(x))) && tk.length >= 1 && !isAcronym(tk) && /^\s*,\s*\p{Lu}\p{Ll}/u.test(after)) s.cite++;
  };

  for (let k = 0; k < tokens.length; k++) {
    const { t, i } = tokens[k];
    if (isWord(t)) {
      if (isCap(t)) {
        if (!cur.length) curInitial = boundary;
        if (pending.length) cur.push(...pending);
        pending = [];
        cur.push(t);
        curEnd = i + t.length;
      } else if (cur.length && JOINERS.has(t) && pending.length < 2) {
        pending.push(t);
      } else {
        flush();
      }
      boundary = false;
      continue;
    }
    if (t === '.') {
      const prev = cur.length ? cur[cur.length - 1] : k > 0 ? tokens[k - 1].t : '';
      const prevBare = lower(prev);
      const isInitial = /^\p{Lu}$/u.test(prev);
      const isAbbrev = ABBREV.has(prevBare);
      if (cur.length && !pending.length && (isInitial || TITLE_ABBR.has(prevBare))) {
        // "Julio A. Roca", "Gral. Paz": la secuencia continúa.
        cur[cur.length - 1] = prev + '.';
        curEnd = i + 1;
        continue;
      }
      flush();
      boundary = !(isAbbrev || isInitial);
      continue;
    }
    flush();
    if (t === ',' || t === ';' || t === ':' || /^\d+$/.test(t)) boundary = false;
    else if (BOUNDARY.has(t)) boundary = true;
  }
  flush();

  // Filtrado
  const kept = new Map();
  const cited = [];
  for (const [key, s] of stats) {
    if (s.cite > 0 && s.cite >= Math.max(1, s.count * 0.5)) {
      cited.push({ name: bestForm(s.forms), count: s.count });
      continue;
    }
    const single = s.tokens.length === 1 && !isAcronym(s.tokens);
    kept.set(key, { name: bestForm(s.forms), count: s.count, mid: s.mid, variants: new Set(), single, last: normKey(s.tokens[s.tokens.length - 1]) });
  }

  // "Gaceta Mercantil" (inicio de oración, sin artículo) -> "La Gaceta Mercantil"
  for (const [key, v] of [...kept]) {
    const m = key.match(/^(el|la|los|las) (.+)$/);
    if (!m) continue;
    const bareKey = m[2];
    const other = kept.get(bareKey);
    if (other && other !== v) {
      v.count += other.count;
      v.mid += other.mid;
      kept.delete(bareKey);
    }
  }

  // Apellido suelto -> nombre completo, si hay uno solo que termine así.
  const byLast = new Map();
  for (const [key, v] of kept) {
    if (v.single || !key.includes(' ')) continue;
    const list = byLast.get(v.last) || [];
    list.push(key);
    byLast.set(v.last, list);
  }
  for (const [key, v] of [...kept]) {
    if (!v.single || key.length < 4 || noMergeSet.has(key)) continue;
    const targets = byLast.get(key);
    if (targets && targets.length === 1) {
      const target = kept.get(targets[0]);
      target.count += v.count;
      target.variants.add(v.name);
      kept.delete(key);
    }
  }
  // Una palabra suelta que solo aparece al comienzo de oraciones no se puede distinguir de una palabra común.
  for (const [key, v] of [...kept]) if (v.single && v.mid === 0) kept.delete(key);

  const items = [...kept.values()]
    .filter((v) => (v.single ? v.count >= 2 : v.count >= 1))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'))
    .slice(0, maxItems)
    .map((v) => {
      const out = { name: v.name, count: v.count };
      if (v.variants.size) out.variants = [...v.variants];
      return out;
    });

  cited.sort((a, b) => b.count - a.count);
  return { items, cited: cited.slice(0, 60), words: countWords(text) };
}

function bestForm(forms) {
  let best = null;
  let bestScore = -1;
  for (const [form, n] of forms) {
    const caps = form.split(' ').every((w) => isAllCaps(w) || JOINERS.has(lower(w)));
    const score = n * (caps ? 0.3 : 1);
    if (score > bestScore) {
      best = form;
      bestScore = score;
    }
  }
  return best;
}

export function countWords(text) {
  const m = String(text || '').match(/[\p{L}\p{M}]+/gu);
  return m ? m.length : 0;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Cuenta menciones de un actor (con sus variantes) sin contar dos veces la misma ocurrencia. */
export function countMentions(text, variants) {
  const list = [...new Set(variants.map((v) => String(v || '').trim()).filter((v) => v.length >= 2))].sort((a, b) => b.length - a.length);
  if (!list.length || !text) return 0;
  const re = new RegExp(`(?<![\\p{L}\\p{M}])(?:${list.map(escapeRe).join('|')})(?![\\p{L}\\p{M}])`, 'gu');
  let n = 0;
  for (const _ of text.matchAll(re)) n++;
  return n;
}
