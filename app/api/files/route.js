// Subida por el servidor (desarrollo local, o respaldo si la subida directa no está disponible) y borrado.
import { NextResponse } from 'next/server';
import { getRole, isAdmin } from '@/lib/server/auth';
import { writeFile, deleteFile, safePathname } from '@/lib/server/storage';
import { isChapterId } from '@/lib/defaultData';

export const dynamic = 'force-dynamic';

function safeName(name) {
  return String(name || 'archivo')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(-90);
}

export async function POST(request) {
  if (!isAdmin(getRole(request))) return NextResponse.json({ error: 'Tenés que ingresar para subir archivos.' }, { status: 401 });
  try {
    const form = await request.formData();
    const file = form.get('file');
    const chapter = String(form.get('chapter') || '');
    if (!file || typeof file === 'string') return NextResponse.json({ error: 'No llegó ningún archivo.' }, { status: 400 });
    if (!isChapterId(chapter)) return NextResponse.json({ error: 'Capítulo inválido.' }, { status: 400 });
    const saved = await writeFile(`capitulos/${chapter}/${safeName(file.name)}`, file, {
      contentType: file.type || 'application/octet-stream',
      overwrite: false,
      randomSuffix: true,
    });
    return NextResponse.json({ pathname: saved.pathname });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message || 'No se pudo guardar el archivo.' }, { status: e.status || 500 });
  }
}

export async function DELETE(request) {
  if (!isAdmin(getRole(request))) return NextResponse.json({ error: 'Tenés que ingresar para borrar archivos.' }, { status: 401 });
  const pathname = safePathname(request.nextUrl.searchParams.get('pathname'));
  if (!pathname || !pathname.startsWith('capitulos/')) return NextResponse.json({ error: 'Ruta inválida.' }, { status: 400 });
  try {
    await deleteFile(pathname);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message || 'No se pudo borrar.' }, { status: e.status || 500 });
  }
}
