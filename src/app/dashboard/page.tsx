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

type AiApi =
  | { ok: true; reply?: string; logs?: string[]; results?: AiResult[]; meta?: any }
  | { ok: false; error: string };

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [ts, setTs] = useState<string>('');
  const [dorm, setDorm] = useState<Dorm | null>(null); // ← ชื่อหอพัก
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [userInput, setUserInput] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<AiResult[]>([]);

  // ------------ 1) โหลดสรุปจากฐานข้อมูล (ผ่าน /api/dashboard) ------------
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/dashboard', { cache: 'no-store' });
        const d: DashboardApi = await r.json();
        if (!alive) return;
        if ('ok' in d && d.ok) {
          setSummary(d.summary);
          setTs(d.timestamp);
          setDorm(d.dorm ?? null); // ← รับชื่อหอพักถ้ามี
          setLoadErr(null);
        } else {
          setLoadErr((d as any)?.error || `HTTP ${r.status}`);
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

  // ------------ 2) ส่งข้อความไป n8n (ผ่าน /api/ai) ------------
  const handleAskAI = async () => {
    const q = userInput.trim();
    if (!q) return;

    setLogs((l) => [...l, `🧠 User: ${q}`]);
    setAiReply('⌛ กำลังประมวลผล...');
    setResults([]);
    setUserInput('');

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: q,
          context: {
            userId: 'staff_123', // TODO: ใส่จาก session/auth จริง
            role: 'manager',
            locale: 'th-TH',
            ts: new Date().toISOString(),
            dormId: dorm?.id ?? undefined, // ส่ง dormId ไปช่วยคอนเท็กซ์ (ไม่บังคับ)
          },
        }),
      });

      const data: AiApi = await res.json();

      if ('ok' in data && data.ok) {
        setAiReply(data.reply || '✅ สำเร็จ');
        if (Array.isArray(data.logs)) setLogs((l) => [...l, ...data.logs]);
        if (Array.isArray(data.results)) {
          const safe: AiResult[] = data.results.map((r: any) => ({
            room: String(r?.room ?? ''),
            period: String(r?.period ?? ''),
            amount: Number(r?.amount ?? 0),
            status: String(r?.status ?? 'unknown').toLowerCase(),
          }));
          setResults(safe);
        }
      } else {
        const msg = (data as any)?.error || res.statusText || 'unknown_error';
        setAiReply('❌ เกิดข้อผิดพลาด');
        setLogs((l) => [...l, `ERROR: ${msg}`]);
      }
    } catch (e: any) {
      setAiReply('❌ เชื่อมต่อไม่ได้');
      setLogs((l) => [...l, `ERROR: ${e?.message || e}`]);
    }
  };

  const updatedText = useMemo(() => {
    if (!ts) return '—';
    try {
      return new Date(ts).toLocaleString('th-TH');
    } catch {
      return ts;
    }
  }, [ts]);

  return (
    <main className="min-h-screen text-white relative overflow-hidden">
      {/* --- FUTURE BACKGROUND LAYERS --- */}
      <div className="bg-stars" />
      <div className="grid-overlay" />
      <div className="scanline" />
      <div className="aurora" />

      {/* HEADER (ปรับให้บรรทัด 1 = ชื่อหอ, บรรทัด 2 = Sub header) */}
      <div className="max-w-7xl mx-auto px-6 pt-10">
        <div className="flex flex-col gap-1">
          <h1 className="font-orbitron text-3xl md:text-5xl tracking-[.08em] drop-shadow-[0_0_20px_rgba(0,245,255,.35)]">
            {dorm?.name ?? '—'}
          </h1>
          <h2 className="title flex items-baseline gap-2 text-white/90">
            <span className="">NEX</span>
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
        {/* LEFT: Summary + Chat */}
        <div className="space-y-8 xl:col-span-2">
          {/* SUMMARY CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {loading ? (
              <Glass className="col-span-3 text-center text-white/70 py-6 animate-pulse">
                ⏳ กำลังโหลดข้อมูล...
              </Glass>
            ) : loadErr ? (
              <Glass className="col-span-3 text-center text-rose-300 py-6">❌ {loadErr}</Glass>
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

          {/* AI CHAT PANEL */}
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
            </div>
          </Glass>
        </div>

        {/* RIGHT: Logs + Results */}
        <div className="space-y-8">
          {/* ACTION MONITOR */}
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

          {/* ACTION RESULT */}
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

      {/* --- INLINE GLOBAL STYLES (ฟอนต์ + เอฟเฟกต์พื้นหลัง + ของตกแต่ง) --- */}
      <style jsx global>{`
        /* Google Fonts (แนวอนาคต) */
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Oxanium:wght@400;700&family=Rajdhani:wght@400;500;700&display=swap');

        :root {
          --bg: #070b12;
          --panel: rgba(15, 22, 34, 0.66);
          --glass: rgba(255, 255, 255, 0.06);
          --stroke: rgba(255, 255, 255, 0.12);
          --neon-teal: #00f5ff;
          --neon-cyan: #5cf9ff;
          --neon-magenta: #ff4dff;
          --neon-lime: #b6ff00;
        }
        .font-ui {
          font-family: 'Rajdhani', ui-sans-serif, system-ui;
        }
        .font-digits {
          font-family: 'Oxanium', monospace;
          letter-spacing: 0.3px;
        }
        .font-orbitron {
          font-family: 'Orbitron', 'Rajdhani', sans-serif;
        }
        .title {
          font-family: 'Orbitron', 'Rajdhani', sans-serif;
          font-size: clamp(20px, 2.2vw, 28px);
          letter-spacing: 0.06em;
        }
        .neon-teal {
          color: var(--neon-teal);
          text-shadow: 0 0 10px rgba(0, 245, 255, 0.6);
        }

        /* Background: stars + grid + aurora + scanline */
        .bg-stars {
          position: fixed;
          inset: 0;
          z-index: -4;
          background: #0a0f16;
          background: radial-gradient(1000px 600px at 20% -10%, rgba(0, 255, 255, 0.15), transparent 60%),
            radial-gradient(800px 500px at 80% 110%, rgba(255, 0, 255, 0.12), transparent 60%),
            radial-gradient(600px 400px at -10% 80%, rgba(0, 255, 128, 0.1), transparent 60%), #070b12;
        }
        .bg-stars::before,
        .bg-stars::after {
          content: '';
          position: absolute;
          inset: -200%;
          background-image: radial-gradient(2px 2px at 20px 30px, #fff, transparent),
            radial-gradient(2px 2px at 120px 80px, #9ff, transparent),
            radial-gradient(2px 2px at 220px 130px, #fff, transparent),
            radial-gradient(2px 2px at 320px 60px, #9ff, transparent),
            radial-gradient(2px 2px at 420px 100px, #fff, transparent);
          animation: drift 90s linear infinite;
          opacity: 0.5;
        }
        .bg-stars::after {
          animation-duration: 120s;
          opacity: 0.35;
        }
        @keyframes drift {
          to {
            transform: translate3d(25%, -25%, 0);
          }
        }

        .grid-overlay {
          position: fixed;
          inset: 0;
          z-index: -3;
          background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 48px 48px, 48px 48px;
          mask: radial-gradient(closest-side, rgba(255, 255, 255, 0.85), transparent 75%);
          transform: perspective(600px) rotateX(60deg) translateY(-10%);
          animation: gridPulse 8s ease-in-out infinite;
        }
        @keyframes gridPulse {
          0%,
          100% {
            transform: perspective(600px) rotateX(60deg) translateY(-10%);
            opacity: 0.45;
          }
          50% {
            transform: perspective(600px) rotateX(60deg) translateY(-6%);
            opacity: 0.65;
          }
        }
        .aurora {
          position: fixed;
          inset: -10% -20%;
          z-index: -2;
          background: radial-gradient(60rem 30rem at 10% 15%, rgba(0, 245, 255, 0.12), transparent 65%),
            radial-gradient(50rem 25rem at 90% 85%, rgba(255, 77, 255, 0.12), transparent 60%);
          filter: blur(20px);
          animation: auroraMove 16s ease-in-out infinite alternate;
        }
        @keyframes auroraMove {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(-2%);
          }
        }
        .scanline {
          position: fixed;
          inset: 0;
          z-index: -1;
          mix-blend-mode: overlay;
          pointer-events: none;
          background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 100% 3px;
          opacity: 0.35;
          animation: scan 6s linear infinite;
        }
        @keyframes scan {
          0% {
            background-position: 0 0;
          }
          100% {
            background-position: 0 100%;
          }
        }

        /* Neon line under title */
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

        /* Glass / Holographic card */
        .glass {
          background: var(--glass);
          border: 1px solid var(--stroke);
          backdrop-filter: blur(10px) saturate(1.2);
          box-shadow: 0 0 0 1px rgba(0, 255, 255, 0.05) inset, 0 10px 30px rgba(0, 0, 0, 0.4),
            0 0 50px rgba(0, 245, 255, 0.05) inset;
          border-radius: 16px;
        }
        .glass:hover {
          box-shadow: 0 0 0 1px rgba(0, 255, 255, 0.07) inset, 0 16px 36px rgba(0, 0, 0, 0.5),
            0 0 60px rgba(92, 249, 255, 0.07) inset;
        }

        /* Neon button */
        .btn-neon {
          position: relative;
          padding: 10px 18px;
          border-radius: 10px;
          color: #011;
          font-weight: 800;
          letter-spacing: 0.03em;
          background: linear-gradient(90deg, var(--neon-teal), var(--neon-cyan));
          box-shadow: 0 0 18px rgba(0, 245, 255, 0.45), inset 0 0 8px rgba(255, 255, 255, 0.35);
          transition: transform 0.06s ease, filter 0.2s ease;
          font-family: 'Oxanium', sans-serif;
        }
        .btn-neon:hover {
          filter: brightness(1.08);
        }
        .btn-neon:active {
          transform: scale(0.98);
        }

        .badge {
          font-family: 'Oxanium', sans-serif;
          font-size: 11px;
          letter-spacing: 0.2em;
          background: rgba(0, 245, 255, 0.12);
          border: 1px solid rgba(0, 245, 255, 0.35);
          padding: 4px 8px;
          border-radius: 9999px;
          color: var(--neon-cyan);
        }

        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: var(--neon-lime);
          box-shadow: 0 0 10px rgba(182, 255, 0, 0.8);
        }
        .dot-pulse {
          animation: dot 1.2s ease-in-out infinite;
        }
        @keyframes dot {
          0%,
          100% {
            transform: scale(0.9);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.15);
            opacity: 1;
          }
        }

        /* Utility text colors */
        .text-white\\/85 {
          color: rgba(255, 255, 255, 0.85);
        }

        /* Fix tables on glass */
        table {
          border-collapse: separate;
          border-spacing: 0 4px;
        }
      `}</style>
    </main>
  );
}

/* ---------- Presentational helpers (ไม่แตะลอจิกดึงข้อมูล) ---------- */
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
  const accentRing =
    {
      teal: '0 0 30px rgba(0,245,255,.25)',
      emerald: '0 0 30px rgba(16,185,129,.25)',
      cyan: '0 0 30px rgba(92,249,255,.25)',
      amber: '0 0 30px rgba(245,158,11,.25)',
      magenta: '0 0 30px rgba(255,77,255,.25)',
      violet: '0 0 30px rgba(167,139,250,.25)',
    }[accent] || '0 0 30px rgba(0,245,255,.25)';

  return (
    <div className="glass p-5 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: accentRing }} />
      <p className="text-[11px] tracking-[.35em] text-white/70 font-semibold">{label}</p>
      <p className="mt-2 text-4xl font-extrabold text-white/95 font-digits">{value}</p>
      <div className="mt-3 h-[2px] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
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