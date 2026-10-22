'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useStore } from './StoreProvider';
import { AutoField } from './Editable';
import { newId } from '@/lib/defaultData';
import { normKey } from '@/lib/actors';
import { refSortKey, shortLabel, plural } from '@/lib/format';

const KIND = {
  bibliografia: { field: 'bibliography', title: 'Bibliografía', one: 'entrada', many: 'entradas' },
  fuentes: { field: 'sources', title: 'Fuentes', one: 'fuente', many: 'fuentes' },
};
const NO_GROUP = 'Sin clasificar';

function sortRefs(list) {
  return [...list].sort((a, b) => refSortKey(a.text).localeCompare(refSortKey(b.text), 'es'));
}

function groupSources(list) {
  const groups = new Map();
  for (const it of list) {
    const g = it.group?.trim() || NO_GROUP;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(it);
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] === NO_GROUP) - (b[0] === NO_GROUP) || a[0].localeCompare(b[0], 'es'))
    .map(([g, items]) => [g, sortRefs(items)]);
}

function matches(it, q) {
  if (!q) return true;
  return normKey(`${it.text} ${it.group || ''}`).includes(q);
}

async function copyText(text, flash) {
  try {
    await navigator.clipboard.writeText(text);
    flash('Lista copiada. Podés pegarla en tu procesador de texto.');
  } catch {
    flash('No se pudo copiar automáticamente.', 'error');
  }
}

function AddBox({ kind, groups, onAdd }) {
  const [text, setText] = useState('');
  const [group, setGroup] = useState('');
  const isSources = kind === 'fuentes';
  return (
    <form
      className="add-box"
      onSubmit={(e) => {
        e.preventDefault();
        const lines = text
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        if (!lines.length) return;
        onAdd(lines, group.trim());
        setText('');
      }}
    >
      <label className="add-box-label" htmlFor={`add-${kind}`}>
        {isSources ? 'Agregar fuentes' : 'Agregar referencias'}
      </label>
      <p className="hint">Pegá una o varias. Cada línea se guarda como una entrada separada.</p>
      {isSources && (
        <>
          <input
            className="field"
            list="source-groups"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder="Tipo o repositorio (p. ej. Archivo General de la Nación, Prensa periódica)"
            aria-label="Tipo o repositorio"
          />
          <datalist id="source-groups">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </>
      )}
      <textarea
        id={`add-${kind}`}
        className="field"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={isSources ? 'AGN, Sala X, Gobierno, 23-4-5.' : 'Halperin Donghi, Tulio, Revolución y guerra, Buenos Aires, Siglo XXI, 1972.'}
      />
      <button type="submit" className="btn">
        Agregar
      </button>
    </form>
  );
}

function EntryEditor({ it, kind, groups, onChange, onRemove }) {
  return (
    <div className="ref-edit">
      {kind === 'fuentes' && (
        <input
          className="field group-field"
          list="source-groups"
          defaultValue={it.group}
          onBlur={(e) => e.target.value !== it.group && onChange({ group: e.target.value.trim() })}
          aria-label="Tipo o repositorio"
          placeholder="Tipo o repositorio"
        />
      )}
      <AutoField value={it.text} onCommit={(v) => onChange({ text: v })} label="Referencia" />
      <button type="button" className="icon-btn danger" onClick={onRemove} aria-label="Quitar entrada" title="Quitar entrada">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.2 3 8 6.8 11.8 3 13 4.2 9.2 8l3.8 3.8-1.2 1.2L8 9.2 4.2 13 3 11.8 6.8 8 3 4.2z" /></svg>
      </button>
    </div>
  );
}

