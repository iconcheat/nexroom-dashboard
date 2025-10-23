'use client';

import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Script from 'next/script';
import BookingPanel from '../../components/BookingPanel';
import AgentChat from '../../components/AgentChat';
import RoomsOverviewPanel from '@/components/RoomsOverviewPanel';
import QueueJobsPanel from '@/components/QueueJobsPanel';

export default function DashboardPage() {
  // ===== State / Context =====
  const [summary, setSummary] = useState<any | null>(null);
  const [paying, setPaying] = useState(false);
  const [dormName, setDormName] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [billingPeriod, setBillingPeriod] = useState<string>('');
  const [roomsOverview, setRoomsOverview] = useState<any>(null);
  const CASH_WEBHOOK = '/api/payments/cash';
  const playVoice = (type: 'processing' | 'done') => {
    const src = type === 'processing' ? '/sounds/processing.mp3' : '/sounds/done.mp3';
    const audio = new Audio(src);
    audio.volume = 1.0;
    audio.play().catch(() => {
      // เบราว์เซอร์ต้องการ user gesture ครั้งแรกถึงจะเล่นอัตโนมัติได้
      console.warn('Autoplay is blocked until user interacts');
    });
  };
  const fmtTH = (n: number) =>
    (typeof n === 'number' ? n.toLocaleString('th-TH') : String(n ?? ''));

    // === Audio autoplay unlock (ADD) ===
  // ปลดล็อกนโยบาย autoplay ของเบราว์เซอร์: ให้ผู้ใช้คลิก/กดแป้นพิมพ์ครั้งแรก แล้วจึงอนุญาตเล่นเสียงอัตโนมัติ
  const audioUnlockedRef = useRef(false);

  useEffect(() => {
    const unlock = () => {
      if (audioUnlockedRef.current) return;
      try {
        const a = new Audio('/sounds/done.mp3'); // ใช้ไฟล์อะไรก็ได้ใน /public/sounds
        a.muted = true;                          // ป้องกันเสียงดังตอนปลดล็อก
        a.play().then(() => {
          a.pause();
          a.currentTime = 0;
          a.muted = false;
          console.log('🔓 Audio unlocked');
        }).catch(() => {/* ignore */});
      } finally {
        audioUnlockedRef.current = true;
        document.removeEventListener('click', unlock);
        document.removeEventListener('keydown', unlock);
      }
    };

    // ผู้ใช้กดครั้งแรก (คลิก/พิมพ์) → ปลดล็อก
    document.addEventListener('click', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  // ===== Actions =====
  const handlePayCashNow = async () => {
    if (!summary) return alert('ยังไม่มีข้อมูลสรุป');
    const act = (summary.next_actions || []).find((a: any) => a.type === 'pay_cash_now');
    const payload = act?.payload || {
      dorm_id: summary.dorm_id,
      booking_id: summary.booking_id,
      amount: summary.money?.must_pay_today,
    };
    try {
      setPaying(true);
      const res = await fetch(CASH_WEBHOOK, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          cashier: 'Manager',
          paid_at: new Date().toISOString(),
          job_id: summary.job_id || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      alert('บันทึกชำระเงินสดแล้ว (รอ event: payment_done)');
    } catch (err: any) {
      alert('ชำระเงินสดล้มเหลว: ' + err?.message);
    } finally {
      setPaying(false);
    }
  };

  useEffect(() => {
  let es: EventSource | null = null;
  let retry = 0;
  let dormId: string | null = null;

  // --- ประกาศ connect ก่อน ---
  const connect = () => {
    // ดึง session_id จาก cookie
    const m = document.cookie.match(/(?:^|;\s*)nxr_session=([^;]+)/);
    const sessionId = m?.[1] ? decodeURIComponent(m[1]) : '';

    // แนบ dorm_id + session_id ใน query
    const qs = new URLSearchParams();
    if (sessionId) qs.set('session_id', sessionId);
    if (dormId) qs.set('dorm_id', dormId);

    es = new EventSource(`/api/ai/events?${qs.toString()}`);

    // -- default event --
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data || '{}');
        const evt = msg.event || msg?.data?.event;
        const data = msg.data || msg;
        if (!evt) return;

            // ✨ ADD: voice from generic message channel
        if (evt === 'notify') {
          const tone = data?.tone;
          if (tone === 'info')    playVoice('processing'); // เริ่มประมวลผล
          if (tone === 'success') playVoice('done');       // เสร็จสิ้นแล้ว
          return; // จบที่นี่ ไม่แตะ state อื่น
        }
        if (evt === 'reserve_summary') setSummary(data);
        if (evt === 'payment_done') {
          setSummary((prev: any) => {
            if (!prev) return data;
            const same =
              !prev?.booking_id ||
              prev?.booking_id === (data?.booking_id || prev?.booking_id);
            return same ? { ...prev, ...data } : prev;
          });
        }
      } catch {}
    };

    // -- named events --
    es.addEventListener('reserve_summary', (ev: MessageEvent) => {
      try { setSummary(JSON.parse(ev.data || '{}')); } catch {}
    });

    es.addEventListener('payment_done', (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data || '{}');
        setSummary((prev: any) => {
          if (!prev) return data;
          const same =
            !prev?.booking_id ||
            prev?.booking_id === (data?.booking_id || prev?.booking_id);
          return same ? { ...prev, ...data } : prev;
        });
      } catch {}
    });

    // ✨ ADD: named 'notify' event
    es.addEventListener('notify', (ev: MessageEvent) => {
      try {
        const payload = JSON.parse(ev.data || '{}');
        const tone = payload?.tone || payload?.data?.tone;
        if (tone === 'info')    playVoice('processing');
        if (tone === 'success') playVoice('done');
      } catch {}
    });

    // --- rooms_overview ---
    es.addEventListener('rooms_overview', (ev: MessageEvent) => {
      try {
        const raw = JSON.parse(ev.data || '{}');
        // รองรับได้ทั้ง {rooms:[]} หรือ {data:{rooms:[]}}
        const rooms =
          Array.isArray(raw?.rooms) ? raw.rooms :
          Array.isArray(raw?.data?.rooms) ? raw.data.rooms :
          [];

        // << เซ็ตเป็น object ที่มี rooms ชัดเจน
        setRoomsOverview({ rooms, updated_at: raw?.updated_at || raw?.data?.updated_at });
        console.log('rooms_overview -> rooms:', rooms.length);
      } catch (e) { console.warn('parse rooms_overview fail', e); }
    });

    es.onerror = () => {
      es?.close();
      const backoff = Math.min(1000 * Math.pow(2, retry++), 15000);
      console.warn(`SSE reconnecting in ${backoff}ms`);
      setTimeout(connect, backoff);
    };
  };

  // --- preload initial แล้วค่อย connect() ---
  (async () => {
    try {
      const r = await fetch('/api/dashboard/initial', { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        if (j?.dorm_name) setDormName(j.dorm_name);
        if (j?.user_name) setUserName(j.user_name);
        if (j?.last_reserve_summary) setSummary(j.last_reserve_summary);
        if (j?.last?.rooms_overview) {
          const raw = j.last.rooms_overview;
          const rooms =
            Array.isArray(raw?.data?.rooms) ? raw.data.rooms :
            Array.isArray(raw?.rooms) ? raw.rooms : [];
          setRoomsOverview({ rooms, updated_at: raw?.data?.updated_at || raw?.updated_at });
        }
        dormId = j?.dorm_id || null;
      }
    } catch (err) {
      console.error('initial load error:', err);
    }

    connect(); // ✅ ตอนนี้ TypeScript จะไม่ฟ้องแล้ว
  })();

  return () => { es?.close(); };
}, []);
  
  useEffect(() => {
  const now = new Date();
  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, '0'); // เดือน 2 หลัก
  setBillingPeriod(`${y}-${m}`);
}, []);


  // ===== Background Floating Particles =====
  useEffect(() => {
    const cvs = document.getElementById('particles') as HTMLCanvasElement | null;
    if (!cvs) return;
    const ctx = cvs.getContext('2d')!;
    let W = 0,
      H = 0,
      PR = 1;
    const P = 48;
    const nodes: any[] = [];
    const resize = () => {
      PR = window.devicePixelRatio || 1;
      W = window.innerWidth;
      H = window.innerHeight;
      cvs.width = W * PR;
      cvs.height = H * PR;
      cvs.style.width = W + 'px';
      cvs.style.height = H + 'px';
      ctx.setTransform(PR, 0, 0, PR, 0, 0);
    };
    addEventListener('resize', resize);
    resize();
    for (let i = 0; i < P; i++) {
      nodes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 2 + 0.6,
        dx: (Math.random() - 0.5) * 0.35,
        dy: (Math.random() - 0.5) * 0.35,
        c: `rgba(${220 + Math.random() * 35},${120 + Math.random() * 40},255,.22)`,
      });
    }
    let raf = 0;
    const step = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of nodes) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c;
        ctx.fill();
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > W) p.dx *= -1;
        if (p.y < 0 || p.y > H) p.dy *= -1;
      }
      raf = requestAnimationFrame(step);
    };
    step();
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
    };
  }, []);

  return (
    <>
      <Head>
        <title>NEXRoom • Smart Dorm Dashboard</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700&family=Inter:wght@400;600;800&display=swap"
          rel="stylesheet"
        />
      </Head>

      <Script
        src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"
        strategy="afterInteractive"
      />

      <main className="bg-grid relative min-h-screen">
        <canvas id="particles" />

        <div className="wrap withTopbar">
          {/* ===== HEADER / LOGO ===== */}
          <header>
            <div
              className="brand"
              style={{ display: 'flex', gap: 12, alignItems: 'center' }}
            >
              <div className="logo" />
              <div>
                <h1 className="nxr-title">NEXRoom • Smart Dorm Dashboard</h1>
                <div className="bar" />
              </div>
            </div>
          </header>

          {/* ===== CONTROL AREA (7 ปุ่มด้านขวาบน) ===== */}
          <div className="top-controls">
            <div className="top-row buttons">
              <button className="btn-orange neon-rounded shadow-glow">🏠 จองห้องพัก</button>
              <button className="btn-orange neon-rounded shadow-glow">👤 ข้อมูลลูกค้า</button>
              <button className="btn-orange neon-rounded shadow-glow">⚡ บันทึกมิเตอร์</button>
              <button className="btn-orange neon-rounded shadow-glow">🧾 ใบแจ้งหนี้</button>
            </div>
            <div className="top-row chips">
              <div className="panel-chip glass-neon neon-rounded shine-run">หอพัก: {dormName}</div>
              <div className="panel-chip glass-neon neon-rounded shine-run">รอบบิล: {billingPeriod || '—'}</div>
              <div className="panel-chip glass-neon neon-rounded shine-run">ผู้ใช้: {userName}</div>
            </div>
          </div>

          {/* ===== GRID / CONTENT ===== */}
          <div className="grid">
            <section className="card col-3">
              <div className="kpi">
                <div>
                  <div className="label">อัตราเข้าพัก</div>
                  <div className="value">88%</div>
                </div>
                <span className="badge">176/200 ห้อง</span>
              </div>
              <div className="row">
                <span className="chip">ว่าง 18</span>
                <span className="chip">จอง 6</span>
              </div>
            </section>

            <section className="card col-3">
              <div className="kpi">
                <div>
                  <div className="label">บิลค้างชำระ</div>
                  <div className="value" style={{ color: '#ffb020' }}>
                    32,400฿
                  </div>
                </div>
                <span className="badge">12 ห้อง</span>
              </div>
            </section>

            <section className="card col-3">
              <div className="kpi">
                <div>
                  <div className="label">รายได้รับจริง (MTD)</div>
                  <div className="value" style={{ color: '#21d07a' }}>
                    486,900฿
                  </div>
                </div>
              </div>
              <canvas id="sparkRevenue" />
            </section>

            <section className="card col-3">
              <div className="kpi">
                <div>
                  <div className="label">งานซ่อมคงค้าง</div>
                  <div className="value" style={{ color: '#ffd166' }}>
                    5
                  </div>
                </div>
              </div>
              <canvas id="sparkTickets" />
            </section>

            <section className="card col-8">
              <div className="label">📄 คิวงานล่าสุด</div>
              <QueueJobsPanel className="rows-5 scroll-10 glass-neon neon-rounded" />
            </section>

            <section className="card col-4">
              <div className="label">วงแหวนอัตราเข้าพัก</div>
              <div className="ring" style={{ '--deg': '316deg' } as any}>
                <div className="txt">88%</div>
              </div>
            </section>

            <section className="card col-6">
               <div className="label">📅 การจองล่าสุด</div>
               <BookingPanel data={summary} />
             </section>

             <section className="card col-6">
               <RoomsOverviewPanel data={roomsOverview} />
             </section>

            <section className="card col-12" style={{ marginTop: 24 }}>
              <div className="label">🤖 NEXRoom AI</div>
              <AgentChat />
            </section>
          </div>
        </div>
      </main>

      {/* ===== STYLE ===== */}
      <style jsx global>{`
        /* === TOP CONTROLS === */
        .top-controls {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
          margin-top: 8px;
          margin-bottom: 12px;
        }
        .top-controls .top-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        /* ปุ่มส้ม */
        .btn-orange {
          background: linear-gradient(100deg, #ff7a18 0%, #ffb347 100%);
          border: none;
          color: #fff;
          font-weight: 700;
          padding: 8px 16px;
          letter-spacing: 0.2px;
          transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
        }
        .btn-orange:hover {
          transform: translateY(-1px);
          filter: brightness(1.05);
        }
        .shadow-glow {
          box-shadow: 0 0 14px rgba(255, 153, 0, 0.45);
        }
        .neon-rounded {
          border-radius: 16px;
        }

        /* พาแนลชิป */
        .panel-chip {
          position: relative;
          padding: 7px 14px;
          color: #fff;
          font-weight: 600;
          background: rgba(30, 30, 48, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.14);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06),
            0 4px 14px rgba(0, 0, 0, 0.25);
          backdrop-filter: blur(8px);
        }
        .glass-neon {
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1) inset,
            0 0 16px rgba(112, 66, 255, 0.18),
            0 0 24px rgba(255, 120, 60, 0.18);
        }
        .panel-chip::before {
          content: '';
          position: absolute;
          left: 8px;
          right: 8px;
          top: 3px;
          height: 40%;
          border-radius: 999px;
          background: linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0.35),
            rgba(255, 255, 255, 0)
          );
          pointer-events: none;
          filter: blur(2px);
          opacity: 0.55;
        }
        .shine-run::after {
          content: '';
          position: absolute;
          top: -20%;
          bottom: -20%;
          width: 60px;
          transform: skewX(-20deg);
          left: -80px;
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.55) 45%,
            rgba(255, 255, 255, 0) 100%
          );
          opacity: 0.35;
          filter: blur(4px);
          animation: shineSweep 3.6s linear infinite;
        }
        @keyframes shineSweep {
          0% {
            left: -90px;
          }
          100% {
            left: calc(100% + 90px);
          }
        }
      `}</style>
    </>
  );
}