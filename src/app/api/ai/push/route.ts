// src/app/api/ai/push/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ssePublish } from '@/lib/bus';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-nexroom-callback-secret') || '';
  if (secret !== process.env.NEXROOM_CALLBACK_SECRET) {
    return NextResponse.json({ ok: false, error: 'bad_secret' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const sessionId = String(body?.session_id || '');

  if (!sessionId) {
    return NextResponse.json({ ok: false, error: 'missing_session_id' }, { status: 400 });
  }

  // payload = {message, actions?, kind?, data? ...} ตามที่ n8n ส่งมา
  ssePublish(sessionId, body);

  return NextResponse.json({ ok: true });
}