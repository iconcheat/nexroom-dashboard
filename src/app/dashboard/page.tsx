'use client';
import { useEffect } from 'react';
import Head from 'next/head';
import Script from 'next/script';

export default function DashboardPage() {
  // === Particle Effect ===
  useEffect(() => {
    const cvs = document.getElementById('particles') as HTMLCanvasElement | null;
    if (!cvs) return;
    const ctx = cvs.getContext('2d')!;
    let W = 0, H = 0, PR = 1;
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
    window.addEventListener('resize', resize);
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

  // === Menu mock ===
  useEffect(() => {
    const links = document.querySelectorAll<HTMLAnchorElement>('.menu-item');
    const onClick = (e: Event) => {
      e.preventDefault();
      links.forEach(x => x.classList.remove('active'));
      const a = e.currentTarget as HTMLAnchorElement;
      a.classList.add('active');
      alert('เมนู: ' + (a.dataset.action || ''));
    };
    links.forEach(a => a.addEventListener('click', onClick));
    return () => links.forEach(a => a.removeEventListener('click', onClick));
  }, []);

  // === Chart.js ===
  useEffect(() => {
    const Chart = (window as any).Chart;
    if (!Chart) return;
    const fmt = new Intl.NumberFormat('th-TH');

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

    const line = (id: string, data: any) => {
      const el = document.getElementById(id) as HTMLCanvasElement;
      if (!el) return;
      new Chart(el, { type: 'line', ...data });
    };

    line('mainLine', {
      data: {
        labels: ['พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.'],
        datasets: [
          {
            label: 'รายได้',
            data: [430000, 452000, 470000, 455000, 479000, 486900],
            borderColor: '#FF7A00',
            backgroundColor: (c: any) => {
              const g = c.chart.ctx.createLinearGradient(0, 0, 0, 220);
              g.addColorStop(0, 'rgba(255,122,0,.35)');
              g.addColorStop(1, 'rgba(255,122,0,0)');
              return g;
            },
            fill: true,
            tension: 0.35,
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
      },
      options: baseOpts,
    });

    const miniBars = document.getElementById('miniBars') as HTMLCanvasElement;
    if (miniBars)
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

    const pie = document.getElementById('piePay') as HTMLCanvasElement;
    if (pie)
      new Chart(pie, {
        type: 'doughnut',
        data: {
          labels: ['PromptPay', 'โอน', 'เงินสด'],
          datasets: [{ data: [62, 33, 5], backgroundColor: ['#FF7A00', '#8A2BE2', '#FF5BD6'] }],
        },
        options: { ...baseOpts, cutout: '62%' },
      });
  }, []);

  // === AI Chat mock ===
  useEffect(() => {
    const btn = document.getElementById('btnAI');
    const out = document.getElementById('aiOut');
    const inp = document.getElementById('aiInput') as HTMLInputElement;
    const run = () => {
      if (!out || !inp) return;
      const q = inp.value.trim();
      if (!q) {
        out.textContent = 'พิมพ์คำสั่ง เช่น “แสดงบิลค้างเดือนนี้”';
        return;
      }
      out.textContent =
        `🧠 Intent: SHOW_OVERDUE_INVOICES\n✅ มีบิลค้างชำระ 12 รายการ รวม 32,400 บาท\n\n• ห้อง A305 · งวด 2025-10 · ฿3,200\n• ห้อง B412 · งวด 2025-10 · ฿2,800\n• ห้อง C208 · งวด 2025-09 · ฿3,000\n\nℹ️ อ้างอิง mock data`;
    };
    btn?.addEventListener('click', run);
    return () => btn?.removeEventListener('click', run);
  }, []);

  return (
    <>
      <Head>
        <title>NEXRoom • Cyber Neon Dashboard</title>
        <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@400;500;600;700&family=Inter:wght@400;600;800&display=swap" rel="stylesheet" />
      </Head>
      <Script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js" strategy="afterInteractive" />

      <main className="bg-grid">
        <canvas id="particles" />
        <div className="aurora" />

        <nav className="menu-bar">
          <a className="menu-item active" data-action="reserve" href="#">🏠 จองห้องพัก</a>
          <a className="menu-item" data-action="customers" href="#">👤 ข้อมูลลูกค้า</a>
          <a className="menu-item" data-action="meters" href="#">⚡ บันทึกมิเตอร์</a>
          <a className="menu-item" data-action="invoices" href="#">💳 ใบแจ้งหนี้</a>
        </nav>

        <div className="wrap">
          <header>
            <div className="brand">
              <div className="logo" />
              <div>
                <h1>NEXRoom • Smart Dorm Dashboard</h1>
                <div className="bar" />
              </div>
            </div>
            <div className="row">
              <span className="pill">หอพัก: <b>PD Place</b></span>
              <span className="pill">รอบบิล: <b>2025-10</b></span>
              <span className="pill">ผู้ใช้: <b>Manager</b></span>
            </div>
          </header>

          <div className="grid">
            <section className="card col-3"><div className="kpi"><div><div className="label">อัตราเข้าพัก</div><div className="value">88%</div></div><span className="badge">176/200 ห้อง</span></div><div className="row"><span className="chip">ว่าง 18</span><span className="chip">จอง 6</span></div></section>
            <section className="card col-3"><div className="kpi"><div><div className="label">บิลค้างชำระ</div><div className="value" style={{ color: '#ffb020' }}>32,400฿</div></div><span className="badge">12 ห้อง</span></div></section>
            <section className="card col-3"><div className="kpi"><div><div className="label">รายได้รับจริง (MTD)</div><div className="value" style={{ color: '#21d07a' }}>486,900฿</div></div></div><canvas id="sparkRevenue" /></section>
            <section className="card col-3"><div className="kpi"><div><div className="label">งานซ่อมคงค้าง</div><div className="value" style={{ color: '#ffd166' }}>5</div></div></div><canvas id="sparkTickets" /></section>

            <section className="card col-8"><div className="label">แนวโน้มรายได้ & ค้างชำระ (6 เดือน)</div><div style={{ height: 200 }}><canvas id="mainLine" /></div></section>
            <section className="card col-4"><div className="label">วงแหวนอัตราเข้าพัก</div><div className="ring" style={{ '--deg': '316deg' } as any}><div className="txt">88%</div></div></section>

            <section className="card col-4"><div className="label">การใช้ไฟ/น้ำ</div><div style={{ height: 180 }}><canvas id="miniBars" /></div></section>
            <section className="card col-4"><div className="label">ช่องทางการชำระ</div><div style={{ height: 180 }}><canvas id="piePay" /></div></section>

            <section className="card col-12">
              <div className="label">AI Command (Mock)</div>
              <div className="row">
                <input id="aiInput" placeholder="พิมพ์คำสั่ง..." className="ai-input" />
                <button id="btnAI" className="cta">ส่ง</button>
              </div>
              <pre id="aiOut" className="ai-out">ผลลัพธ์จะปรากฏที่นี่…</pre>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}