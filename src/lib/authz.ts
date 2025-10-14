import { NextRequest } from 'next/server';

export function assertBearer(req: NextRequest, envKey: string) {
  const want = process.env[envKey] || '';
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!want || got !== want) {
    const err: any = new Error('unauthorized');
    err.status = 401;
    throw err;
  }
}