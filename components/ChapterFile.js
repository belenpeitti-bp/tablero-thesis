'use client';
import { useRef, useState } from 'react';
import { useStore, api } from './StoreProvider';
import { extractText, contentTypeFor, ACCEPTED } from '@/lib/extractText';
import { extractActors, countMentions } from '@/lib/actors';
import { formatBytes, formatDate, safeFileName, plural } from '@/lib/format';

const SERVER_LIMIT = 4.3 * 1024 * 1024;

export function downloadHref(file) {
  return `/api/file?pathname=${encodeURIComponent(file.pathname)}&name=${encodeURIComponent(file.name)}&size=${file.size || 0}`;
}

export function ChapterFile({ chapter }) {
  const { session, editing, update, requestSave, addOps, rememberText, data, flash } = useStore();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const inputRef = useRef(null);
  const file = chapter.file;
  const actors = chapter.actors;

  const applyAnalysis = (text, stamp, extra = {}) => {
    const result = extractActors(text, { noMerge: data.actorRules.noMerge });
    update((d) => {
      const ch = d.chapters.find((c) => c.id === chapter.id);
      ch.actors = { method: 'auto', analyzedAt: stamp, items: result.items, cited: result.cited };
      if (ch.text) ch.text.words = result.words;
      Object.assign(ch, extra);
      for (const m of d.actorRules.manual) {
        m.counts = { ...(m.counts || {}), [chapter.id]: countMentions(text, [m.name, ...(m.variants || [])]) };
      }
    });
    return result;
  };

  async function serverUpload(f) {
    const form = new FormData();
    form.append('file', f);
    form.append('chapter', chapter.id);
    const res = await api('/api/files', { method: 'POST', body: form });
    return res.pathname;
  }

  async function handleFile(f) {
    if (!f) return;
    setError('');
    setWarning('');
    let text = '';
    try {
      setBusy('Leyendo el archivo…');
      text = await extractText(f);
    } catch (e) {
      setBusy('');
      setError(e.message);
      return;
    }
    try {
      setBusy('Subiendo el archivo…');
      let pathname;
      const target = `capitulos/${chapter.id}/${safeFileName(f.name)}`;
      if (session.storage === 'blob') {
        try {
          const { upload } = await import('@vercel/blob/client');
          const blob = await upload(target, f, {
            access: 'private',
            handleUploadUrl: '/api/upload',
            contentType: contentTypeFor(f.name),
            multipart: f.size > 30 * 1024 * 1024,
          });
          pathname = blob.pathname;
        } catch (e) {
          if (f.size > SERVER_LIMIT) throw new Error(`No se pudo subir el archivo (${e.message}).`);
          pathname = await serverUpload(f);
        }
      } else {
        pathname = await serverUpload(f);
      }

      const stamp = new Date().toISOString();
      let textSaved = false;
      if (text && text.length < 4_000_000) {
        setBusy('Guardando el texto del capítulo…');
        await api(`/api/text?chapter=${encodeURIComponent(chapter.id)}`, {
          method: 'PUT',
          headers: { 'content-type': 'text/plain; charset=utf-8' },
          body: text,
        });
        textSaved = true;
        rememberText(chapter.id, stamp, text);
      }

      const oldPath = chapter.file?.pathname;
      const fileMeta = { name: f.name, pathname, size: f.size, type: contentTypeFor(f.name), uploadedAt: stamp };
      if (text) {
        setBusy('Buscando actores…');
        const result = applyAnalysis(text, stamp, {
          file: fileMeta,
          text: textSaved ? { chars: text.length, updatedAt: stamp } : null,
        });
        flash(`Archivo subido. Se detectaron ${plural(result.items.length, 'posible actor', 'posibles actores')}.`);
      } else {
        update((d) => {
          const ch = d.chapters.find((c) => c.id === chapter.id);
          ch.file = fileMeta;
          ch.text = null;
          ch.actors = null;
        });
        setWarning('El archivo se guardó, pero no tiene texto seleccionable (¿es un escaneo?). Sin texto no se pueden detectar actores.');
      }
      addOps(textSaved ? 2 : 1);
      requestSave();
      if (oldPath && oldPath !== pathname) {
        api(`/api/files?pathname=${encodeURIComponent(oldPath)}`, { method: 'DELETE' }).catch(() => {});
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function reanalyze() {
    setError('');
    try {
      setBusy('Volviendo a analizar…');
      const text = await api(`/api/text?chapter=${encodeURIComponent(chapter.id)}`);
      const result = applyAnalysis(text, new Date().toISOString());
      requestSave();
      flash(`Análisis actualizado: ${plural(result.items.length, 'posible actor', 'posibles actores')}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  async function detectWithAI() {
    setError('');
    try {
      setBusy('La IA está leyendo el capítulo. Puede tardar uno o dos minutos…');
      const res = await api('/api/ai-actors', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chapter: chapter.id }),
      });
      const stamp = new Date().toISOString();
      update((d) => {
        const ch = d.chapters.find((c) => c.id === chapter.id);
        ch.actors = { method: 'ia', model: res.model, analyzedAt: stamp, items: res.items, cited: ch.actors?.cited || [] };
      });
      requestSave();
      flash(`La IA identificó ${plural(res.items.length, 'actor', 'actores')}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  async function removeFile() {
    if (!window.confirm(`¿Quitar el archivo «${file.name}» y los actores detectados en este capítulo?`)) return;
    setError('');
    try {
      setBusy('Quitando…');
      await api(`/api/files?pathname=${encodeURIComponent(file.pathname)}`, { method: 'DELETE' });
      await api(`/api/text?chapter=${encodeURIComponent(chapter.id)}`, { method: 'DELETE' }).catch(() => {});
      update((d) => {
        const ch = d.chapters.find((c) => c.id === chapter.id);
        ch.file = null;
        ch.text = null;
        ch.actors = null;
        for (const m of d.actorRules.manual) if (m.counts) delete m.counts[chapter.id];
      });
      requestSave();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  const canDownload = session?.canReadFiles;

  if (!editing) {
    if (!file) return null;
    return (
      <div className="file-box">
        <span className="file-label">Archivo del capítulo</span>
        {canDownload ? (
          <a className="file-name" href={downloadHref(file)}>
            {file.name}
          </a>
        ) : (
          <span className="file-name">{file.name}</span>
        )}
        <span className="file-meta">
          {formatBytes(file.size)}, subido el {formatDate(file.uploadedAt)}
        </span>
      </div>
    );
  }

  return (
    <div className="file-box editing" aria-busy={Boolean(busy)}>
      <input ref={inputRef} type="file" accept={ACCEPTED} hidden onChange={(e) => handleFile(e.target.files?.[0])} />
      {file ? (
        <>
          <span className="file-label">Archivo del capítulo</span>
          <a className="file-name" href={downloadHref(file)}>
            {file.name}
          </a>
          <span className="file-meta">
            {formatBytes(file.size)}, subido el {formatDate(file.uploadedAt)}
          </span>
          <div className="file-actions">
            <button type="button" className="btn small" disabled={Boolean(busy)} onClick={() => inputRef.current?.click()}>
              Reemplazar archivo
            </button>
            {chapter.text && (
              <button type="button" className="btn small" disabled={Boolean(busy)} onClick={reanalyze}>
                Volver a analizar
              </button>
            )}
            {chapter.text && session?.ai && (
              <button type="button" className="btn small" disabled={Boolean(busy)} onClick={detectWithAI}>
                Detectar actores con IA
              </button>
            )}
            <button type="button" className="btn small quiet danger" disabled={Boolean(busy)} onClick={removeFile}>
              Quitar
            </button>
          </div>
          {actors && (
            <p className="file-note">
              {actors.method === 'ia' ? 'Actores identificados con IA' : 'Actores detectados automáticamente'} el {formatDate(actors.analyzedAt)}.
            </p>
          )}
        </>
      ) : (
        <div
          className="dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add('over');
          }}
          onDragLeave={(e) => e.currentTarget.classList.remove('over')}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('over');
            handleFile(e.dataTransfer.files?.[0]);
          }}
        >
          <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => inputRef.current?.click()}>
            Subir el capítulo
          </button>
          <span>o arrastralo acá. Formatos: .docx, .pdf o .txt.</span>
        </div>
      )}
      {busy && (
        <p className="status-line" role="status">
          {busy}
        </p>
      )}
      {warning && <p className="warn-line">{warning}</p>}
      {error && (
        <p className="error-line" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
