'use client';
// Extrae el texto de un capítulo en el navegador (.docx, .pdf, .txt, .md).
import { cleanText } from './actors';

export const ACCEPTED = '.docx,.pdf,.txt,.md';

export function contentTypeFor(name) {
  const ext = name.split('.').pop().toLowerCase();
  return (
    {
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pdf: 'application/pdf',
      txt: 'text/plain',
      md: 'text/markdown',
    }[ext] || 'application/octet-stream'
  );
}

export async function extractText(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'txt' || ext === 'md') return cleanText(await file.text());
  if (ext === 'docx') return cleanText(await docxText(file));
  if (ext === 'pdf') return cleanText(await pdfText(file));
  if (ext === 'doc' || ext === 'odt' || ext === 'rtf' || ext === 'pages') {
    throw new Error('Ese formato no se puede leer. Guardá el capítulo como .docx o .pdf y volvé a subirlo.');
  }
  throw new Error('Formato no admitido. Usá .docx, .pdf o .txt.');
}

async function docxText(file) {
  const mod = await import('mammoth');
  const mammoth = mod.default || mod;
  const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return value;
}

async function pdfText(file) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let line = '';
    const lines = [];
    for (const item of content.items) {
      if (typeof item.str !== 'string') continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line);
        line = '';
      } else if (item.str && !item.str.endsWith(' ')) {
        line += ' ';
      }
    }
    if (line.trim()) lines.push(line);
    pages.push(lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean));
  }
  // Quita encabezados y pies de página que se repiten en muchas páginas.
  const norm = (l) => l.replace(/\d+/g, '#').toLowerCase();
  const freq = new Map();
  for (const lines of pages) {
    for (const l of new Set(lines.map(norm))) freq.set(l, (freq.get(l) || 0) + 1);
  }
  const minPages = Math.max(3, Math.ceil(pages.length * 0.3));
  const isRunning = (l) => l.length < 120 && (freq.get(norm(l)) || 0) >= minPages;
  const isPageNumber = (l) => /^[\divxlc\s.\-–—]{1,8}$/i.test(l);
  return pages.map((lines) => lines.filter((l) => !isRunning(l) && !isPageNumber(l)).join('\n')).join('\n\n');
}
