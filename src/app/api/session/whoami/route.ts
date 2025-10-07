import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET() {
  const jar = await cookies();
  const sid = jar.get('nxr_session')?.value || null;
  if (!sid) return NextResponse.json({ ok: false, sid: null });

  const c = await pool.connect();
  const q = await c.query(
    `select ss.staff_id, ss.dorm_id, su.username, d.name as dorm_name
     from app.staff_sessions ss
     join app.staff_users su on su.staff_id = ss.staff_id
     left join app.dorms d on d.dorm_id = ss.dorm_id
     where ss.session_id = $1 and ss.is_valid = true and ss.expires_at > now() limit 1`,
    [sid],
  );
  c.release();
  if (q.rowCount === 0) return NextResponse.json({ ok: false, sid });

  return NextResponse.json({ ok: true, sid, user: q.rows[0] });
}