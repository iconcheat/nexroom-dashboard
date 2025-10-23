// app/api/queue/latest/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { extractSessionId } from '@/lib/bus';

export async function GET(req: NextRequest) {
  const pool = getPool();

  try {
    const url = new URL(req.url);
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get('limit') || '10', 10), 1),
      50
    );

    // 1) หา dorm_id (ลำดับความสำคัญ: query -> cookie 'dorm_id' -> map จาก nxr_session)
    let dormId: string | null = url.searchParams.get('dorm_id');

    if (!dormId) {
      // ลองดึงจาก cookie raw (ไม่ใช้ cookies() เพื่อเลี่ยง await/เวอร์ชัน)
      const raw = req.headers.get('cookie') || '';
      const m = raw.match(/(?:^|;\s*)dorm_id=([^;]+)/);
      if (m?.[1]) dormId = decodeURIComponent(m[1]);
    }

    if (!dormId) {
      // ใช้ lib เดิม: extractSessionId เพื่ออ่าน nxr_session/session_id
      const sessionId = extractSessionId(req);
      if (sessionId) {
        const { rows } = await pool.query(
          `
          SELECT dorm_id
          FROM app.staff_sessions
          WHERE session_id = $1
            AND deleted_at IS NULL
            AND (expires_at IS NULL OR expires_at > now())
          ORDER BY created_at DESC
          LIMIT 1;
          `,
          [sessionId]
        );
        dormId = rows[0]?.dorm_id ?? null;
      }
    }

    if (!dormId) {
      return NextResponse.json({ ok: false, error: 'missing_dorm_id' }, { status: 400 });
    }

    // 2) ดึงคิวล่าสุดของหอ (done เท่านั้น)
    const { rows } = await pool.query(
      `
      SELECT
        job_id,
        dorm_id,
        job_type,
        status,
        progress,
        result_url,
        COALESCE(result_json, '{}'::jsonb) AS result_json,
        error_message,
        created_at,
        finished_at
      FROM app.queue_jobs
      WHERE dorm_id = $1
        AND status  = 'done'
      ORDER BY created_at DESC
      LIMIT $2;
      `,
      [dormId, limit]
    );

    return NextResponse.json({ ok: true, dorm_id: dormId, items: rows });
  } catch (err) {
    console.error('GET /api/queue/latest error:', err);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}