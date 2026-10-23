'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useStore } from './StoreProvider';
import { formatDate, formatTime } from '@/lib/format';

const OPS_INCLUDED = 2000;

function LoginForm({ inline = false }) {
  const { login } = useStore();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <form
      className={inline ? 'login-form inline' : 'login-form'}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await login(password);
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="pw">Contraseña</label>
      <input ref={ref} id="pw" className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && (
        <p className="error-line" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn" disabled={busy || !password}>
        {busy ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}

function LoginDialog() {
  const { loginOpen, setLoginOpen } = useStore();
  useEffect(() => {
    if (!loginOpen) return;
    const onKey = (e) => e.key === 'Escape' && setLoginOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loginOpen, setLoginOpen]);
  if (!loginOpen) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setLoginOpen(false)}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="login-title">
        <h2 id="login-title">Ingresar para editar</h2>
        <LoginForm />
        <button type="button" className="link-btn" onClick={() => setLoginOpen(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function MoreMenu() {
  const { data, session, replaceAll, logout, flash } = useStore();
  const fileRef = useRef(null);
  const ops = data.meta?.ops?.month === new Date().toISOString().slice(0, 7) ? data.meta.ops.count : 0;
  const download = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tesis-copia-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return (
    <details className="more">
      <summary className="btn quiet small">Más</summary>
      <div className="more-panel">
        <button type="button" className="menu-item" onClick={download}>
          Descargar una copia de seguridad
        </button>
        <button type="button" className="menu-item" onClick={() => fileRef.current?.click()}>
          Restaurar desde una copia
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const parsed = JSON.parse(await f.text());
              if (!Array.isArray(parsed.chapters)) throw new Error();
              if (window.confirm('Esto reemplaza todo el contenido actual del tablero por el de la copia. ¿Continuar?')) {
                replaceAll(parsed);
                flash('Copia restaurada. Se guardará en unos segundos.');
              }
            } catch {
              flash('Ese archivo no es una copia válida del tablero.', 'error');
            }
          }}
        />
        {session?.storage === 'blob' && (
          <p className="menu-note">
            Guardados este mes: {ops.toLocaleString('es-AR')} de {OPS_INCLUDED.toLocaleString('es-AR')} incluidos en el plan gratuito de Vercel.
          </p>
        )}
        {data.meta?.lastBackupAt && <p className="menu-note">Último respaldo automático: {formatDate(data.meta.lastBackupAt, true)}.</p>}
        {!(session?.open && !session?.locked) && (
          <button type="button" className="menu-item" onClick={logout}>
            Cerrar sesión
          </button>
        )}
      </div>
    </details>
  );
}

function TopBar() {
  const { data, editing, isAdmin, startEditing, stopEditing, save, dirty, saving, saveError, lastSavedAt, session, logout } = useStore();
  const pathname = usePathname();
  const links = [
    ['/', 'Índice'],
    ['/actores', 'Actores'],
    ['/bibliografia', 'Bibliografía'],
    ['/fuentes', 'Fuentes'],
  ];
  const active = (href) => (href === '/' ? pathname === '/' : pathname.startsWith(href) || (href !== '/actores' && pathname.includes(href.slice(1))));
  const status = saving ? 'Guardando…' : saveError ? 'No se pudo guardar' : dirty ? 'Cambios sin guardar' : lastSavedAt ? `Guardado a las ${formatTime(lastSavedAt)}` : 'Todo guardado';
  return (
    <header className={`topbar${editing ? ' is-editing' : ''}`}>
      <div className="topbar-inner">
        <Link href="/" className="brand">
          {data.thesis.title || 'Tesis doctoral'}
        </Link>
        <nav className="mainnav" aria-label="Secciones">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className={active(href) ? 'active' : ''} aria-current={active(href) ? 'page' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="edit-zone">
          {editing ? (
            <>
              <span className={`save-status${dirty ? ' pending' : ''}${saveError ? ' failed' : ''}`} role="status">
                {status}
              </span>
              {dirty && !saving && (
                <button type="button" className="btn small quiet" onClick={() => save()}>
                  Guardar ahora
                </button>
              )}
              <button type="button" className="btn small" onClick={stopEditing}>
                Terminar edición
              </button>
              <MoreMenu />
            </>
          ) : (
            <>
              <button type="button" className="btn small" onClick={startEditing}>
                Editar
              </button>
              {!isAdmin && session?.role === 'viewer' && (
                <button type="button" className="btn small quiet" onClick={logout}>
                  Salir
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function Banners() {
  const { conflict, reloadFromServer, save, draftOffer, recoverDraft, discardDraft, saveError, editing, data, session } = useStore();
  const ops = data.meta?.ops?.month === new Date().toISOString().slice(0, 7) ? data.meta.ops.count : 0;
  return (
    <div className="banners">
      {conflict && (
        <div className="banner warn" role="alert">
          <p>Hay una versión guardada más nueva que la que tenés abierta (quizás editaste desde otro dispositivo o pestaña).</p>
          <div className="banner-actions">
            <button type="button" className="btn small" onClick={reloadFromServer}>
              Cargar la versión guardada
            </button>
            <button type="button" className="btn small quiet" onClick={() => save({ force: true })}>
              Guardar la mía encima
            </button>
          </div>
        </div>
      )}
      {draftOffer && (
        <div className="banner" role="status">
          <p>Quedaron cambios sin guardar de una sesión anterior ({formatDate(new Date(draftOffer.savedAt).toISOString(), true)}).</p>
          <div className="banner-actions">
            <button type="button" className="btn small" onClick={recoverDraft}>
              Recuperarlos
            </button>
            <button type="button" className="btn small quiet" onClick={discardDraft}>
              Descartarlos
            </button>
          </div>
        </div>
      )}
      {saveError && editing && (
        <div className="banner warn" role="alert">
          <p>{saveError}</p>
          <div className="banner-actions">
            <button type="button" className="btn small" onClick={() => save()}>
              Reintentar
            </button>
          </div>
        </div>
      )}
      {editing && session?.storage === 'local' && (
        <div className="banner quiet">
          <p>Modo local: los cambios se guardan en la carpeta .datos-locales de este proyecto. En Vercel se guardan en el almacenamiento Blob.</p>
        </div>
      )}
      {editing && ops > OPS_INCLUDED * 0.8 && (
        <div className="banner warn">
          <p>Este mes ya se usaron {ops} de las {OPS_INCLUDED} operaciones de guardado incluidas gratis en Vercel. Si se superan, el almacenamiento queda bloqueado hasta el mes siguiente. Conviene editar en tandas más largas y guardar menos seguido.</p>
        </div>
      )}
    </div>
  );
}

function Toast() {
  const { notice } = useStore();
  return (
    <div className="toast-zone" aria-live="polite">
      {notice && (
        <p key={notice.at} className={`toast ${notice.tone}`}>
          {notice.message}
        </p>
      )}
    </div>
  );
}

export default function AppFrame({ children }) {
  const { phase, loadError, data, editing } = useStore();

  useEffect(() => {
    document.title = data?.thesis?.title ? `${data.thesis.title}` : 'Tablero de tesis';
  }, [data?.thesis?.title]);

  useEffect(() => {
    document.body.classList.toggle('editing', Boolean(editing));
  }, [editing]);

  if (phase === 'loading') {
    return (
      <div className="center-screen">
        <p className="muted">Cargando la tesis…</p>
      </div>
    );
  }
  if (phase === 'locked') {
    return (
      <div className="center-screen">
        <div className="locked-card">
          <h1>Tablero privado</h1>
          <p>Ingresá la contraseña para ver la tesis.</p>
          <LoginForm inline />
        </div>
      </div>
    );
  }
  if (phase === 'error') {
    return (
      <div className="center-screen">
        <div className="locked-card">
          <h1>No se pudo cargar la tesis</h1>
          <p>{loadError}</p>
          {/Blob/.test(loadError) && <p className="hint">En Vercel, abrí el proyecto, entrá en Storage, creá un almacenamiento Blob con acceso privado, conectalo a este proyecto y volvé a publicar.</p>}
          <button type="button" className="btn" onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }
  return (
    <>
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <TopBar />
      <Banners />
      <main id="contenido">{children}</main>
      <LoginDialog />
      <Toast />
    </>
  );
}
