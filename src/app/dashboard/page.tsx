// src/app/dashboard/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';

/* ---------- Types: เหมือนเดิม ---------- */
type Summary = {
  totalRooms: number;
  occupied: number;
  vacant: number;
  repairing: number;
  unpaidBills: number;
  maintenanceOpen: number;
};
type Dorm = { id: string; name: string };
type AiResult = { room: string; period: string; amount: number; status: string };
type DashboardApi =
  | { ok: true; summary: Summary; timestamp: string; dorm?: Dorm }
  | { ok: false; error: string };
type Action = { type: 'open_url'; label: string; url: string };
type AiApi =
  | { ok: true; reply?: string; logs?: string[]; results?: AiResult[]; actions?: Action[]; meta?: any }
  | { ok: false; error: string };

/* ---------- Page ---------- */
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

  /* ---------- โหลดข้อมูลเหมือนเดิม ---------- */
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

  /* ---------- ส่งคำสั่งไป AI เหมือนเดิม ---------- */
  const handleAskAI = async () => {
    const q = userInput.trim();
    if (!q) return;

    setLogs((prev) => [...prev, `🧠 User: ${q}`]);
    setAiReply('⌛ กำลังประมวลผล...');
    setResults([]);
    setActions([]);
    setUserInput('');

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: q }),
      });
      const data: AiApi = await res.json();

      if ('ok' in data && data.ok) {
        setAiReply(data.reply || '✅ สำเร็จ');
        if (Array.isArray(data.logs)) setLogs((prev) => [...prev, ...data.logs]);
        if (Array.isArray((data as any).results)) {
          const safe: AiResult[] = (data as any).results.map((r: any) => ({
            room: String(r?.room ?? ''),
            period: String(r?.period ?? ''),
            amount: Number(r?.amount ?? 0),
            status: String(r?.status ?? 'unknown').toLowerCase(),
          }));
          setResults(safe);
        }
        if (Array.isArray((data as any).actions)) setActions(data.actions as Action[]);
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

  /* ---------- เวลาอัปเดต ---------- */
  const updatedText = useMemo(() => {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleString('th-TH'); } catch { return ts; }
  }, [ts]);

  /* ---------- UI: Neon/Cyber-glass + motion (สไตล์ใหม่) ---------- */
  return (
    <main className="min-h-screen text-white relative overflow-hidden bg-[#0D0718]">
      {/* Background layers */}
      <Aurora />
      <Particles />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1000px_600px_at_12%_12%,#34165f_0%,transparent_60%),radial-gradient(900px_540px_at_88%_18%,#2b0c53_0%,transparent_60%),radial-gradient(900px_540px_at_30%_100%,#270a43_0%,transparent_60%)] opacity-60" />

      {/* HEADER */}
      <div className="max-w-7xl mx-auto px-6 pt-10 relative z-10">
        <div className="flex flex-col gap-1 text-center md:text-left">
          <div className="inline-flex items-center gap-3 justify-center md:justify-start">
            <div className="h-11 w-11 rounded-xl animate-[pulse_3.6s_ease-in-out_infinite] shadow-[0_0_40px_#a855f7aa] bg-[conic-gradient(from_210deg,#8A2BE2,#FF5BD6,#FF7A00,#8A2BE2)]" />
            <h1 className="font-orbitron text-3xl md:text-5xl tracking-[.08em] drop-shadow-[0_0_25px_rgba(255,122,0,.35)]">
              {dorm?.name ?? '—'}
            </h1>
          </div>
          <h2 className="title flex items-baseline gap-2 justify-center md:justify-start text-white/90">
            <span className="text-white/80">NEX</span>
            <span className="text-[#00F5FF] drop-shadow-[0_0_10px_rgba(0,245,255,.6)]">Room</span>
            <span className="text-white/60 text-base md:text-lg tracking-widest">
              • SMART DORM AI CONTROL CENTER
            </span>
          </h2>
        </div>
        <div className="h-1.5 w-full mt-4 rounded-full bg-gradient-to-r from-[#8A2BE2] via-[#FF5BD6] to-[#FF7A00] animate-[shimmer_6s_linear_infinite] bg-[length:200%_100%]" />
      </div>

      {/* CONTENT */}
      <section className="max-w-7xl mx-auto px-6 pb-20 pt-10 grid grid-cols-1 xl:grid-cols-3 gap-8 font-ui relative z-10">
        {/* LEFT */}
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
                <StatCard label="TOTAL ROOMS" value={summary.totalRooms} />
                <StatCard label="OCCUPIED" value={summary.occupied} />
                <StatCard label="VACANT" value={summary.vacant} />
                <StatCard label="REPAIRING" value={summary.repairing} />
                <StatCard label="UNPAID BILLS" value={summary.unpaidBills} />
                <StatCard label="MAINTENANCE OPEN" value={summary.maintenanceOpen} />
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
                <button onClick={handleAskAI} className="btn-neon">ส่งคำสั่ง</button>
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
                  logs.map((line, i) => <p key={i} className="text-white/85">{line}</p>)
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
                        <Th>ROOM</Th><Th>PERIOD</Th><Th align="right">AMOUNT</Th><Th>STATUS</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => (
                        <tr key={i} className="hover:bg-white/5 transition">
                          <Td className="font-digits">{r.room}</Td>
                          <Td className="font-digits">{r.period}</Td>
                          <Td align="right" className="font-digits">{Number(r.amount ?? 0).toLocaleString('th-TH')}</Td>
                          <Td>
                            <span className={
                              'px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wide border ' +
                              (r.status === 'paid'
                                ? 'bg-emerald-400/15 text-emerald-200 border-emerald-300/30'
                                : 'bg-rose-400/15 text-rose-200 border-rose-300/30')
                            }>{r.status}</span>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="px-5 pb-4"><p className="text-center text-[11px] text-white/50">⏱ Updated: {updatedText}</p></div>
          </Glass>
        </div>
      </section>

      {/* Global styles for neon/glass + animations */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Oxanium:wght@400;700&family=Rajdhani:wght@400;500;700&display=swap');
        .font-ui{font-family:'Rajdhani',ui-sans-serif,system-ui}
        .font-digits{font-family:'Oxanium',monospace;letter-spacing:.3px}
        .font-orbitron{font-family:'Orbitron',sans-serif}
        @keyframes shimmer{0%{background-position:0% 0}100%{background-position:200% 0}}
        @keyframes pulse{0%,100%{transform:scale(1);box-shadow:0 0 20px #a855f766,inset 0 0 10px #fff2}50%{transform:scale(1.03);box-shadow:0 0 44px #a855f7aa,inset 0 0 22px #fff4}}

        .glass{
          background: linear-gradient(165deg, rgba(255,255,255,.12), rgba(255,255,255,.06));
          border:1px solid rgba(255,255,255,.16);
          border-radius:20px; backdrop-filter: blur(10px);
          box-shadow: 0 10px 28px -8px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.08) inset, 0 0 42px 0 rgba(124,58,237,.25);
          transition: transform .28s ease, box-shadow .28s ease, border-color .28s ease;
          position:relative; overflow:hidden;
        }
        .glass:hover{ transform: translateY(-2px); border-color: rgba(255,255,255,.26); box-shadow:0 0 35px rgba(255,122,0,.25),0 0 20px rgba(138,43,226,.25),0 0 6px 1px rgba(255,255,255,.2) inset }
        .glass::after{
          content:""; position:absolute; left:10%; right:10%; bottom:0; height:2px; border-radius:2px;
          background: linear-gradient(90deg,#8A2BE2,#FF5BD6,#FF7A00); opacity:.6; transform: scaleX(0); transform-origin:left;
          animation: grow 1s ease forwards; animation-delay:.2s;
        }
        @keyframes grow{to{transform:scaleX(1)}}

        .btn-neon{
          padding:.6rem 1rem; border-radius:.75rem; border:1px solid rgba(255,255,255,.28);
          background: linear-gradient(160deg, rgba(255,255,255,.18), rgba(255,255,255,.08));
          box-shadow: 0 0 20px rgba(255,122,0,.25);
        }
        .btn-neon:hover{ background: linear-gradient(160deg, rgba(255,255,255,.24), rgba(255,255,255,.12)); }

        .badge{font-size:12px;padding:4px 8px;border-radius:9px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.2)}
        .dot{width:10px;height:10px;border-radius:9999px;background:#00F5FF;box-shadow:0 0 12px rgba(0,245,255,.7)}
        .dot-pulse{animation:dotpulse 1.6s ease-in-out infinite}
        @keyframes dotpulse{0%,100%{transform:scale(.9);opacity:.6}50%{transform:scale(1.1);opacity:1}}
      `}</style>
    </main>
  );
}

/* ---------- Neon helpers ---------- */
function Glass({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`glass ${className}`}>{children}</div>;
}
function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass p-5">
      <p className="text-[11px] tracking-[.35em] text-white/70 font-semibold">{label}</p>
      <p className="mt-2 text-4xl font-extrabold text-white/95 font-digits">{value}</p>
    </div>
  );
}
function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return <th className={`px-3 py-2 text-${align}`}>{children}</th>;
}
function Td({
  children, align = 'left', className = '',
}: { children: React.ReactNode; align?: 'left' | 'right' | 'center'; className?: string }) {
  return <td className={`px-3 py-2 text-${align} ${className}`}>{children}</td>;
}
function ActionButtons({ actions }: { actions: Action[] }) {
  if (!actions || actions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-3 mt-2">
      {actions.map((a, i) =>
        a.type === 'open_url' ? (
          <a key={i} href={a.url} target="_blank" rel="noreferrer" className="btn-neon inline-flex items-center gap-2 px-4 py-2 rounded-md">
            <span aria-hidden>↗</span><span>{a.label}</span>
          </a>
        ) : null
      )}
    </div>
  );
}

/* ---------- Animated BG (Aurora + Particles) ---------- */
function Aurora() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 opacity-35"
      style={{
        background: 'linear-gradient(120deg, #44206f, #22113f, #44206f)',
        mixBlendMode: 'screen',
        filter: 'blur(50px)',
        animation: 'aurora 26s ease-in-out infinite alternate',
      }}
    >
      <style jsx>{`
        @keyframes aurora {
          0% { transform: translateX(-6%) rotate(0deg) scale(1); }
          100% { transform: translateX(6%) rotate(2deg) scale(1.04); }
        }
      `}</style>
    </div>
  );
}
function Particles() {
  // lightweight CSS-only starfield shimmer
  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,122,0,.10),transparent_60%)] animate-[float_12s_ease-in-out_infinite]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(138,43,226,.10),transparent_60%)] animate-[float_16s_ease-in-out_infinite_reverse]" />
      <style jsx>{`
        @keyframes float {
          0%,100% { transform: translateY(-2%); }
          50% { transform: translateY(2%); }
        }
      `}</style>
    </div>
  );
}
