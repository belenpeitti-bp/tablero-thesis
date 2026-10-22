import { NextResponse } from 'next/server';
import { getRole, canView, isAdmin } from '@/lib/server/auth';
import { readText, writeFile, DATA_PATH, ConflictError } from '@/lib/server/storage';

export const dynamic = 'force-dynamic';

const BACKUP_EVERY_MS = 12 * 60 * 60 * 1000;
const noStore = { 'Cache-Control': 'private, no-store' };

function errorResponse(e) {
  console.error(e);
  return NextResponse.json({ error: e.message || 'Error inesperado' }, { status: e.status || 500, headers: noStore });
}

export async function GET(request) {
  const role = getRole(request);
  if (!canView(role)) return NextResponse.json({ error: 'Necesitás ingresar con la contraseña.' }, { status: 401, headers: noStore });
  try {
    const fresh = isAdmin(role) && request.nextUrl.searchParams.get('fresh') === '1';
    const res = await readText(DATA_PATH, { fresh });
    if (!res) return NextResponse.json({ data: null, etag: null }, { headers: noStore });
    return NextResponse.json({ data: JSON.parse(res.text), etag: res.etag }, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(request) {
  const role = getRole(request);
  if (!isAdmin(role)) return NextResponse.json({ error: 'Tu sesión de edición venció. Volvé a ingresar.' }, { status: 401, headers: noStore });
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Los datos enviados no son válidos.' }, { status: 400, headers: noStore });
  }
  const data = body?.data;
  if (!data || typeof data !== 'object' || !Array.isArray(data.chapters)) {
    return NextResponse.json({ error: 'Los datos enviados no tienen la estructura de la tesis.' }, { status: 400, headers: noStore });
  }
  try {
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    const prevOps = data.meta?.ops?.month === month ? Number(data.meta.ops.count) || 0 : 0;
    const extraOps = Math.max(0, Math.min(20, Number(body.extraOps) || 0));
    const lastBackup = data.meta?.lastBackupAt ? Date.parse(data.meta.lastBackupAt) : 0;
    const needsBackup = !lastBackup || now.getTime() - lastBackup > BACKUP_EVERY_MS;
    const meta = {
      ...(data.meta || {}),
      updatedAt: now.toISOString(),
      ops: { month, count: prevOps + 1 + extraOps + (needsBackup ? 1 : 0) },
      lastBackupAt: needsBackup ? now.toISOString() : data.meta?.lastBackupAt || null,
    };
    const json = JSON.stringify({ ...data, meta });
    const saved = await writeFile(DATA_PATH, json, {
      contentType: 'application/json; charset=utf-8',
      ifMatch: body.force ? undefined : body.etag || undefined,
      overwrite: true,
      cacheSeconds: 60,
    });
    if (needsBackup) {
      const stamp = now.toISOString().replace(/[:.]/g, '-');
      try {
        await writeFile(`respaldos/datos-${stamp}.json`, json, { contentType: 'application/json; charset=utf-8', overwrite: false });
      } catch (e) {
        console.error('No se pudo guardar el respaldo', e);
      }
    }
    return NextResponse.json({ etag: saved.etag, meta }, { headers: noStore });
  } catch (e) {
    if (e instanceof ConflictError) {
      return NextResponse.json({ error: e.message, conflict: true }, { status: 409, headers: noStore });
    }
    return errorResponse(e);
  }
}
