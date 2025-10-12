import { NextRequest, NextResponse } from 'next/server';
import { agentHandle } from '../../../server/ai/agent';  // ✅ relative path ที่ถูกต้อง

export async function POST(req: NextRequest) {            // ✅ ต้อง export ชัดเจนแบบนี้
  const body = await req.json();
  try {
    const res = await agentHandle(body);
    return NextResponse.json({ ok: true, ...res });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message },
      { status: 500 }
    );
  }
}