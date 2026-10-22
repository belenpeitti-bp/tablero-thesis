'use client';
import Link from 'next/link';
import { useStore } from './StoreProvider';
import { shortLabel } from '@/lib/format';

function level(n, max) {
  if (!n) return 0;
  if (max <= 1) return 3;
  const r = Math.log(n + 1) / Math.log(max + 1);
  return r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1;
}

/** Tira con una celda por parte de la tesis: muestra dónde aparece un actor y con qué intensidad. */
export function PresenceStrip({ actor, current, max, linkTo = true }) {
  const { data } = useStore();
  const label = actor.chapters
    .map((id) => {
      const ch = data.chapters.find((c) => c.id === id);
      return ch ? `${shortLabel(ch)}: ${actor.counts[id]}` : '';
    })
    .filter(Boolean)
    .join(', ');
  return (
    <span className="strip" role="img" aria-label={`Aparece en ${label}`}>
      {data.chapters.map((ch) => {
        const n = actor.counts[ch.id] || 0;
        const cls = `cell l${level(n, max)}${ch.id === current ? ' current' : ''}`;
        const title = `${ch.label}: ${n ? `${n} ${n === 1 ? 'mención' : 'menciones'}` : 'no aparece'}`;
        if (linkTo && n && ch.id !== current) {
          return <Link key={ch.id} href={`/#${ch.id}`} className={cls} title={title} aria-hidden="true" tabIndex={-1} />;
        }
        return <span key={ch.id} className={cls} title={title} aria-hidden="true" />;
      })}
    </span>
  );
}
