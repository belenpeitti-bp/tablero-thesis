import { NextResponse } from 'next/server';
import { getRole, siteLocked, adminConfigured, canReadFiles } from '@/lib/server/auth';
import { storageMode } from '@/lib/server/storage';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const role = getRole(request);
  return NextResponse.json({
    role,
    locked: siteLocked(),
    adminConfigured: adminConfigured(),
    canReadFiles: canReadFiles(role),
    storage: storageMode(),
    ai: Boolean(process.env.ANTHROPIC_API_KEY),
  });
}
