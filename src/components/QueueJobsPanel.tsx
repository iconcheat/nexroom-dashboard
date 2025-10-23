// components/QueueJobsPanel.tsx
'use client';
import { useEffect, useState } from 'react';

type Job = {
  job_id: string;
  title: string | null;
  status: string;
  progress: number | null;
  result_url: string | null;
  result_meta?: any;
  created_at: string;
  finished_at: string | null;
};

export default function QueueJobsPanel({ className = '' }: { className?: string }) {
  const [items, setItems] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/queue/latest?limit=10', { cache: 'no-store' });
      const j = await r.json();
      setItems(Array.isArray(j?.data) ? j.data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30000); // refresh ทุก 30s พอ
    return () => clearInterval(t);
  }, []);

  return (
    <div className={`nxr-queue ${className}`}>
      {loading && <div className="hint">กำลังโหลด…</div>}
      <ul className="list">
        {items.slice(0, 5).map((it) => {
          const fn = it?.result_meta?.file_name || '';
          return (
            <li key={it.job_id} className={`row s-${it.status}`}>
              <div className="t">
                <div className="title">{it.title || '—'}</div>
                <div className="sub">
                  <span className="badge">{it.status}</span>
                  {typeof it.progress === 'number' && (
                    <span className="progress">{it.progress}%</span>
                  )}
                </div>
              </div>
              <div className="actions">
                {it.result_url && (
                  <a className="btn" href={it.result_url} target="_blank" rel="noreferrer">
                    ดาวน์โหลด {fn ? `(${fn})` : ''}
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {/* สกรอลล์ได้ 10 แถว (ถ้าจะโชว์ทั้งหมด) */}
      <details className="more">
        <summary>ดูทั้งหมด</summary>
        <ul className="list scroll">
          {items.map((it) => {
            const fn = it?.result_meta?.file_name || '';
            return (
              <li key={it.job_id} className={`row s-${it.status}`}>
                <div className="t">
                  <div className="title">{it.title || '—'}</div>
                  <div className="sub">
                    <span className="badge">{it.status}</span>
                    {typeof it.progress === 'number' && (
                      <span className="progress">{it.progress}%</span>
                    )}
                  </div>
                </div>
                <div className="actions">
                  {it.result_url && (
                    <a className="btn" href={it.result_url} target="_blank" rel="noreferrer">
                      ดาวน์โหลด {fn ? `(${fn})` : ''}
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </details>

      <style jsx>{`
        .nxr-queue .list { display: flex; flex-direction: column; gap: 8px; }
        .nxr-queue .row {
          display: grid; grid-template-columns: 1fr auto; gap: 10px;
          padding: 10px 12px; border: 1px solid rgba(255,255,255,.1);
          background: rgba(30,30,48,.45);
          border-radius: 12px;
        }
        .nxr-queue .row .title { font-weight: 700; color: #fff; }
        .nxr-queue .row .sub { display: flex; gap: 8px; align-items: center; font-size: 12px; opacity: .85; }
        .nxr-queue .badge {
          padding: 2px 8px; border-radius: 999px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12);
          text-transform: uppercase; letter-spacing: .3px;
        }
        .nxr-queue .progress { opacity: .8; }
        .nxr-queue .actions .btn {
          font-weight: 700; font-size: 12px; padding: 6px 10px; border-radius: 10px;
          background: linear-gradient(100deg,#7aafff,#6af0c6);
          color: #0b1020; text-decoration: none;
        }
        /* สีสถานะ */
        .nxr-queue .row.s-done   { border-color: rgba(33,208,122,.35); }
        .nxr-queue .row.s-failed { border-color: rgba(255,120,120,.35); }
        .nxr-queue .row.s-running{ border-color: rgba(255,176,32,.35); }

        /* แสดง 5 แถวแรกพอดีบล็อก */
        .nxr-queue.rows-5 .list { max-height: 5 * 52px; } /* ใช้ประมาณการสูงต่อแถว */
        .nxr-queue .more { margin-top: 8px; }
        .nxr-queue .more .list.scroll {
          max-height: 260px; overflow: auto; padding-right: 4px;
        }
      `}</style>
    </div>
  );
}