// pages/api/ai/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

const N8N_URL = process.env.NEXT_PUBLIC_N8N_AI_CHAT_URL!;
const SECRET  = process.env.N8N_SIGNING_SECRET!;
const ORIGIN  = process.env.NEXT_PUBLIC_DASHBOARD_ORIGIN || 'https://nexroom-dashboard.onrender.com';

// stringify แบบเรียง key (เหมือนใน n8n node “prepare body string”)
function stableStringify(obj:any){
  const keys = new Set<string>(); JSON.stringify(obj, (k,v)=>{ keys.add(k); return v; });
  return JSON.stringify(obj, Array.from(keys).sort());
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body || {};
  const raw = stableStringify(body);
  const sig = crypto.createHmac('sha256', SECRET).update(raw).digest('hex');

  try {
    const r = await fetch(N8N_URL, {
      method:'POST',
      headers:{
        'content-type':'application/json',
        'x-nexroom-signature': sig,
        'x-nexroom-client': 'dashboard',
        'origin': ORIGIN,
      },
      body: raw
    });
    const text = await r.text();
    let data:any = null;
    try { data = JSON.parse(text); } catch { data = { reply: text }; }

    return res.status(r.status).json(data);
  } catch (err:any) {
    console.error('[api/ai/chat] error', err);
    return res.status(500).json({ ok:false, error: err.message });
  }
}