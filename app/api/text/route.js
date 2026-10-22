// Texto extraído de cada capítulo (sirve para buscar nombres y para volver a analizar actores).
import { NextResponse } from 'next/server';
import { getRole, canReadFiles, isAdmin } from '@/lib/server/auth';
import { readText, writeFile, deleteFile } from '@/lib/server/storage';
import { isChapterId } from '@/lib/defaultData';

export const dynamic = 'force-dynamic';
const textPath = (id) => `textos/${id}.txt`;

export async function GET(request) {
  const role = getRole(request);
  if (!canReadFiles(role)) return NextResponse.json({ error: 'Necesitás ingresar para leer los textos.' }, { status: 403 });
  const id = request.nextUrl.searchParams.get('chapter');
  if (!isChapterId(id)) return NextResponse.json({ error: 'Capítulo inválido.' }, { status: 400 });
  try {
    const res = await readText(textPath(id), { fresh: true });
    if (!res) return NextResponse.json({ error: 'Este capítulo todavía no tiene texto cargado.' }, { status: 404 });
    return new NextResponse(res.text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

export async function PUT(request) {
  if (!isAdmin(getRole(request))) return NextResponse.json({ error: 'Tenés que ingresar para guardar.' }, { status: 401 });
  const id = request.nextUrl.searchParams.get('chapter');
  if (!isChapterId(id)) return NextResponse.json({ error: 'Capítulo inválido.' }, { status: 400 });
  try {
    const text = await request.text();
    await writeFile(textPath(id), text, { contentType: 'text/plain; charset=utf-8', overwrite: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}

export async function DELETE(request) {
  if (!isAdmin(getRole(request))) return NextResponse.json({ error: 'Tenés que ingresar para borrar.' }, { status: 401 });
  const id = request.nextUrl.searchParams.get('chapter');
  if (!isChapterId(id)) return NextResponse.json({ error: 'Capítulo inválido.' }, { status: 400 });
  try {
    await deleteFile(textPath(id));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500 });
  }
}