/** Página de bibliografía o fuentes de un capítulo. */
export function ChapterRefs({ chapterId, kind }) {
  const { data, editing, update, requestSave, flash } = useStore();
  const [query, setQuery] = useState('');
  const conf = KIND[kind];
  const idx = data.chapters.findIndex((c) => c.id === chapterId);
  const chapter = data.chapters[idx];
  if (!chapter || !conf) {
    return (
      <div className="page narrow">
        <p>No existe esa parte de la tesis.</p>
        <Link href="/">Volver al índice</Link>
      </div>
    );
  }
  const list = chapter[conf.field];
  const q = normKey(query);
  const filtered = list.filter((it) => matches(it, q));
  const groups = [...new Set(data.chapters.flatMap((c) => c.sources.map((s) => s.group?.trim()).filter(Boolean)))].sort((a, b) => a.localeCompare(b, 'es'));
  const prev = data.chapters[idx - 1];
  const next = data.chapters[idx + 1];

  const mutate = (fn) =>
    update((d) => {
      fn(d.chapters.find((c) => c.id === chapterId)[conf.field]);
    });

  const add = (lines, group) => {
    const existing = new Set(list.map((it) => normKey(it.text)));
    const fresh = [];
    let repeated = 0;
    for (const l of lines) {
      const k = normKey(l);
      if (existing.has(k)) {
        repeated++;
        continue;
      }
      existing.add(k);
      fresh.push({ id: newId(), text: l, ...(kind === 'fuentes' ? { group } : {}) });
    }
    if (fresh.length) {
      mutate((arr) => arr.push(...fresh));
      requestSave();
    }
    flash(`${plural(fresh.length, 'entrada agregada', 'entradas agregadas')}${repeated ? `; ${plural(repeated, 'ya estaba', 'ya estaban')} en la lista` : ''}.`);
  };

  const asText = () =>
    kind === 'fuentes'
      ? groupSources(list)
          .map(([g, items]) => `${g}\n${items.map((i) => i.text).join('\n')}`)
          .join('\n\n')
      : sortRefs(list)
          .map((i) => i.text)
          .join('\n');

  // Mientras se edita, las entradas no se reordenan (así no saltan de lugar al escribir).
  const order = editing ? (x) => x : sortRefs;
  const grouped = (items) => (editing ? groupSources(items).map(([g]) => [g, items.filter((i) => (i.group?.trim() || NO_GROUP) === g)]) : groupSources(items));

  const renderItem = (it) =>
    editing ? (
      <li key={it.id}>
        <EntryEditor
          it={it}
          kind={kind}
          groups={groups}
          onChange={(patch) =>
            mutate((arr) => {
              const x = arr.find((y) => y.id === it.id);
              if (x) Object.assign(x, patch);
            })
          }
          onRemove={() =>
            mutate((arr) => {
              const i = arr.findIndex((y) => y.id === it.id);
              if (i >= 0) arr.splice(i, 1);
            })
          }
        />
      </li>
    ) : (
      <li key={it.id} className="ref">
        {it.text}
      </li>
    );

  return (
    <div className="page refs-page">
      <nav className="crumbs" aria-label="Ubicación">
        <Link href={`/#${chapter.id}`}>Volver al índice</Link>
      </nav>
      <header className="page-head with-margin">
        <div className={`margin ${chapter.kind === 'chapter' ? 'numbered' : 'worded'}`} aria-hidden="true">
          <span className="numeral">{chapter.kind === 'chapter' ? chapter.short : chapter.label}</span>
        </div>
        <div>
          <p className="chapter-label">{chapter.label}</p>
          <h1 className="page-title">{chapter.title || chapter.label}</h1>
          <nav className="tabs" aria-label="Listas del capítulo">
            {Object.entries(KIND).map(([k, c]) => (
              <Link key={k} href={`/capitulo/${chapter.id}/${k}`} className={k === kind ? 'tab active' : 'tab'} aria-current={k === kind ? 'page' : undefined}>
                {c.title} <span className="tab-count">{chapter[c.field].length}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="refs-toolbar">
        <input className="field search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Filtrar ${conf.title.toLowerCase()}`} aria-label={`Filtrar ${conf.title.toLowerCase()}`} />
        <span className="muted">{q ? `${filtered.length} de ${plural(list.length, conf.one, conf.many)}` : plural(list.length, conf.one, conf.many)}</span>
        {list.length > 0 && (
          <button type="button" className="btn quiet small" onClick={() => copyText(asText(), flash)}>
            Copiar lista
          </button>
        )}
      </div>

      {editing && <AddBox kind={kind} groups={groups} onAdd={add} />}

      {!list.length ? (
        <p className="empty-state">{editing ? 'La lista está vacía. Pegá tus referencias en el cuadro de arriba.' : `Todavía no hay ${conf.title.toLowerCase()} cargada${kind === 'fuentes' ? 's' : ''} para esta parte.`}</p>
      ) : kind === 'fuentes' ? (
        grouped(filtered).map(([g, items]) => (
          <section key={g} className="ref-group">
            <h2>{g}</h2>
            <ul className={editing ? 'ref-list editing' : 'ref-list'}>{items.map(renderItem)}</ul>
          </section>
        ))
      ) : (
        <ul className={editing ? 'ref-list editing' : 'ref-list'}>{order(filtered).map(renderItem)}</ul>
      )}

      <nav className="pager" aria-label="Otras partes">
        {prev ? (
          <Link href={`/capitulo/${prev.id}/${kind}`} className="pager-link">
            <span className="muted">Anterior</span>
            <span>{prev.label}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/capitulo/${next.id}/${kind}`} className="pager-link next">
            <span className="muted">Siguiente</span>
            <span>{next.label}</span>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}

/** Bibliografía o fuentes de toda la tesis, sin duplicados, con los capítulos donde se usa cada entrada. */
export function AllRefs({ kind }) {
  const { data, flash } = useStore();
  const [query, setQuery] = useState('');
  const conf = KIND[kind];
  const merged = useMemo(() => {
    const map = new Map();
    for (const ch of data.chapters) {
      for (const it of ch[conf.field]) {
        const k = normKey(it.text);
        if (!k) continue;
        const e = map.get(k) || { id: k, text: it.text, group: it.group || '', chapters: [] };
        if (!e.chapters.includes(ch)) e.chapters.push(ch);
        if (!e.group && it.group) e.group = it.group;
        map.set(k, e);
      }
    }
    return [...map.values()];
  }, [data, conf.field]);
  const q = normKey(query);
  const filtered = merged.filter((it) => matches(it, q));

  const renderItem = (it) => (
    <li key={it.id} className="ref">
      {it.text}
      <span className="ref-chapters">
        {it.chapters.map((ch) => (
          <Link key={ch.id} href={`/capitulo/${ch.id}/${kind}`} title={ch.title || ch.label}>
            {shortLabel(ch)}
          </Link>
        ))}
      </span>
    </li>
  );
  const asText = () =>
    kind === 'fuentes'
      ? groupSources(merged)
          .map(([g, items]) => `${g}\n${items.map((i) => i.text).join('\n')}`)
          .join('\n\n')
      : sortRefs(merged)
          .map((i) => i.text)
          .join('\n');

  return (
    <div className="page refs-page">
      <header className="page-head">
        <h1 className="page-title">{conf.title} de toda la tesis</h1>
        <p className="lede">Reúne las listas de cada capítulo sin repetir entradas. Al lado de cada una figuran las partes donde se usa. Para agregar o corregir, entrá a la lista de cada capítulo.</p>
        <nav className="chapter-chips" aria-label="Listas por capítulo">
          {data.chapters.map((ch) => (
            <Link key={ch.id} href={`/capitulo/${ch.id}/${kind}`}>
              {shortLabel(ch)} <span className="tab-count">{ch[conf.field].length}</span>
            </Link>
          ))}
        </nav>
      </header>
      <div className="refs-toolbar">
        <input className="field search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Filtrar ${conf.title.toLowerCase()}`} aria-label={`Filtrar ${conf.title.toLowerCase()}`} />
        <span className="muted">{q ? `${filtered.length} de ${plural(merged.length, conf.one, conf.many)}` : plural(merged.length, conf.one, conf.many)}</span>
        {merged.length > 0 && (
          <button type="button" className="btn quiet small" onClick={() => copyText(asText(), flash)}>
            Copiar lista
          </button>
        )}
      </div>
      {!merged.length ? (
        <p className="empty-state">Todavía no hay entradas en ningún capítulo.</p>
      ) : kind === 'fuentes' ? (
        groupSources(filtered).map(([g, items]) => (
          <section key={g} className="ref-group">
            <h2>{g}</h2>
            <ul className="ref-list">{items.map(renderItem)}</ul>
          </section>
        ))
      ) : (
        <ul className="ref-list">{sortRefs(filtered).map(renderItem)}</ul>
      )}
    </div>
  );
}
