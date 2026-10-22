// Copia el "worker" de pdf.js a /public para poder leer PDFs en el navegador.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
try {
  const pkgDir = path.dirname(require.resolve('pdfjs-dist/package.json'));
  const candidates = ['build/pdf.worker.min.mjs', 'build/pdf.worker.mjs'];
  const src = candidates.map((c) => path.join(pkgDir, c)).find((p) => existsSync(p));
  if (!src) throw new Error('No se encontró el worker de pdf.js');
  mkdirSync('public', { recursive: true });
  copyFileSync(src, path.join('public', 'pdf.worker.min.mjs'));
  console.log('pdf.js worker copiado a public/pdf.worker.min.mjs');
} catch (e) {
  console.warn('Aviso: no se pudo copiar el worker de pdf.js:', e.message);
}
