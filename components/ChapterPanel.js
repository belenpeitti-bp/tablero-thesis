'use client';
import Link from 'next/link';
import { useStore } from './StoreProvider';
import { EditableText, ItemList, DebateList } from './Editable';
import { ChapterFile } from './ChapterFile';
import { PresenceStrip } from './PresenceStrip';
import { topActorsForChapter } from '@/lib/actorIndex';
import { shortLabel } from '@/lib/format';

function ChapterActors({ chapter }) {
  const { actorIndex, data, editing } = useStore();
  const top = topActorsForChapter(actorIndex, chapter.id, 10);
  if (!chapter.file && !top.length) {
    return editing ? <p className="empty-note actors-hint">Cuando subas el archivo del capítulo, acá vas a ver sus actores principales y en qué otras partes de la tesis reaparecen.</p> : null;
  }
  if (!top.length) return <p className="empty-note">No se detectaron actores en el texto de este capítulo.</p>;
  const max = Math.max(...top.map((a) => Math.max(...Object.values(a.counts))));
  const label = (id) => {
    const ch = data.chapters.find((c) => c.id === id);
    return ch ? shortLabel(ch) : id;
  };
  return (
    <div className="chapter-actors">
      <div className="block-head">
        <h3>Actores principales</h3>
        <Link href={`/actores?capitulo=${chapter.id}`} className="quiet-link">
          Ver todos
        </Link>
      </div>
      <ul className="actor-rows">
        {top.map((a) => (
          <li key={a.key}>
            <Link href={`/actores?actor=${encodeURIComponent(a.key)}`} className="actor-name">
              {a.name}
            </Link>
            <span className="actor-count">{a.here}</span>
            <PresenceStrip actor={a} current={chapter.id} max={max} />
            <span className="actor-elsewhere">{a.elsewhere.length ? `También en ${a.elsewhere.map(label).join(', ')}` : 'Solo en esta parte'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChapterPanel({ chapter, open, onToggle }) {
  const { update } = useStore();
  const setTitle = (v) =>
    update((d) => {
      d.chapters.find((c) => c.id === chapter.id).title = v;
    });
  const isNumbered = chapter.kind === 'chapter';
  const nBib = chapter.bibliography.length;
  const nSrc = chapter.sources.length;

  return (
    <section className={`chapter ${open ? 'is-open' : 'is-closed'}`} id={chapter.id} aria-labelledby={`${chapter.id}-title`}>
      <div className={`margin ${isNumbered ? 'numbered' : 'worded'}`} aria-hidden="true">
        <span className="numeral">{isNumbered ? chapter.short : chapter.label}</span>
      </div>
      <div className="chapter-main">
        <header className="chapter-head">
          <div className="chapter-titles">
            <p className="chapter-label">{chapter.label}</p>
            <h2 id={`${chapter.id}-title`} className="chapter-title">
              <EditableText value={chapter.title} onCommit={setTitle} placeholder="Título del capítulo" emptyText="Sin título todavía" multiline />
            </h2>
          </div>
          <button type="button" className="fold-btn" aria-expanded={open} aria-controls={`${chapter.id}-content`} onClick={onToggle}>
            <span className="visually-hidden">{open ? 'Plegar' : 'Desplegar'} {chapter.label}</span>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        </header>

        <div id={`${chapter.id}-content`} className="chapter-content" hidden={!open}>
          <div className="two-cols">
            <div className="block">
              <div className="block-head">
                <h3>Preguntas de investigación</h3>
              </div>
              <ItemList chapterId={chapter.id} field="questions" addLabel="Agregar pregunta" placeholder="¿…?" emptyText="Sin preguntas cargadas." />
            </div>
            <div className="block">
              <div className="block-head">
                <h3>Hipótesis</h3>
              </div>
              <ItemList chapterId={chapter.id} field="hypotheses" prefix="H" addLabel="Agregar hipótesis" placeholder="Hipótesis" emptyText="Sin hipótesis cargadas." />
            </div>
          </div>

          <div className="block">
            <div className="block-head">
              <h3>Discusiones historiográficas</h3>
            </div>
            <DebateList chapterId={chapter.id} />
          </div>

          <div className="chapter-foot">
            <nav className="ref-links" aria-label={`Listas de ${chapter.label}`}>
              <Link href={`/capitulo/${chapter.id}/bibliografia`} className="ref-link">
                <span>Bibliografía</span>
                <span className="ref-count">{nBib ? `${nBib} ${nBib === 1 ? 'entrada' : 'entradas'}` : 'vacía'}</span>
              </Link>
              <Link href={`/capitulo/${chapter.id}/fuentes`} className="ref-link">
                <span>Fuentes</span>
                <span className="ref-count">{nSrc ? `${nSrc} ${nSrc === 1 ? 'entrada' : 'entradas'}` : 'vacía'}</span>
              </Link>
            </nav>
            <ChapterFile chapter={chapter} />
          </div>

          <ChapterActors chapter={chapter} />
        </div>
      </div>
    </section>
  );
}
