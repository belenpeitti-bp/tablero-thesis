'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore } from './StoreProvider';
import { normKey, countMentions } from '@/lib/actors';
import { shortLabel, plural } from '@/lib/format';

function cellLevel(n, max) {
  if (!n) return 0;
  const r = Math.log(n + 1) / Math.log(max + 1);
  return r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1;
}

function TextSearch({ onAdd }) {
  const { getTexts, session, data } = useStore();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const withText = data.chapters.filter((c) => c.text);

  if (!session?.canReadFiles) {
    return <p className="hint">La búsqueda en los textos completos está disponible al ingresar con tu contraseña.</p>;
  }
  if (!withText.length) return <p className="hint">Cuando subas los archivos de los capítulos vas a poder buscar cualquier nombre en sus textos.</p>;

  return (
    <div className="text-search">
      <form
        className="inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const term = q.trim();
          if (!term) return;
          setBusy(true);
          const texts = await getTexts();
          const counts = {};
          for (const [id, text] of texts) counts[id] = countMentions(text, [term]);
          setResult({ term, counts });
          setBusy(false);
        }}
      >
        <input className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Un nombre tal como aparece escrito, p. ej. Sociedad Rural" aria-label="Nombre a buscar en los textos" />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Buscando…' : 'Buscar en los textos'}
        </button>
      </form>
      {result && (
        <div className="search-result">
          <p>
            <strong>{result.term}</strong>{' '}
            {Object.values(result.counts).some(Boolean)
              ? `aparece ${plural(Object.values(result.counts).reduce((a, b) => a + b, 0), 'vez', 'veces')}:`
              : 'no aparece en los textos cargados (la búsqueda distingue mayúsculas y tildes).'}
          </p>
          {Object.values(result.counts).some(Boolean) && (
            <ul className="search-counts">
              {data.chapters
                .filter((c) => result.counts[c.id])
                .map((c) => (
                  <li key={c.id}>
                    <Link href={`/#${c.id}`}>{c.label}</Link> <span className="muted">{result.counts[c.id]}</span>
                  </li>
                ))}
            </ul>
          )}
          {onAdd && Object.values(result.counts).some(Boolean) && (
            <button type="button" className="btn small" onClick={() => onAdd(result.term, result.counts)}>
              Agregar «{result.term}» como actor
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ActorDetail({ actor, allNames, colSpan }) {
  const { data, editing, update, flash } = useStore();
  const [target, setTarget] = useState(actor.name);
  const keysOf = () => [...new Set([actor.name, ...actor.variants].map(normKey).filter(Boolean))];

  const rename = () => {
    const name = target.trim();
    if (!name || name === actor.name) return;
    update((d) => {
      for (const k of keysOf()) d.actorRules.aliases[k] = name;
      d.actorRules.noMerge = d.actorRules.noMerge.filter((k) => !keysOf().includes(normKey(k)));
    });
    flash(allNames.includes(name) ? `Unificado con «${name}».` : `Ahora se muestra como «${name}».`);
  };
  const hide = () => {
    update((d) => {
      d.actorRules.hidden.push(normKey(actor.name));
    });
    flash(`«${actor.name}» quedó oculto. Lo podés recuperar al final de la página.`);
  };
  const separate = (variant) => {
    const k = normKey(variant);
    update((d) => {
      if (!d.actorRules.noMerge.includes(k)) d.actorRules.noMerge.push(k);
      delete d.actorRules.aliases[k];
    });
    flash(`«${variant}» se cuenta aparte. Para separarlo también dentro de cada capítulo, usá «Volver a analizar» en el capítulo.`);
  };
  const removeManual = () => {
    update((d) => {
      d.actorRules.manual = d.actorRules.manual.filter((m) => normKey(m.name) !== actor.key);
    });
  };

  return (
    <tr className="detail-row">
      <td colSpan={colSpan}>
        <div className="actor-detail">
          <div className="detail-col">
            <h3>{actor.name}</h3>
            {actor.type && <p className="muted">{actor.type[0].toUpperCase() + actor.type.slice(1)}</p>}
            <ul className="detail-chapters">
              {data.chapters
                .filter((c) => actor.counts[c.id])
                .map((c) => (
                  <li key={c.id}>
                    <Link href={`/#${c.id}`}>
                      {c.label}
                      {c.title ? `: ${c.title}` : ''}
                    </Link>
                    <span className="muted"> {plural(actor.counts[c.id], 'mención', 'menciones')}</span>
                    {actor.roles?.[c.id] && <p className="role-note">{actor.roles[c.id]}</p>}
                  </li>
                ))}
            </ul>
          </div>
          <div className="detail-col">
            {actor.variants.length > 0 && (
              <>
                <h4>Formas en que aparece</h4>
                <ul className="variants">
                  {actor.variants.map((v) => (
                    <li key={v}>
                      {v}
                      {editing && (
                        <button type="button" className="link-btn" onClick={() => separate(v)}>
                          Contar aparte
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {editing && (
              <div className="detail-actions">
                <label htmlFor={`rename-${actor.key}`}>Nombre a mostrar, o actor con el que unificarlo</label>
                <div className="inline-form">
                  <input id={`rename-${actor.key}`} className="field" list="actor-names" value={target} onChange={(e) => setTarget(e.target.value)} />
                  <button type="button" className="btn small" onClick={rename}>
                    Aplicar
                  </button>
                </div>
                <div className="detail-buttons">
                  <button type="button" className="btn small quiet" onClick={hide}>
                    Ocultar (no es un actor)
                  </button>
                  {actor.manual && (
                    <button type="button" className="btn small quiet danger" onClick={removeManual}>
                      Quitar de los agregados a mano
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function ActorsView() {
  const { data, actorIndex, editing, update, flash } = useStore();
  const params = useSearchParams();
  const focusKey = params.get('actor');
  const chapterFilter = params.get('capitulo');
  const [query, setQuery] = useState('');
  const [onlyRepeated, setOnlyRepeated] = useState(false);
  const [sort, setSort] = useState('partes');
  const [type, setType] = useState('');
  const [openKey, setOpenKey] = useState(focusKey);
  const [limit, setLimit] = useState(150);
  const focusRef = useRef(null);

  useEffect(() => {
    if (focusKey) {
      setOpenKey(focusKey);
      setTimeout(() => focusRef.current?.scrollIntoView({ block: 'center' }), 50);
    }
  }, [focusKey]);
  useEffect(() => {
    if (chapterFilter) setSort(`cap:${chapterFilter}`);
  }, [chapterFilter]);

  const visible = actorIndex.filter((a) => !a.hidden);
  const hidden = actorIndex.filter((a) => a.hidden);
  const types = [...new Set(visible.map((a) => a.type).filter(Boolean))];
  const q = normKey(query);
  const allNames = visible.map((a) => a.name);
  const chapterOfSort = sort.startsWith('cap:') ? sort.slice(4) : null;

  const rows = useMemo(() => {
    let list = visible.filter((a) => (!q || normKey([a.name, ...a.variants].join(' ')).includes(q)) && (!onlyRepeated || a.chapters.length > 1) && (!type || a.type === type));
    if (chapterOfSort) list = list.filter((a) => a.counts[chapterOfSort]);
    const by = {
      partes: (a, b) => b.chapters.length - a.chapters.length || b.total - a.total,
      menciones: (a, b) => b.total - a.total,
      alfabetico: (a, b) => a.name.localeCompare(b.name, 'es'),
    }[sort] || ((a, b) => (b.counts[chapterOfSort] || 0) - (a.counts[chapterOfSort] || 0));
    return [...list].sort(by);
  }, [visible, q, onlyRepeated, type, sort, chapterOfSort]);

  const max = Math.max(1, ...visible.flatMap((a) => Object.values(a.counts)));
  const repeated = visible.filter((a) => a.chapters.length > 1).length;
  const analyzed = data.chapters.filter((c) => c.actors);
  const cited = useMemo(() => {
    const m = new Map();
    for (const ch of data.chapters) {
      for (const c of ch.actors?.cited || []) {
        const k = normKey(c.name);
        const e = m.get(k) || { name: c.name, chapters: [] };
        e.chapters.push(ch);
        m.set(k, e);
      }
    }
    return [...m.values()].sort((a, b) => b.chapters.length - a.chapters.length || a.name.localeCompare(b.name, 'es'));
  }, [data.chapters]);

  const addManual = (name, counts) => {
    update((d) => {
      if (!d.actorRules.manual.some((m) => normKey(m.name) === normKey(name))) d.actorRules.manual.push({ name, variants: [], counts });
      d.actorRules.hidden = d.actorRules.hidden.filter((h) => h !== normKey(name));
    });
    flash(`«${name}» se agregó al índice de actores.`);
  };
  const restore = (a) =>
    update((d) => {
      const keys = [a.name, ...a.variants].map(normKey);
      d.actorRules.hidden = d.actorRules.hidden.filter((h) => !keys.includes(h));
    });

  const colSpan = data.chapters.length + 3;

  return (
    <div className="page actors-page">
      <header className="page-head">
        <h1 className="page-title">Actores</h1>
        <p className="lede">
          {analyzed.length
            ? `Personas, instituciones y grupos detectados en ${plural(analyzed.length, 'parte', 'partes')} de la tesis. Cada fila muestra en qué partes aparece cada actor y cuántas veces. ${plural(repeated, 'actor reaparece', 'actores reaparecen')} en más de una parte.`
            : 'Todavía no se analizó ningún capítulo. Activá la edición y subí el archivo de cada capítulo desde el índice.'}
        </p>
        {!editing && analyzed.length > 0 && <p className="hint">La detección automática puede incluir lugares o nombres que no son actores. Con la edición activada podés ocultarlos, unificar variantes o agregar actores a mano.</p>}
      </header>

      {visible.length > 0 && (
        <>
          <div className="filters" role="group" aria-label="Filtros">
            <input className="field search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar por nombre" aria-label="Filtrar por nombre" />
            <label className="check">
              <input type="checkbox" checked={onlyRepeated} onChange={(e) => setOnlyRepeated(e.target.checked)} /> Solo los que reaparecen
            </label>
            {types.length > 0 && (
              <select className="field" value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo de actor">
                <option value="">Todos los tipos</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
            <select className="field" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Orden">
              <option value="partes">Ordenar por cantidad de partes</option>
              <option value="menciones">Ordenar por menciones</option>
              <option value="alfabetico">Orden alfabético</option>
              {data.chapters.map((c) => (
                <option key={c.id} value={`cap:${c.id}`}>
                  Solo {c.label}, por menciones
                </option>
              ))}
            </select>
            <span className="muted">{plural(rows.length, 'actor', 'actores')}</span>
          </div>

          <datalist id="actor-names">
            {allNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>

          <div className="matrix-wrap">
            <table className="matrix">
              <thead>
                <tr>
                  <th scope="col" className="name-col">
                    Actor
                  </th>
                  {data.chapters.map((c) => (
                    <th scope="col" key={c.id} className="ch-col" title={`${c.label}${c.title ? `: ${c.title}` : ''}`}>
                      {c.kind === 'chapter' ? c.short : c.short}
                    </th>
                  ))}
                  <th scope="col" className="num-col">
                    Partes
                  </th>
                  <th scope="col" className="num-col">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((a) => {
                  const open = openKey === a.key;
                  return [
                    <tr key={a.key} className={open ? 'is-open' : ''} ref={a.key === focusKey ? focusRef : null}>
                      <th scope="row" className="name-col">
                        <button type="button" className="row-toggle" aria-expanded={open} onClick={() => setOpenKey(open ? null : a.key)}>
                          {a.name}
                          {a.manual && <span className="tag">agregado</span>}
                        </button>
                      </th>
                      {data.chapters.map((c) => {
                        const n = a.counts[c.id] || 0;
                        return (
                          <td key={c.id} className={`cell-td${chapterOfSort === c.id ? ' sorted' : ''}`}>
                            <span className={`mcell l${cellLevel(n, max)}`} title={`${a.name} en ${c.label}: ${n ? plural(n, 'mención', 'menciones') : 'no aparece'}`}>
                              {n || ''}
                            </span>
                          </td>
                        );
                      })}
                      <td className="num-col">{a.chapters.length}</td>
                      <td className="num-col">{a.total}</td>
                    </tr>,
                    open ? <ActorDetail key={`${a.key}-detail`} actor={a} allNames={allNames} colSpan={colSpan} /> : null,
                  ];
                })}
              </tbody>
            </table>
          </div>
          {rows.length > limit && (
            <button type="button" className="btn quiet" onClick={() => setLimit(limit + 300)}>
              Mostrar más ({rows.length - limit} restantes)
            </button>
          )}
          <p className="hint matrix-legend">Cada columna es una parte de la tesis (Int. es la introducción y Concl. la conclusión). El número es la cantidad de menciones; cuanto más oscura la celda, más menciones.</p>
        </>
      )}

      <section className="side-section">
        <h2>Buscar un nombre en los capítulos</h2>
        <TextSearch onAdd={editing ? addManual : null} />
      </section>

      {cited.length > 0 && (
        <details className="side-section">
          <summary>Autores citados que no se cuentan como actores ({cited.length})</summary>
          <p className="hint">Aparecen sobre todo en citas bibliográficas, como «Halperin Donghi (1972)». Si alguno es también un actor de tu relato, agregalo con el buscador de arriba.</p>
          <ul className="plain-list">
            {cited.map((c) => (
              <li key={c.name}>
                {c.name} <span className="muted">{c.chapters.map(shortLabel).join(', ')}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {hidden.length > 0 && (
        <details className="side-section">
          <summary>Ocultos ({hidden.length})</summary>
          <ul className="plain-list">
            {hidden.map((a) => (
              <li key={a.key}>
                {a.name} <span className="muted">{plural(a.total, 'mención', 'menciones')}</span>
                {editing && (
                  <button type="button" className="link-btn" onClick={() => restore(a)}>
                    Mostrar de nuevo
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
