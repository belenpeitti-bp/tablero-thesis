// Sesiones simples con cookie firmada.
// ADMIN_PASSWORD  -> contraseña para editar (obligatoria para poder editar).
// VIEWER_PASSWORD -> opcional: si existe, el sitio entero queda privado y esta contraseña permite solo leer.
import crypto from 'node:crypto';

export const COOKIE_NAME = 'tesis_sesion';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 días

function secret() {
  return process.env.SESSION_SECRET || `${process.env.ADMIN_PASSWORD || ''}::${process.env.VIEWER_PASSWORD || ''}::tablero-tesis`;
}

function sign(role) {
  return crypto.createHmac('sha256', secret()).update(`rol:${role}`).digest('base64url');
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function adminConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function siteLocked() {
  return Boolean(process.env.VIEWER_PASSWORD);
}

export function roleForPassword(password) {
  if (!password) return null;
  if (process.env.ADMIN_PASSWORD && safeEqual(password, process.env.ADMIN_PASSWORD)) return 'admin';
  if (process.env.VIEWER_PASSWORD && safeEqual(password, process.env.VIEWER_PASSWORD)) return 'viewer';
  return null;
}

export function getRole(request) {
  const value = request.cookies.get(COOKIE_NAME)?.value;
  if (!value) return null;
  const [role, sig] = value.split('.');
  if (role !== 'admin' && role !== 'viewer') return null;
  if (!sig || !safeEqual(sig, sign(role))) return null;
  if (role === 'admin' && !adminConfigured()) return null;
  return role;
}

export function setSessionCookie(response, role) {
  response.cookies.set(COOKIE_NAME, `${role}.${sign(role)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export function clearSessionCookie(response) {
  response.cookies.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export const canView = (role) => !siteLocked() || Boolean(role);
// Archivos y textos completos de los capítulos: la autora siempre; los lectores solo si el sitio es privado.
export const canReadFiles = (role) => role === 'admin' || (siteLocked() && role === 'viewer');
export const isAdmin = (role) => role === 'admin';
