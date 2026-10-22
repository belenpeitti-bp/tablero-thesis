'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from './StoreProvider';
import { newId } from '@/lib/defaultData';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Campo de texto que se ajusta a su contenido y confirma los cambios al dejar de escribir. */
export function AutoField({ value, onCommit, placeholder, multiline = true, className = '', label, autoFocus }) {
  const [local, setLocal] = useState(value || '');
  const ref = useRef(null);
  const timer = useRef(null);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setLocal(value || '');
  }, [value]);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (el && multiline) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [local, multiline]);

  const commit = (v) => {
    clearTimeout(timer.current);
    if (v !== (value || '')) onCommit(v);
  };
  const onChange = (e) => {
    const v = e.target.value;
    setLocal(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(v), 600);
  };
  const common = {
    ref,
    value: local,
    onChange,
    placeholder,
    'aria-label': label || placeholder,
    className: `field ${className}`,
    autoFocus,
    onFocus: () => (focused.current = true),
    onBlur: () => {
      focused.current = false;
      commit(local);
    },
  };
  return multiline ? <textarea rows={1} {...common} /> : <input type="text" {...common} />;
}

/** Texto que se muestra normal y se vuelve editable en modo edición. */
export function EditableText({ value, onCommit, placeholder, as: Tag = 'span', className = '', multiline = false, emptyText = '' }) {
  const { editing } = useStore();
  if (editing) return <AutoField value={value} onCommit={onCommit} placeholder={placeholder} multiline={multiline} className={className} />;
  if (!value) return emptyText ? <Tag className={`${className} is-empty`}>{emptyText}</Tag> : null;
  return <Tag className={className}>{value}</Tag>;
}

function moveItem(list, index, delta) {
  const j = index + delta;
  if (j < 0 || j >= list.length) return;
  const [it] = list.splice(index, 1);
  list.splice(j, 0, it);
}

export function RowTools({ index, total, onMove, onRemove, removeLabel }) {
  return (
    <div className="row-tools">
      <button type="button" className="icon-btn" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Subir" title="Subir">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5 3.5 8h3v4.5h3V8h3z" /></svg>
      </button>
      <button type="button" className="icon-btn" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Bajar" title="Bajar">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 12.5 12.5 8h-3V3.5h-3V8h-3z" /></svg>
      </button>
      <button type="button" className="icon-btn danger" onClick={onRemove} aria-label={removeLabel} title={removeLabel}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.2 3 8 6.8 11.8 3 13 4.2 9.2 8l3.8 3.8-1.2 1.2L8 9.2 4.2 13 3 11.8 6.8 8 3 4.2z" /></svg>
      </button>
    </div>
  );
}

/** Lista numerada (preguntas, hipótesis). `getList` recibe el capítulo (borrador) y devuelve el arreglo. */
export function ItemList({ chapterId, field, prefix, addLabel, placeholder, emptyText }) {
  const { data, editing, update } = useStore();
  const chapter = data.chapters.find((c) => c.id === chapterId);
  const items = chapter[field];
  const mutate = (fn) =>
    update((d) => {
      const ch = d.chapters.find((c) => c.id === chapterId);
      fn(ch[field]);
    });
  const [focusId, setFocusId] = useState(null);

  if (!editing) {
    if (!items.length) return <p className="empty-note">{emptyText}</p>;
    return (
      <ol className="items">
        {items.map((it, i) => (
          <li key={it.id}>
            <span className="item-mark">{prefix ? `${prefix}${i + 1}` : `${i + 1}.`}</span>
            <span className="item-text">{it.text}</span>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <div className="items editing">
      {items.map((it, i) => (
        <div className="edit-row" key={it.id}>
          <span className="item-mark">{prefix ? `${prefix}${i + 1}` : `${i + 1}.`}</span>
          <AutoField
            value={it.text}
            placeholder={placeholder}
            autoFocus={focusId === it.id}
            onCommit={(v) =>
              mutate((list) => {
                const x = list.find((y) => y.id === it.id);
                if (x) x.text = v;
              })
            }
          />
          <RowTools
            index={i}
            total={items.length}
            onMove={(delta) => mutate((list) => moveItem(list, i, delta))}
            onRemove={() => mutate((list) => list.splice(i, 1))}
            removeLabel="Quitar"
          />
        </div>
      ))}
      <button
        type="button"
        className="add-btn"
        onClick={() => {
          const id = newId();
          setFocusId(id);
          mutate((list) => list.push({ id, text: '' }));
        }}
      >
        {addLabel}
      </button>
    </div>
  );
}

export function DebateList({ chapterId }) {
  const { data, editing, update } = useStore();
  const chapter = data.chapters.find((c) => c.id === chapterId);
  const items = chapter.debates;
  const [focusId, setFocusId] = useState(null);
  const mutate = (fn) =>
    update((d) => {
      const ch = d.chapters.find((c) => c.id === chapterId);
      fn(ch.debates);
    });

  if (!editing) {
    if (!items.length) return <p className="empty-note">Sin discusiones cargadas.</p>;
    return (
      <div className="debates">
        {items.map((it) => (
          <article className="debate" key={it.id}>
            {it.title && <h4>{it.title}</h4>}
            {it.text && <p>{it.text}</p>}
          </article>
        ))}
      </div>
    );
  }
  return (
    <div className="debates editing">
      {items.map((it, i) => (
        <div className="edit-row debate-edit" key={it.id}>
          <div className="debate-fields">
            <AutoField
              multiline={false}
              className="debate-title-field"
              value={it.title}
              placeholder="Debate o eje (p. ej. «La naturaleza del régimen rosista»)"
              autoFocus={focusId === it.id}
              onCommit={(v) =>
                mutate((list) => {
                  const x = list.find((y) => y.id === it.id);
                  if (x) x.title = v;
                })
              }
            />
            <AutoField
              value={it.text}
              placeholder="Posturas, autores en discusión y cómo se ubica la tesis"
              onCommit={(v) =>
                mutate((list) => {
                  const x = list.find((y) => y.id === it.id);
                  if (x) x.text = v;
                })
              }
            />
          </div>
          <RowTools index={i} total={items.length} onMove={(delta) => mutate((list) => moveItem(list, i, delta))} onRemove={() => mutate((list) => list.splice(i, 1))} removeLabel="Quitar discusión" />
        </div>
      ))}
      <button
        type="button"
        className="add-btn"
        onClick={() => {
          const id = newId();
          setFocusId(id);
          mutate((list) => list.push({ id, title: '', text: '' }));
        }}
      >
        Agregar discusión
      </button>
    </div>
  );
}
