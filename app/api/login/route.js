import { NextResponse } from 'next/server';
import { roleForPassword, setSessionCookie } from '@/lib/server/auth';

export async function POST(request) {
  let password = '';
  try {
    ({ password } = await request.json());
  } catch {}
  const role = roleForPassword(password);
  if (!role) {
    await new Promise((r) => setTimeout(r, 700)); // frena intentos repetidos
    return NextResponse.json({ error: 'La contraseña no es correcta.' }, { status: 401 });
  }
  const res = NextResponse.json({ role });
  setSessionCookie(res, role);
  return res;
}
