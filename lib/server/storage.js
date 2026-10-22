// Almacenamiento: Vercel Blob privado en producción; carpeta local (.datos-locales) en desarrollo.
import { promises as fs, createReadStream } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';

export const DATA_PATH = 'tesis/datos.json';
const LOCAL_DIR = path.join(process.cwd(), '.datos-locales');

export class ConflictError extends Error {
  constructor() {
    super('La versión guardada cambió desde que se cargó la página.');
    this.name = 'ConflictError';
  }
}

export function storageMode() {
  if (process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN) return 'blob';
  if (process.env.VERCEL) return 'missing';
  return 'local';
}

function assertConfigured() {
  if (storageMode() === 'missing') {
    const e = new Error('Falta conectar un almacenamiento Blob (privado) al proyecto en Vercel.');
    e.status = 503;
    throw e;
  }
}

export function safePathname(p) {
  if (typeof p !== 'string' || !p || p.length > 400) return null;
  if (p.includes('..') || p.startsWith('/') || p.includes('\\')) return null;
  return p;
}

const sha = (buf) => crypto.createHash('sha1').update(buf).digest('hex');
const localFile = (pathname) => path.join(LOCAL_DIR, pathname);

async function blob() {
  return import('@vercel/blob');
}

/** Lee un archivo de texto. Devuelve { text, etag } o null si no existe. */
export async function readText(pathname, { fresh = false } = {}) {
  assertConfigured();
  if (storageMode() === 'local') {
    try {
      const buf = await fs.readFile(localFile(pathname));
      return { text: buf.toString('utf8'), etag: sha(buf) };
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }
  const { get } = await blob();
  let res;
  try {
    res = await get(pathname, { access: 'private', useCache: !fresh });
  } catch (e) {
    if (e?.name === 'BlobNotFoundError') return null;
    throw e;
  }
  if (!res || res.statusCode !== 200) return null;
  const text = await new Response(res.stream).text();
  return { text, etag: res.blob.etag };
}

/** Escribe un archivo. Con ifMatch, falla con ConflictError si alguien guardó otra versión antes. */
export async function writeFile(pathname, body, { contentType, ifMatch, overwrite = true, randomSuffix = false, cacheSeconds } = {}) {
  assertConfigured();
  if (storageMode() === 'local') {
    let finalPath = pathname;
    if (randomSuffix) {
      const ext = path.extname(pathname);
      finalPath = `${pathname.slice(0, pathname.length - ext.length)}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    }
    const file = localFile(finalPath);
    await fs.mkdir(path.dirname(file), { recursive: true });
    if (ifMatch) {
      try {
        const current = await fs.readFile(file);
        if (sha(current) !== ifMatch) throw new ConflictError();
      } catch (e) {
        if (e instanceof ConflictError) throw e;
        if (e.code !== 'ENOENT') throw e;
      }
    }
    const buf = typeof body === 'string' ? Buffer.from(body, 'utf8') : Buffer.from(body instanceof ArrayBuffer ? body : await new Response(body).arrayBuffer());
    await fs.writeFile(file, buf);
    if (contentType) await fs.writeFile(`${file}.tipo`, contentType);
    return { pathname: finalPath, etag: sha(buf) };
  }
  const { put, BlobPreconditionFailedError } = await blob();
  try {
    const res = await put(pathname, body, {
      access: 'private',
      allowOverwrite: overwrite,
      addRandomSuffix: randomSuffix,
      contentType,
      ifMatch: ifMatch || undefined,
      ...(cacheSeconds ? { cacheControlMaxAge: cacheSeconds } : {}),
    });
    return { pathname: res.pathname, etag: res.etag };
  } catch (e) {
    if (e instanceof BlobPreconditionFailedError || e?.name === 'BlobPreconditionFailedError') throw new ConflictError();
    throw e;
  }
}

export async function deleteFile(pathname) {
  assertConfigured();
  if (storageMode() === 'local') {
    await fs.rm(localFile(pathname), { force: true });
    await fs.rm(`${localFile(pathname)}.tipo`, { force: true });
    return;
  }
  const { del } = await blob();
  try {
    await del(pathname);
  } catch (e) {
    if (e?.name !== 'BlobNotFoundError') throw e;
  }
}

/** Devuelve { stream, contentType, size } para enviar un archivo al navegador. */
export async function openFile(pathname) {
  assertConfigured();
  if (storageMode() === 'local') {
    const file = localFile(pathname);
    try {
      const st = await fs.stat(file);
      let contentType = 'application/octet-stream';
      try {
        contentType = (await fs.readFile(`${file}.tipo`, 'utf8')) || contentType;
      } catch {}
      return { stream: Readable.toWeb(createReadStream(file)), contentType, size: st.size };
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }
  const { get } = await blob();
  let res;
  try {
    res = await get(pathname, { access: 'private' });
  } catch (e) {
    if (e?.name === 'BlobNotFoundError') return null;
    throw e;
  }
  if (!res || res.statusCode !== 200) return null;
  return { stream: res.stream, contentType: res.blob.contentType, size: res.blob.size };
}

/** Enlace temporal de descarga directa (evita el límite de 4,5 MB de las funciones). */
export async function presignedDownload(pathname, minutes = 10) {
  if (storageMode() !== 'blob') return null;
  const { issueSignedToken, presignUrl } = await blob();
  const validUntil = Date.now() + minutes * 60 * 1000;
  const token = await issueSignedToken({ pathname, operations: ['get'], validUntil });
  const { presignedUrl } = await presignUrl(token, { operation: 'get', pathname, access: 'private', validUntil });
  return presignedUrl;
}
