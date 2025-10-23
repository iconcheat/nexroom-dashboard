// components/QueueJobsPanel.tsx
'use client';
import { useEffect, useState } from 'react';

type Job = {
  job_id: string;
  job_type?: string;
  title?: string | null;
  status: string;
  progress: number | null;
  result_url: string | null;
  result_meta?: any;
  created_at: string;
  finished_at: string | null;
};

function humanTitle(it: Job): string {
  const t = (it.job_type || '').toLowerCase();
  const fn = it?.result_meta?.file_name || '';
  switch (t) {
    case 'issue_receipt':
      return fn ? `ออกใบเสร็จ: ${fn}` : 'ออกใบเสร็จ';
    case 'invoice':
      return fn ? `ออกใบแจ้งหนี้: ${fn}` : 'ออกใบแจ้งหนี้';
    case 'export_pdf':
      return fn ? `สร้างไฟล์ PDF: ${fn}` : 'สร้างไฟล์ PDF';
    case 'reserve':
      return 'จองห้องพัก';
    default:
      return t || 'งานระบบ';
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
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const renderRow = (it: Job) => {
    const fn = it?.result_meta?.file_name || '';
    const title = it.title ?? humanTitle(it);
    return (
      <li key={it.job_id} className={`row s-${(it.status || '').toLowerCase()}`}>
        <div className="t">
          <div className="title">{title}</div>
          <div className="sub">
            <span className="badge">{(it.status || '').toUpperCase()}</span>
            {typeof it.progress === 'number' && <span className="progress">{it.progress}%</span>}
          </div>
        </div>
        <div className="actions">
          {it.result_url && (
            <a className="btn" href={it.result_url} target="_blank" rel="noreferrer">
              ดาวน์โหลด{fn ? ` (${fn})` : ''}
            </a>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className={`nxr-queue ${className}`}>
      {loading && <div className="hint">กำลังโหลด…</div>}

      <ul className="list">
        {items.slice(0, 5).map(renderRow)}
      </ul>

      {/* สกรอลล์ได้ 10 แถว (ถ้าจะโชว์ทั้งหมด) */}
      <details className="more">
        <summary>ดูทั้งหมด</summary>
        <ul className="list scroll">
          {items.map(renderRow)}
        </ul>
      </details>

      <style jsx>{`
        .nxr-queue .list { display: flex; flex-direction: column; gap: 6px; }
        .nxr-queue .row {
          display: grid; grid-template-columns: 1fr auto; gap: 8px;
          padding: 8px 10px; border: 1px solid rgba(255,255,255,.1);
          background: rgba(30,30,48,.45); border-radius: 10px;
        }
        .nxr-queue .row .title { font-weight: 700; color: #fff; font-size: 13px; }
        .nxr-queue .row .sub { display: flex; gap: 8px; align-items: center; font-size: 11px; opacity: .85; }
        .nxr-queue .badge {
          padding: 1px 6px; border-radius: 999px; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12);
          letter-spacing: .3px; font-size: 10px;
        }
        .nxr-queue .progress { opacity: .85; font-size: 11px; }
        .nxr-queue .actions .btn {
          font-weight: 700; font-size: 11px; padding: 5px 9px; border-radius: 8px;
          background: linear-gradient(100deg,#7aafff,#6af0c6);
          color: #0b1020; text-decoration: none;
        }
        /* สีสถานะ */
        .nxr-queue .row.s-done    { border-color: rgba(33,208,122,.35); }
        .nxr-queue .row.s-failed  { border-color: rgba(255,120,120,.35); }
        .nxr-queue .row.s-running { border-color: rgba(255,176,32,.35); }

        /* ความสูงต่อแถว ~44px → 5 แถวพอดี */
        .nxr-queue.rows-5 .list { max-height: calc(44px * 5); overflow: hidden; }

        .nxr-queue .more { margin-top: 6px; }
        .nxr-queue .more .list.scroll { max-height: 220px; overflow: auto; padding-right: 4px; }
      `}</style>
    </div>
  );
}
