'use client';

import { useEffect } from 'react';
import Head from 'next/head';
import Script from 'next/script';

export default function DashboardPage() {
  useEffect(() => {
    /* ===== Floating particles (รองรับ DPI สูง) ===== */
    const cvs = document.getElementById('particles') as HTMLCanvasElement | null;
    if (!cvs) return;
    const ctx = cvs.getContext('2d')!;
    let W = 0, H = 0, PR = 1;
    const P = 48;
    const nodes: { x: number; y: number; r: number; dx: number; dy: number; c: string }[] = [];
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
    window.addEventListener('resize', resize, { passive: true });
    resize();
    for (let i = 0; i < P; i++) {
      nodes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 2 + 0.6,
        dx: (Math.random() - 0.5) * 0.35,
        dy: (Math.random() - 0.5) * 0.35,
        c: `rgba(${220 + Math.random() * 35},${120 + Math.random() * 40},255,.22)`
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
      window.removeEventListener('resize', resize);
    };
  }, []);

  /* ===== Menu mock actions ===== */
  useEffect(() => {
    const links = document.querySelectorAll<HTMLAnchorElement>('.menu-item');
    const onClick = (e: Event) => {
      e.preventDefault();
      links.forEach((x) => x.classList.remove('active'));
      const a = e.currentTarget as HTMLAnchorElement;
      a.classList.add('active');
      const act = a.dataset.action;
      const msg =
        act === 'reserve'
          ? 'ไปยัง: จองห้องพัก (mock)'
          : act === 'customers'
          ? 'ไปยัง: ดูข้อมูลลูกค้า (mock)'
          : act === 'meters'
          ? 'ไปยัง: บันทึกมิเตอร์ (mock)'
          : act === 'invoices'
          ? 'ไปยัง: ตรวจสอบใบแจ้งหนี้ (mock)'
          : 'เมนู';
      alert(msg);
    };
    links.forEach((a) => a.addEventListener('click', onClick));
    return () => links.forEach((a) => a.removeEventListener('click', onClick));
  }, []);

  /* ===== สร้างกราฟหลังโหลด Chart.js ===== */
  useEffect(() => {
    const Chart = (window as any).Chart;
    if (!Chart) return;
    const thai = new Intl.NumberFormat('th-TH');

    const baseOpts = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1200 },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,.08)' }, ticks: { color: '#d7cfffb3' } },
        y: { grid: { color: 'rgba(255,255,255,.08)' }, ticks: { color: '#d7cfffb3' } },
      },
      plugins: { legend: { labels: { color: '#edeaff' } } },
    };

    const makeLine = (id: string, datasets: any[], labels: string[]) => {
      const el = document.getElementById(id) as HTMLCanvasElement | null;
      if (!el) return;
      new Chart(el, { type: 'line', data: { labels, datasets }, options: baseOpts });
    };

    // main line
    makeLine(
      'mainLine',
      [
        {
          label: 'รายได้',
          data: [430000, 452000, 470000, 455000, 479000, 486900],
          borderColor: '#FF7A00',
          backgroundColor: (c: any) => {
            const g = c.chart.ctx.createLinearGradient(0, 0, 0, 200);
            g.addColorStop(0, 'rgba(255,122,0,.35)');
            g.addColorStop(1, 'rgba(255,122,0,0)');
            return g;
          },
          tension: 0.35,
          fill: true,
          borderWidth: 2,
          pointRadius: 0,
        },
        {
          label: 'ค้างชำระ',
          data: [28000, 22000, 19000, 36000, 31000, 32400],
          borderColor: '#8A2BE2',
          borderDash: [4, 4],
          tension: 0.35,
          pointRadius: 0,
        },
      ],
      ['พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.']
    );

    // small sparks
    const simple = (id: string, color: string, data: number[]) => {
      const el = document.getElementById(id) as HTMLCanvasElement | null;
      if (!el) return;
      new Chart(el, {
        type: 'line',
        data: { labels: data.map((_, i) => i + 1), datasets: [{ data, borderColor: color, tension: 0.35, pointRadius: 0 }] },
        options: { ...baseOpts, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false } } },
      });
    };
    simple('sparkRevenue', '#FF7A00', [60, 62, 61, 63, 65, 66, 67]);
    simple('sparkTickets', '#8A2BE2', [8, 7, 6, 6, 5, 5, 5]);

    // mini bar
    const miniBars = document.getElementById('miniBars') as HTMLCanvasElement | null;
    if (miniBars) {
      new Chart(miniBars, {
        type: 'bar',
        data: {
          labels: ['พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.'],
          datasets: [
            { label: 'ไฟ (kWh)', data: [165, 170, 172, 175, 179, 178], backgroundColor: '#8A2BE2cc' },
            { label: 'น้ำ (m³)', data: [8.3, 8.6, 8.9, 9.1, 9.4, 9.3], backgroundColor: '#FF7A00cc' },
          ],
        },
        options: baseOpts,
      });
    }

    // pie
    const piePay = document.getElementById('piePay') as HTMLCanvasElement | null;
    if (piePay) {
      new Chart(piePay, {
        type: 'doughnut',
        data: { labels: ['PromptPay', 'โอน', 'เงินสด'], datasets: [{ data: [62, 33, 5], backgroundColor: ['#FF7A00', '#8A2BE2', '#FF5BD6'] }] },
        options: { ...baseOpts, cutout: '60%' },
      });
    }
  }, []);

  /* ===== AI Chat mock ===== */
  useEffect(() => {
    const btnAI = document.getElementById('btnAI');
    const out = document.getElementById('aiOut');
    const onAI = () => {
      const inp = document.getElementById('aiInput') as HTMLInputElement | null;
      if (!inp || !out) return;
      const q = inp.value.trim();
      if (!q) {
        out.textContent = 'พิมพ์คำสั่ง เช่น “แสดงบิลค้างเดือนนี้”';
        return;
      }
      const thai = new Intl.NumberFormat('th-TH');
      const sample = {
        intent: 'SHOW_OVERDUE_INVOICES',
        answer: 'มีบิลค้างชำระ 12 รายการ รวม 32,400 บาท',
        table: [
          { room: 'A305', period: '2025-10', amount: 3200 },
          { room: 'B412', period: '2025-10', amount: 2800 },
          { room: 'C208', period: '2025-09', amount: 3000 },
        ],
        explain: 'อ้างอิง invoices ที่สถานะ IN (sent, overdue) ของ dorm_id=PD_PLACE (mock)',
      };
      out.textContent =
        `🧠 Intent: ${sample.intent}\n✅ ${sample.answer}\n\nตัวอย่าง:\n` +
        sample.table.map((r) => `• ห้อง ${r.room} · งวด ${r.period} · ฿${thai.format(r.amount)}`).join('\n') +
        `\n\nℹ️ ${sample.explain}`;
    };
    btnAI?.addEventListener('click', onAI);
    return () => btnAI?.removeEventListener('click', onAI);
  }, []);

  return (
    <>
      <Head>
        <title>NEXRoom • Cyber Neon Dashboard</title>
      </Head>
      <Script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js" strategy="afterInteractive" />

      <main style={{ paddingTop: 60, color: '#EDEAFF', minHeight: '100vh' }}>
        <canvas id="particles" style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none', opacity: 0.6 }} />
        <div className="aurora" />

        {/* Neon Menu */}
        <nav className="menu-bar">
          <a className="menu-item active" data-action="reserve" href="#">
            🏠 จองห้องพัก
          </a>
          <a className="menu-item" data-action="customers" href="#">
            👤 ดูข้อมูลลูกค้า
          </a>
          <a className="menu-item" data-action="meters" href="#">
            ⚡ บันทึกมิเตอร์
          </a>
          <a className="menu-item" data-action="invoices" href="#">
            💳 ตรวจสอบใบแจ้งหนี้
          </a>
        </nav>

        <div style={{ maxWidth: 1224, margin: '0 auto', padding: '0 16px', position: 'relative', zIndex: 2 }}>
          {/* Header */}
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="logo" />
              <div>
                <h1 style={{ fontSize: 18, margin: 0 }}>NEXRoom • Smart Dorm Dashboard</h1>
                <div className="bar" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span className="pill">หอพัก: <b>PD Place</b></span>
              <span className="pill">รอบบิล: <b>2025-10</b></span>
              <span className="pill">ผู้ใช้: <b>Manager</b></span>
            </div>
          </header>

          {/* KPI Zone */}
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(12, 1fr)' }}>
            <CardKPI span={3} title="อัตราเข้าพัก" value="88%" desc="176/200 ห้อง" chips={['ว่าง 18', 'จอง 6', 'ซ่อม 0']} />
            <CardKPI span={3} title="บิลค้างชำระ" value="32,400฿" desc="12 ห้อง" color="#ffb020" />
            <CardChart span={3} id="sparkRevenue" title="รายได้รับจริง (MTD)" value="486,900฿" color="#21d07a" />
            <CardChart span={3} id="sparkTickets" title="งานซ่อมคงค้าง" value="5" color="#ffd166" />

            {/* Main graph */}
            <section className="card" style={{ gridColumn: 'span 8', height: 260 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div className="label">แนวโน้มรายได้ & ค้างชำระ (6 เดือน)</div>
                  <div className="muted">Mock data • สำหรับสาธิต</div>
                </div>
                <span className="badge">฿ รายเดือน</span>
              </div>
              <div style={{ position: 'relative', height: 200 }}>
                <canvas id="mainLine" />
              </div>
            </section>

            {/* Ring */}
            <section className="card" style={{ gridColumn: 'span 4', display: 'grid', placeItems: 'center', height: 260 }}>
              <div className="label" style={{ position: 'absolute', top: 16, left: 16 }}>
                วงแหวนอัตราเข้าพัก
              </div>
              <div className="ring" style={{ '--deg': '316deg' } as any}>
                <div className="txt">88%</div>
              </div>
            </section>

            {/* Bar chart */}
            <section className="card" style={{ gridColumn: 'span 4', height: 260 }}>
              <div className="label">การใช้ไฟ/น้ำ (เฉลี่ยต่อห้อง)</div>
              <div style={{ position: 'relative', height: 180 }}>
                <canvas id="miniBars" />
              </div>
            </section>

            {/* Pie chart */}
            <section className="card" style={{ gridColumn: 'span 4', height: 260 }}>
              <div className="label">ช่องทางการชำระ</div>
              <div style={{ position: 'relative', height: 180 }}>
                <canvas id="piePay" />
              </div>
            </section>

            {/* AI Chat mock */}
            <section className="card" style={{ gridColumn: 'span 12' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="label">AI Command (Mock)</div>
                <span className="badge">ตัวอย่าง: “แสดงบิลค้างเดือนนี้”</span>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                <input
                  id="aiInput"
                  placeholder="พิมพ์คำสั่ง..."
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: '#ffffff10',
                    border: '1px solid #ffffff1a',
                    color: '#EDEAFF',
                    outline: 'none',
                  }}
                />
                <button className="cta" id="btnAI">
                  ส่ง
                </button>
              </div>
              <pre
                id="aiOut"
                className="muted"
                style={{
                  whiteSpace: 'pre-wrap',
                  marginTop: 10,
                  background: '#ffffff0c',
                  border: '1px solid #ffffff18',
                  padding: 12,
                  borderRadius: 12,
                }}
              >
                ผลลัพธ์จะปรากฏที่นี่…
              </pre>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

/* ---------- Reusable UI Components ---------- */
function CardKPI({ span, title, value, desc, color, chips }: any) {
  return (
    <section className="card" style={{ gridColumn: `span ${span}`, height: 160 }}>
      <div className="kpi" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="label">{title}</div>
          <div className="value" style={{ color }}>{value}</div>
        </div>
        <span className="badge">{desc}</span>
      </div>
      {chips && (
        <div className="row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {chips.map((c: string) => (
            <span key={c} className="chip">{c}</span>
          ))}
        </div>
      )}
    </section>
  );
}

function CardChart({ span, id, title, value, color }: any) {
 
