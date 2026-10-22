// Genera el permiso para que el navegador suba el archivo del capítulo directo a Vercel Blob (sin límite de 4,5 MB).
import { NextResponse } from 'next/server';
import { handleUpload } from '@vercel/blob/client';
import { getRole, isAdmin } from '@/lib/server/auth';

export async function POST(request) {
  const role = getRole(request);
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 });
  }
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!isAdmin(role)) throw new Error('Tenés que ingresar para subir archivos.');
        if (!pathname.startsWith('capitulos/') || pathname.includes('..')) throw new Error('Ruta de archivo no permitida.');
        return {
          allowedContentTypes: [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/pdf',
            'text/plain',
            'text/markdown',
            'application/octet-stream',
          ],
          addRandomSuffix: true,
          maximumSizeInBytes: 200 * 1024 * 1024,
        };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
