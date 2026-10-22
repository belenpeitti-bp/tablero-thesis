'use client';
import { useEffect, useState } from 'react';
import { useStore } from './StoreProvider';
import { EditableText } from './Editable';
import { ChapterPanel } from './ChapterPanel';

const FOLD_KEY = 'tablero-tesis:plegados';

const MARKS = [
  ['P', 'preguntas', (c) => c.questions.some((x) => x.text.trim())],
  ['H', 'hipótesis', (c) => c.hypotheses.some((x) => x.text.trim())],
  ['D', 'discusiones', (c) => c.debates.some((x) => (x.title + x.text).trim())],
  ['B', 'bibliografía', (c) => c.bibliography.length > 0],
  ['F', 'fuentes', (c) => c.sources.length > 0],
  ['A', 'archivo', (c) => Boolean(c.file)],
];

function IndexNav({ chapters }) {
  return (
    <nav className="toc" aria-label="Índice de la tesis">
      <h2 className="toc-title">Índice</h2>
      <ol>
        {chapters.map((c) => (
          <li key={c.id}>
            <a href={`#${c.id}`}>
              <span className="toc-num">{c.kind === 'chapter' ? c.short : ''}</span>
              <span className="toc-text">
                <span className="toc-label">{c.kind === 'chapter' ? c.title || c.label : c.label}</span>
                <span className="marks" aria-label={`Completado: ${MARKS.filter(([, , t]) => t(c)).map(([, n]) => n).join(', ') || 'nada todavía'}`}>
                  {MARKS.map(([letter, name, test]) => (
                    <span key={letter} className={test(c) ? 'mark on' : 'mark'} title={`${name[0].toUpperCase()}${name.slice(1)}${test(c) ? '' : ' (sin cargar)'}`} aria-hidden="true">
                      {letter}
                    </span>
                  ))}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ol>
      <p className="toc-legend">P preguntas, H hipótesis, D discusiones, B bibliografía, F fuentes, A archivo. En tinta, lo que ya está cargado.</p>
    </nav>
  );
}

export default function Dashboard() {
  const { data, update, editing } = useStore();
  const [folded, setFolded] = useState({});

  useEffect(() => {
    try {
      setFolded(JSON.parse(localStorage.getItem(FOLD_KEY) || '{}'));
    } catch {}
  }, []);
  const persist = (next) => {
    setFolded(next);
    try {
      localStorage.setItem(FOLD_KEY, JSON.stringify(next));
    } catch {}
  };

  // Al llegar con un enlace a un capítulo (#capitulo-3), se despliega.
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      setFolded((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev, [id]: false };
        try {
          localStorage.setItem(FOLD_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
    };
    open();
    window.addEventListener('hashchange', open);
    return () => window.removeEventListener('hashchange', open);
  }, []);

  const t = data.thesis;
  const setThesis = (field) => (v) =>
    update((d) => {
      d.thesis[field] = v;
    });
  const allFolded = data.chapters.every((c) => folded[c.id]);

  return (
    <div className="dashboard">
      <header className="hero">
        <h1 className="thesis-title">
          <EditableText value={t.title} onCommit={setThesis('title')} placeholder="Título de la tesis" emptyText="Tesis doctoral" multiline />
        </h1>
        {(editing || t.subtitle) && (
          <p className="thesis-subtitle">
            <EditableText value={t.subtitle} onCommit={setThesis('subtitle')} placeholder="Subtítulo (opcional)" multiline />
          </p>
        )}
        {(editing || t.author || t.institution) && (
          <p className="thesis-byline">
            <EditableText value={t.author} onCommit={setThesis('author')} placeholder="Autora" />
            {(editing || (t.author && t.institution)) && <span className="byline-sep" aria-hidden="true" />}
            <EditableText value={t.institution} onCommit={setThesis('institution')} placeholder="Programa e institución" />
          </p>
        )}
      </header>

      <div className="layout">
        <aside className="sidebar">
          <IndexNav chapters={data.chapters} />
        </aside>
        <div className="chapters">
          <div className="chapters-toolbar">
            <button
              type="button"
              className="btn quiet small"
              onClick={() => persist(Object.fromEntries(data.chapters.map((c) => [c.id, !allFolded])))}
            >
              {allFolded ? 'Desplegar todo' : 'Plegar todo'}
            </button>
          </div>
          {data.chapters.map((c) => (
            <ChapterPanel key={c.id} chapter={c} open={!folded[c.id]} onToggle={() => persist({ ...folded, [c.id]: !folded[c.id] })} />
          ))}
        </div>
      </div>
    </div>
  );
}
