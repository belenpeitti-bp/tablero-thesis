export function formatBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toLocaleString('es-AR', { maximumFractionDigits: 0 })} KB`;
  return `${(n / 1024 / 1024).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB`;
}

export function formatDate(iso, withTime = false) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('es-AR', withTime ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export function safeFileName(name) {
  return String(name || 'archivo')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(-90);
}

/** Etiqueta corta para columnas y referencias cruzadas: "Int.", "Cap. 3", "Concl." */
export function shortLabel(ch) {
  if (ch.kind === 'chapter') return `Cap. ${ch.short || ''}`.trim();
  return ch.short || ch.label;
}

export function plural(n, one, many) {
  return `${n.toLocaleString('es-AR')} ${n === 1 ? one : many}`;
}

/** Orden alfabético para referencias: ignora comillas, corchetes y mayúsculas. */
export function refSortKey(text) {
  return String(text || '')
    .replace(/^[\s"'«“‘(\[¿¡—–-]+/, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}
