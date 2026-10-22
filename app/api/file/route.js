// Descarga de un capítulo subido.
import { NextResponse } from 'next/server';
import { getRole, canReadFiles } from '@/lib/server/auth';
import { openFile, presignedDownload, safePathname } from '@/lib/server/storage';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const role = getRole(request);
  if (!canReadFiles(role)) return new NextResponse('Necesitás ingresar para descargar los capítulos.', { status: 403 });
  const params = request.nextUrl.searchParams;
  const pathname = safePathname(params.get('pathname'));
  if (!pathname || !pathname.startsWith('capitulos/')) return new NextResponse('Ruta inválida.', { status: 400 });
  const name = (params.get('name') || pathname.split('/').pop()).replace(/["\r\n]/g, '');
  const size = Number(params.get('size') || 0);
  try {
    // Archivos grandes: enlace temporal directo al almacenamiento.
    if (size > 4 * 1024 * 1024) {
      try {
        const url = await presignedDownload(pathname);
        if (url) return NextResponse.redirect(url, 302);
      } catch (e) {
        console.error('No se pudo firmar la descarga; se intenta enviarla directamente', e);
      }
    }
    const file = await openFile(pathname);
    if (!file) return new NextResponse('No se encontró el archivo.', { status: 404 });
    return new NextResponse(file.stream, {
      headers: {
        'Content-Type': file.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error(e);
    return new NextResponse(e.message || 'Error al descargar.', { status: e.status || 500 });
  }
}
