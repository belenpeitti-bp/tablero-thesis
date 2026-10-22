// Detección de actores con Claude (opcional: requiere ANTHROPIC_API_KEY en Vercel).
import { NextResponse } from 'next/server';
import { getRole, isAdmin } from '@/lib/server/auth';
import { readText } from '@/lib/server/storage';
import { isChapterId } from '@/lib/defaultData';
import { countMentions, stripReferenceSection } from '@/lib/actors';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const MAX_CHARS = 450_000;
const TYPES = ['persona', 'institución', 'organización', 'grupo', 'lugar', 'otro'];

const schema = {
  type: 'object',
  properties: {
    actors: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: TYPES },
          variants: { type: 'array', items: { type: 'string' } },
          role: { type: 'string' },
        },
        required: ['name', 'type', 'variants', 'role'],
        additionalProperties: false,
      },
    },
  },
  required: ['actors'],
  additionalProperties: false,
};

const instructions = `Vas a leer un capítulo de una tesis doctoral en historia, escrita en castellano.
Identificá los principales actores históricos que intervienen en el relato: personas, instituciones, organizaciones, corporaciones, partidos, publicaciones que actúan como actores (por ejemplo, un diario que toma posición), y grupos o colectivos con nombre propio.

Excluí:
- historiadores, autores e investigadores que aparecen solo como bibliografía o en discusiones historiográficas;
- archivos, repositorios y documentos citados solo como fuente;
- lugares que funcionan solo como escenario geográfico (incluilos únicamente si actúan como actor político, por ejemplo una provincia como parte en un conflicto).

Para cada actor devolvé:
- name: la forma completa más reconocible;
- type: persona, institución, organización, grupo, lugar u otro;
- variants: todas las formas literales en que aparece escrito en el texto, copiadas exactamente como están (incluí también la forma completa si aparece así);
- role: una frase breve sobre su papel en este capítulo.

Devolvé como máximo 60 actores, del más al menos importante para el capítulo.`;

export async function POST(request) {
  if (!isAdmin(getRole(request))) return NextResponse.json({ error: 'Tenés que ingresar para usar esta función.' }, { status: 401 });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Falta configurar ANTHROPIC_API_KEY en Vercel.' }, { status: 400 });
  let chapter;
  try {
    ({ chapter } = await request.json());
  } catch {}
  if (!isChapterId(chapter)) return NextResponse.json({ error: 'Capítulo inválido.' }, { status: 400 });

  try {
    const stored = await readText(`textos/${chapter}.txt`, { fresh: true });
    if (!stored?.text) return NextResponse.json({ error: 'Primero subí el archivo del capítulo.' }, { status: 404 });
    const text = stripReferenceSection(stored.text).slice(0, MAX_CHARS);

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        messages: [{ role: 'user', content: `${instructions}\n\n<capitulo>\n${text}\n</capitulo>` }],
        output_config: { format: { type: 'json_schema', schema } },
      }),
    });
    const payload = await resp.json().catch(() => null);
    if (!resp.ok) {
      const msg = payload?.error?.message || `La API respondió ${resp.status}`;
      return NextResponse.json({ error: `No se pudo usar la IA: ${msg}` }, { status: 502 });
    }
    if (payload?.stop_reason === 'refusal') return NextResponse.json({ error: 'La IA no procesó este texto.' }, { status: 502 });
    const block = (payload?.content || []).find((b) => b.type === 'text');
    let parsed;
    try {
      parsed = JSON.parse(block?.text || '');
    } catch {
      return NextResponse.json({ error: 'La respuesta de la IA llegó incompleta. Probá de nuevo.' }, { status: 502 });
    }

    const items = (parsed.actors || [])
      .filter((a) => a && typeof a.name === 'string' && a.name.trim())
      .map((a) => {
        const variants = [...new Set([a.name, ...(a.variants || [])].map((v) => String(v).trim()).filter(Boolean))];
        return {
          name: a.name.trim(),
          type: TYPES.includes(a.type) ? a.type : 'otro',
          role: String(a.role || '').slice(0, 300),
          variants: variants.filter((v) => v !== a.name.trim()),
          count: countMentions(text, variants),
        };
      })
      .filter((a) => a.count > 0)
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({ items, model: MODEL });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message || 'Error inesperado' }, { status: e.status || 500 });
  }
}
