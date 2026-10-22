import { NextResponse } from 'next/server';
import { roleForPassword, setSessionCookie, adminConfigured } from '@/lib/server/auth';

export async function POST(request) {
  let password = '';
  try {
    ({ password } = await request.json());
  } catch {}
  const role = roleForPassword(password);
  if (!role) {
    await new Promise((r) => setTimeout(r, 700)); // frena intentos repetidos
    const message = adminConfigured() ? 'La contraseña no es correcta.' : 'Todavía no se configuró ADMIN_PASSWORD en Vercel.';
    return NextResponse.json({ error: message }, { status: 401 });
  }
  const res = NextResponse.json({ role });
  setSessionCookie(res, role);
  return res;
}
