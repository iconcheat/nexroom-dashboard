// src/app/dashboard/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

type Summary = {
  totalRooms: number;
  occupied: number;
  vacant: number;
  repairing: number;
  unpaidBills: number;
  maintenanceOpen: number;
};

type Dorm = { id: string; name: string };

type AiResult = {
  room: string;
  period: string;
  amount: number;
  status: string;
};

type DashboardApi =
  | { ok: true; summary: Summary; timestamp: string; dorm?: Dorm }
  | { ok: false; error: string };

type Action = {
  type: 'open_url';
  label: string;
  url: string;
};

type AiApi =
  | {
      ok: true;
      reply?: string;
      logs?: string[];
      results?: AiResult[];
      actions?: Action[];   // <-- เพิ่มบรรทัดนี้
      meta?: any;
    }
  | { ok: false; error: string };

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [ts, setTs] = useState<string>('');
  const [dorm, setDorm] = useState<Dorm | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [userInput, setUserInput] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<AiResult[]>([]);
  const [actions, setActions] = useState<Action[]>([]);

  // ------------------ โหลดข้อมูลจาก /api/dashboard ------------------
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/dashboard', { cache: 'no-store' });
        const data: DashboardApi = await res.json();

        if (!alive) return;

        if ('ok' in data && data.ok) {
          setSummary(data.summary);
          setTs(data.timestamp);
          setDorm(data.dorm ?? null);
          setLoadErr(null);
        } else {
          setLoadErr((data as any)?.error || `HTTP ${res.status}`);
        }
      } catch (e: any) {
        setLoadErr(e?.message || 'fetch_failed');
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ------------------ ส่งคำสั่งไปยัง n8n ผ่าน /api/ai ------------------
  const handleAskAI = async () => {
  const q = userInput.trim();
  if (!q) return;

  setLogs((prev) => [...prev, `🧠 User: ${q}`]);
  setAiReply('⌛ กำลังประมวลผล...');
  setResults([]);
  setActions([]);             // <-- เคลียร์ปุ่มก่อนยิง
  setUserInput('');

  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // ❌ ไม่ต้องส่ง context ปลอมแล้ว ให้ส่งเฉพาะ message
      body: JSON.stringify({ message: q }),
    });

    const data: AiApi = await res.json();

    if ('ok' in data && data.ok) {
      setAiReply(data.reply || '✅ สำเร็จ');

      if (Array.isArray(data.logs)) {
        setLogs((prev) => [...prev, ...data.logs]);
      }

      if (Array.isArray((data as any).results)) {
        const safe: AiResult[] = (data as any).results.map((r: any) => ({
          room: String(r?.room ?? ''),
          period: String(r?.period ?? ''),
          amount: Number(r?.amount ?? 0),
          status: String(r?.status ?? 'unknown').toLowerCase(),
        }));
        setResults(safe);
      }

      if (Array.isArray((data as any).actions)) {
        setActions((data as any).actions as Action[]);  // <-- เก็บปุ่มจาก n8n
      }
    } else {
      const msg = (data as any)?.error || res.statusText || 'unknown_error';
      setAiReply('❌ เกิดข้อผิดพลาด');
      setLogs((prev) => [...prev, `ERROR: ${msg}`]);
    }
  } catch (e: any) {
    setAiReply('❌ เชื่อมต่อไม่ได้');
    setLogs((prev) => [...prev, `ERROR: ${e?.message || e}`]);
  }
};

  // ------------------ เวลาที่อัปเดต ------------------
  const updatedText = useMemo(() => {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString('th-TH');
    } catch {
      return ts;
    }
  }, [ts]);

  // ------------------ ส่วนแสดงผล ------------------
  return (
    <main className="min-h-screen text-white relative overflow-hidden">
      {/* Background layers */}
      <div className="bg-stars" />
      <div className="grid-overlay" />
      <div className="scanline" />
      <div className="aurora" />

      {/* HEADER */}
      <div className="max-w-7xl mx-auto px-6 pt-10">
        <div className="flex flex-col gap-1 text-center md:text-left">
          <h1 className="font-orbitron text-4xl md:text-6xl tracking-[.08em] drop-shadow-[0_0_25px_rgba(0,245,255,.4)]">
            {dorm?.name ?? '—'}
          </h1>
          <h2 className="title flex items-baseline gap-2 justify-center md:justify-start text-white/90">
            <span>NEX</span>
            <span className="neon-teal">Room</span>
            <span className="text-white/60 text-base md:text-lg tracking-widest">
              • SMART DORM AI CONTROL CENTER
            </span>
          </h2>
        </div>
        <div className="beam" />
      </div>

      {/* CONTENT */}
      <section className="max-w-7xl mx-auto px-6 pb-20 pt-8 grid grid-cols-1 xl:grid-cols-3 gap-8 font-ui">
        {/* LEFT */}
        <div className="space-y-8 xl:col-span-2">
          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {loading ? (
              <Glass className="col-span-3 text-center text-white/70 py-6 animate-pulse">
                ⏳ กำลังโหลดข้อมูล...
              </Glass>
            ) : loadErr ? (
              <Glass className="col-span-3 text-center text-rose-300 py-6">
                ❌ {loadErr}
              </Glass>
            ) : summary ? (
              <>
                <StatCard label="TOTAL ROOMS" value={summary.totalRooms} accent="teal" />
                <StatCard label="OCCUPIED" value={summary.occupied} accent="emerald" />
                <StatCard label="VACANT" value={summary.vacant} accent="cyan" />
                <StatCard label="REPAIRING" value={summary.repairing} accent="amber" />
                <StatCard label="UNPAID BILLS" value={summary.unpaidBills} accent="magenta" />
                <StatCard label="MAINTENANCE OPEN" value={summary.maintenanceOpen} accent="violet" />
              </>
            ) : (
              <Glass className="col-span-3 text-center text-white/60 py-6">—</Glass>
            )}
          </div>

          {/* CHAT */}
          <Glass className="rounded-2xl">
            <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-white/90 font-semibold tracking-wider flex items-center gap-2">
                <span className="dot dot-pulse" /> AI CHAT ASSISTANT
              </h3>
              <span className="badge">LIVE</span>
            </div>
            <div className="p-5 space-y-4">
              <textarea
                rows={3}
                className="w-full rounded-md bg-white/5 border border-white/10 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/40 outline-none p-3 placeholder-white/40 font-ui"
                placeholder="พิมพ์เช่น: ขอดูอินวอยห้องทั้งหมด"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-white/60 tracking-wide">
                  เคล็ดลับ: ใช้รูปประโยค <b>กริยา + วัตถุ</b> เช่น “แสดงอินวอยเดือนนี้ของทุกห้อง”
                </p>
                <button onClick={handleAskAI} className="btn-neon">
                  ส่งคำสั่ง
                </button>
              </div>

              {aiReply && (
                <div className="rounded-md border border-cyan-300/30 bg-cyan-300/10 p-3 text-cyan-100 shadow-inner">
                  {aiReply}
                </div>
              )}
              <ActionButtons actions={actions} />
            </div>
          </Glass>
        </div>

        {/* RIGHT */}
        <div className="space-y-8">
          <Glass>
            <div className="px-5 py-3 border-b border-white/10">
              <h3 className="text-white/90 font-semibold tracking-wider">⚙️ AI ACTION MONITOR</h3>
            </div>
            <div className="p-5">
              <div className="max-h-56 overflow-y-auto space-y-1 text-sm tracking-wide">
                {logs.length === 0 ? (
                  <p className="text-white/60 text-center">ยังไม่มีการทำงาน</p>
                ) : (
                  logs.map((line, i) => (
                    <p key={i} className="text-white/85">
                      {line}
                    </p>
                  ))
                )}
              </div>
            </div>
          </Glass>

          <Glass>
            <div className="px-5 py-3 border-b border-white/10">
              <h3 className="text-white/90 font-semibold tracking-wider">📊 ACTION RESULT</h3>
            </div>
            <div className="p-5">
              {results.length === 0 ? (
                <p className="text-white/60 text-center">ยังไม่มีผลลัพธ์</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-white/70">
                        <Th>ROOM</Th>
                        <Th>PERIOD</Th>
                        <Th align="right">AMOUNT</Th>
                        <Th>STATUS</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => (
                        <tr key={i} className="hover:bg-white/5 transition">
                          <Td className="font-digits">{r.room}</Td>
                          <Td className="font-digits">{r.period}</Td>
                          <Td align="right" className="font-digits">
                            {Number(r.amount ?? 0).toLocaleString('th-TH')}
                          </Td>
                          <Td>
                            <span
                              className={
                                'px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide border ' +
                                (r.status === 'paid'
                                  ? 'bg-emerald-400/15 text-emerald-200 border-emerald-300/30'
                                  : 'bg-rose-400/15 text-rose-200 border-rose-300/30')
                              }
                            >
                              {r.status}
                            </span>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="px-5 pb-4">
              <p className="text-center text-[11px] text-white/50">⏱ Updated: {updatedText}</p>
            </div>
          </Glass>
        </div>
      </section>

      {/* BACKGROUND EFFECT STYLES */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Oxanium:wght@400;700&family=Rajdhani:wght@400;500;700&display=swap');

        :root {
          --bg: #070b12;
          --glass: rgba(255, 255, 255, 0.06);
          --stroke: rgba(255, 255, 255, 0.12);
          --neon-teal: #00f5ff;
          --neon-cyan: #5cf9ff;
        }
        .font-ui {
          font-family: 'Rajdhani', ui-sans-serif, system-ui;
        }
        .font-digits {
          font-family: 'Oxanium', monospace;
          letter-spacing: 0.3px;
        }
        .font-orbitron {
          font-family: 'Orbitron', sans-serif;
        }
        .neon-teal {
          color: var(--neon-teal);
          text-shadow: 0 0 10px rgba(0, 245, 255, 0.6);
        }
        .beam {
          height: 4px;
          width: 100%;
          margin-top: 16px;
          border-radius: 9999px;
          background: linear-gradient(90deg, var(--neon-teal), var(--neon-cyan), var(--neon-teal));
          box-shadow: 0 0 24px rgba(0, 245, 255, 0.45);
          animation: shimmer 5s linear infinite;
          background-size: 200% 100%;
        }
        @keyframes shimmer {
          0% {
            background-position: 0% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
      `}</style>
    </main>
  );
}

// ---------- Helpers ----------
function Glass({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`glass ${className}`}>{children}</div>;
}

function StatCard({
  label,
  value,
  accent = 'teal',
}: {
  label: string;
  value: string | number;
  accent?: 'teal' | 'emerald' | 'cyan' | 'amber' | 'magenta' | 'violet';
}) {
  return (
    <div className="glass p-5 relative overflow-hidden">
      <p className="text-[11px] tracking-[.35em] text-white/70 font-semibold">{label}</p>
      <p className="mt-2 text-4xl font-extrabold text-white/95 font-digits">{value}</p>
    </div>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center';
}) {
  return <th className={`px-3 py-2 text-${align}`}>{children}</th>;
}

function Td({
  children,
  align = 'left',
  className = '',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  return <td className={`px-3 py-2 text-${align} ${className}`}>{children}</td>;
}

function ActionButtons({ actions }: { actions: Action[] }) {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3 mt-2">
      {actions.map((a, i) => {
        if (a.type === 'open_url') {
          return (
            <a
              key={i}
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="btn-neon inline-flex items-center gap-2 px-4 py-2 rounded-md"
            >
              {/* ไอคอนลูกศรออกนอกหน้าต่างเล็ก ๆ */}
              <span className="inline-block" aria-hidden>↗</span>
              <span>{a.label}</span>
            </a>
          );
        }
        return null;
      })}
    </div>
  );
}