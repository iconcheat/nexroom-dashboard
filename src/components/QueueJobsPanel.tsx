// components/QueueJobsPanel.tsx
'use client';
import { useEffect, useMemo, useState } from 'react';

type Job = {
  job_id: string;
  job_type?: string | null;
  title?: string | null;
  status: string;
  progress: number | null;
  result_url: string | null;
  result_json?: any;
  payload?: any;
  room_id?: string | null;
  created_at: string;
  finished_at: string | null;
};

// dd/MM HH:mm (เพิ่มวันที่ตามที่ขอ)
function fmtTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mo} ${hh}:${mm}`;
}

function mapJobTitle(job: Job) {
  if (job?.title && job.title.trim()) return job.title.trim();
  const jt = (job?.job_type || '').toLowerCase();
  switch (jt) {
    case 'reserve':        return 'จองห้องพัก';
    case 'issue_receipt':  return 'ออกใบเสร็จ';
    case 'issue_invoice':  return 'ออกใบแจ้งหนี้';
    case 'export_pdf':     return 'ส่งออกไฟล์ PDF';
    default:               return jt || 'งานระบบ';
  }
}

export default function QueueJobsPanel({ className = '' }: { className?: string }) {
  const [items, setItems] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/queue/latest?limit=10', { cache: 'no-store' });
      const j = await r.json();
      const rows = Array.isArray(j?.items) ? j.items : (Array.isArray(j?.data) ? j.data : []);
      setItems(rows as Job[]);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000); // refresh ทุก 30s
    return () => clearInterval(t);
  }, []);

  const data = useMemo(() => items, [items]);

  return (
    <div className={`nxr-queue ${className}`}>
      <div className="header">🗂️ คิวงานล่าสุด</div>
      {loading && <div className="hint">กำลังโหลด…</div>}

      {/* list เดียว คุมความสูง = 3 แถว + overflow */}
      <ul className="list viewport3">
        {data.map((it) => {
          const title = mapJobTitle(it);
          const when  = fmtTime(it.finished_at || it.created_at);
          const room  = (it.room_id || '').trim(); // ได้มาจาก API แล้ว

          return (
            <li key={it.job_id} className={`row s-${it.status}`}>
              <div className="left">
                <div className="line1">
                  {room && <span className="room">ห้อง {room}</span>}
                  <span className="title" title={title}>{title}</span>
                </div>
                <div className="line2">
                  <span className="badge">{it.status}</span>
                  {typeof it.progress === 'number' && <span className="progress">{it.progress}%</span>}
                  <span className="time">{when}</span>
                </div>
              </div>
              <div className="actions">
                {it.result_url && (
                  <a className="btn" href={it.result_url} target="_blank" rel="noreferrer">
                    ดาวน์โหลด
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <style jsx>{`
        :root { --row-h: 54px; }

        .nxr-queue { display: flex; flex-direction: column; gap: 8px; max-width: 820px; margin: 0 auto; }
        .header { font-weight: 700; margin-bottom: 2px; }
        .hint { font-size: 12px; opacity: .8; }

        .list { display: flex; flex-direction: column; gap: 8px; }

        /* โชว์ 3 แถวเป๊ะ แล้วเลื่อนดูได้ */
        .viewport3 {
          height: calc(var(--row-h) * 3 + 16px); /* 3 แถว + ช่องว่างระหว่างแถว (2*8px) */
          overflow-y: auto;
          padding-right: 4px;
        }

        .row {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          min-height: var(--row-h);
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(30,30,48,.36);
          border-radius: 12px;
        }

        .left { min-width: 0; }
        .line1 { display: flex; align-items: center; gap: 8px; }
        .room {
          font-size: 12px; font-weight: 800; color: #ffb347;
          padding: 1px 8px; border-radius: 999px;
          background: rgba(255,180,71,.12); border: 1px solid rgba(255,180,71,.35);
        }
        .title {
          font-weight: 700; color: #fff; font-size: 13px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          max-width: 44vw;
        }
        .line2 { display: flex; gap: 8px; align-items: center; font-size: 11px; opacity: .9; }
        .badge {
          padding: 1px 8px; border-radius: 999px;
          background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12);
          text-transform: uppercase; letter-spacing: .3px;
        }
        .progress { opacity: .85; }
        .time { opacity: .78; }

        .actions { display: flex; align-items: center; }
        .btn {
          font-weight: 800; font-size: 12px; padding: 6px 10px; border-radius: 10px;
          background: linear-gradient(100deg,#ff7a18,#ffb347);
          color: #0b1020; text-decoration: none;
          transition: transform .12s ease, filter .12s ease;
        }
        .btn:hover { transform: translateY(-1px); filter: brightness(1.03); }

        /* เส้นขอบโทนส้มตามสถานะ */
        .row.s-done    { border-color: rgba(255,153,0,.35); }
        .row.s-failed  { border-color: rgba(255,120,120,.35); }
        .row.s-running { border-color: rgba(255,176,32,.45); }
      `}</style>
    </div>
  );
}
