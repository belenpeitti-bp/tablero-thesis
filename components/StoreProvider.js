'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createDefaultData, normalizeData } from '@/lib/defaultData';
import { buildActorIndex } from '@/lib/actorIndex';

const StoreCtx = createContext(null);
export const useStore = () => useContext(StoreCtx);

const DRAFT_KEY = 'tablero-tesis:borrador';
const EDIT_KEY = 'tablero-tesis:editando';

function rememberEditing(on) {
  try {
    if (on) sessionStorage.setItem(EDIT_KEY, '1');
    else sessionStorage.removeItem(EDIT_KEY);
  } catch {}
}
function wasEditing() {
  try {
    return sessionStorage.getItem(EDIT_KEY) === '1';
  } catch {
    return false;
  }
}
const IDLE_MS = 15_000; // guarda tras 15 s sin cambios…
const MIN_INTERVAL_MS = 90_000; // …pero no más de una vez cada 90 s
const MAX_DIRTY_MS = 180_000; // y nunca deja cambios sin guardar más de 3 min

export async function api(url, opts = {}) {
  const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...opts });
  const type = res.headers.get('content-type') || '';
  const body = type.includes('json') ? await res.json().catch(() => null) : await res.text();
  if (!res.ok) {
    const err = new Error((body && body.error) || (typeof body === 'string' && body.slice(0, 200)) || `Error ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeDraft(data) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {}
}
function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
}

export function StoreProvider({ children }) {
  const [session, setSession] = useState(null);
  const [data, setData] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | ready | locked | error
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [draftOffer, setDraftOffer] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [notice, setNotice] = useState(null);

  const etagRef = useRef(null);
  const dataRef = useRef(null);
  const extraOpsRef = useRef(0);
  const lastSaveRef = useRef(0);
  const dirtySinceRef = useRef(0);
  const changeCounter = useRef(0);
  const savingRef = useRef(false);
  const draftTimer = useRef(null);
  const textCache = useRef(new Map());
  const pendingSaveRef = useRef(false);
  const againRef = useRef(false);
  const saveRef = useRef(null);
  dataRef.current = data;

  const loadSession = useCallback(async () => {
    const s = await api('/api/session');
    setSession(s);
    return s;
  }, []);

  const loadData = useCallback(async (s) => {
    try {
      const fresh = s?.role === 'admin';
      const res = await api(`/api/data${fresh ? '?fresh=1' : ''}`);
      etagRef.current = res.etag;
      const d = normalizeData(res.data || createDefaultData());
      setData(d);
      setDirty(false);
      setConflict(false);
      setPhase('ready');
      if (s?.role === 'admin') {
        const draft = readDraft();
        const savedAt = Date.parse(d.meta?.updatedAt || 0) || 0;
        if (draft?.data && draft.savedAt > savedAt && JSON.stringify(normalizeData(draft.data).chapters) !== JSON.stringify(d.chapters)) {
          setDraftOffer(draft);
        } else if (draft) clearDraft();
      }
      return d;
    } catch (e) {
      if (e.status === 401) {
        setPhase('locked');
        return null;
      }
      setLoadError(e.message);
      setPhase('error');
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = await loadSession();
        const d = await loadData(s);
        if (d && s.role === 'admin' && wasEditing()) setEditing(true);
      } catch (e) {
        setLoadError(e.message);
        setPhase('error');
      }
    })();
  }, [loadSession, loadData]);

  const update = useCallback((mutator) => {
    setData((prev) => {
      const next = structuredClone(prev);
      mutator(next);
      clearTimeout(draftTimer.current);
      draftTimer.current = setTimeout(() => writeDraft(next), 800);
      return next;
    });
    if (!dirtySinceRef.current) dirtySinceRef.current = Date.now();
    changeCounter.current++;
    setDirty(true);
  }, []);

  const save = useCallback(async ({ force = false } = {}) => {
    const d = dataRef.current;
    if (!d) return false;
    if (savingRef.current) {
      // Ya hay un guardado en curso: se repite al terminar para incluir lo último.
      againRef.current = true;
      return false;
    }
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    const counterAtStart = changeCounter.current;
    try {
      const res = await api('/api/data', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data: d, etag: etagRef.current, force, extraOps: extraOpsRef.current }),
      });
      etagRef.current = res.etag;
      extraOpsRef.current = 0;
      lastSaveRef.current = Date.now();
      setLastSavedAt(new Date());
      setData((prev) => ({ ...prev, meta: res.meta }));
      setConflict(false);
      if (changeCounter.current === counterAtStart) {
        setDirty(false);
        dirtySinceRef.current = 0;
        clearDraft();
      }
      return true;
    } catch (e) {
      if (e.status === 409) setConflict(true);
      else if (e.status === 401) {
        setSaveError('Tu sesión de edición venció. Ingresá de nuevo y se guardará lo pendiente.');
        setLoginOpen(true);
      } else setSaveError(e.message);
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
      if (againRef.current) {
        againRef.current = false;
        setTimeout(() => saveRef.current?.(), 0);
      }
    }
  }, []);
  saveRef.current = save;

  // Guardado inmediato pedido junto con un cambio (por ejemplo, después de subir un archivo).
  const requestSave = useCallback(() => {
    pendingSaveRef.current = true;
  }, []);
  useEffect(() => {
    if (pendingSaveRef.current && data) {
      pendingSaveRef.current = false;
      save();
    }
  }, [data, save]);

  // Guardado automático, espaciado para cuidar el cupo de operaciones del plan gratuito de Vercel.
  useEffect(() => {
    if (!dirty || !editing || conflict) return;
    const now = Date.now();
    let wait = Math.max(IDLE_MS, MIN_INTERVAL_MS - (now - lastSaveRef.current));
    if (dirtySinceRef.current) wait = Math.min(wait, Math.max(5_000, dirtySinceRef.current + MAX_DIRTY_MS - now));
    const t = setTimeout(() => save(), wait);
    return () => clearTimeout(t);
  }, [data, dirty, editing, conflict, save]);

  useEffect(() => {
    const handler = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const startEditing = useCallback(() => {
    if (session?.role === 'admin') {
      setEditing(true);
      rememberEditing(true);
    } else setLoginOpen(true);
  }, [session]);

  const stopEditing = useCallback(async () => {
    if (dirty) await save();
    setEditing(false);
    rememberEditing(false);
  }, [dirty, save]);

  const login = useCallback(
    async (password) => {
      const res = await api('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const s = await loadSession();
      setLoginOpen(false);
      if (phase !== 'ready' || !dirty) await loadData(s);
      if (res.role === 'admin') {
        setEditing(true);
        rememberEditing(true);
        if (dirty) save();
      }
      return res.role;
    },
    [loadSession, loadData, phase, dirty, save]
  );

  const logout = useCallback(async () => {
    if (dirty) await save();
    await api('/api/logout', { method: 'POST' });
    setEditing(false);
    rememberEditing(false);
    textCache.current.clear();
    const s = await loadSession();
    if (s.locked) setPhase('locked');
    else await loadData(s);
  }, [dirty, save, loadSession, loadData]);

  const reloadFromServer = useCallback(async () => {
    clearDraft();
    setDraftOffer(null);
    await loadData(session);
  }, [loadData, session]);

  const recoverDraft = useCallback(() => {
    if (!draftOffer) return;
    setData((prev) => ({ ...normalizeData(draftOffer.data), meta: prev.meta }));
    setDirty(true);
    dirtySinceRef.current = Date.now();
    changeCounter.current++;
    setDraftOffer(null);
  }, [draftOffer]);

  const discardDraft = useCallback(() => {
    clearDraft();
    setDraftOffer(null);
  }, []);

  const replaceAll = useCallback((imported) => {
    setData((prev) => ({ ...normalizeData(imported), meta: prev.meta }));
    setDirty(true);
    dirtySinceRef.current = Date.now();
    changeCounter.current++;
  }, []);

  const addOps = useCallback((n) => {
    extraOpsRef.current += n;
  }, []);

  /** Textos completos de los capítulos (para buscar nombres). */
  const getTexts = useCallback(async () => {
    const d = dataRef.current;
    const out = new Map();
    await Promise.all(
      (d?.chapters || [])
        .filter((c) => c.text)
        .map(async (c) => {
          const stamp = c.text.updatedAt || '';
          const cached = textCache.current.get(c.id);
          if (cached && cached.stamp === stamp) {
            out.set(c.id, cached.text);
            return;
          }
          try {
            const text = await api(`/api/text?chapter=${encodeURIComponent(c.id)}`);
            textCache.current.set(c.id, { stamp, text });
            out.set(c.id, text);
          } catch {}
        })
    );
    return out;
  }, []);

  const rememberText = useCallback((chapterId, stamp, text) => {
    textCache.current.set(chapterId, { stamp, text });
  }, []);

  const actorIndex = useMemo(() => (data ? buildActorIndex(data.chapters, data.actorRules) : []), [data]);

  const flash = useCallback((message, tone = 'ok') => {
    setNotice({ message, tone, at: Date.now() });
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  const value = {
    session,
    data,
    phase,
    loadError,
    editing: editing && session?.role === 'admin',
    isAdmin: session?.role === 'admin',
    dirty,
    saving,
    saveError,
    conflict,
    lastSavedAt,
    draftOffer,
    loginOpen,
    notice,
    actorIndex,
    setLoginOpen,
    update,
    save,
    requestSave,
    startEditing,
    stopEditing,
    login,
    logout,
    reloadFromServer,
    recoverDraft,
    discardDraft,
    replaceAll,
    addOps,
    getTexts,
    rememberText,
    flash,
  };
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
