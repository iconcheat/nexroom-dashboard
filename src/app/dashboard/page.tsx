'use client';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Script from 'next/script';

export default function DashboardPage() {
    // === Agent/Events State ===
  const [summary, setSummary] = useState<any | null>(null);
  const [paying, setPaying] = useState(false);

  // ใช้ dormId จริงของคุณ (เช่นมาจาก session); ใส่ค่าชั่วคราวไปก่อน
  const dormId = 'PD-PLACE';

  // n8n cash webhook (ต้องตั้ง NEXT_PUBLIC_N8N_CASH_WEBHOOK ใน .env)
  const CASH_WEBHOOK = '/api/payments/cash';

  const fmtTH = (n: number) =>
    typeof n === 'number' ? n.toLocaleString('th-TH') : String(n ?? '');

  // กด "ชำระเงินสดตอนนี้"
  const handlePayCashNow = async () => {
    if (!summary) return alert('ยังไม่มีข้อมูลสรุป');
    if (!CASH_WEBHOOK) return alert('ยังไม่ได้ตั้ง NEXT_PUBLIC_N8N_CASH_WEBHOOK');

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
          job_id: summary.job_id || undefined, // ถ้ามี
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
  // === Particle Effect ===
    // === SSE: ฟังอีเวนต์จาก Agent (/api/ai/stream?dorm_id=...) ===
  useEffect(() => {
  let es: EventSource | null = null;
  let retry = 0;

  const connect = () => {
    es = new EventSource(`/api/ai/stream?dorm_id=${encodeURIComponent(dormId)}`);

    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data || '{}');
        const event = msg.event || msg?.data?.event;
        const data  = msg.data  || msg;

        if (event === 'reserve_summary') setSummary(data);
        if (event === 'payment_done') {
          setSummary(prev => {
            if (!prev) return prev;
            const sameBooking = !prev.booking_id || prev.booking_id === (data?.booking_id || prev.booking_id);
            if (!sameBooking) return prev;
            const paid = Number(data?.amount ?? 0);
            const remain = Math.max(0, Number(prev.money?.remain_today ?? 0) - paid);
            return {
              ...prev,
              money: {
                ...(prev.money || {}),
                paid_today: Number(prev.money?.paid_today || 0) + paid,
                remain_today: remain,
              },
            };
          });
        }
      } catch {}
    };

    es.onerror = () => {
      es?.close();
      const backoff = Math.min(1000 * Math.pow(2, retry++), 15000); // 1s → 2s → 4s … capped 15s
      setTimeout(connect, backoff);
    };
  };

  connect();
  return () => { es?.close(); };
}, [dormId]);

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

  /* ===== AI Chat จริง (เรียก API /api/ai) ===== */
useEffect(() => {
  const btn = document.getElementById('btnAI');
  const out = document.getElementById('aiOut');
  const inp = document.getElementById('aiInput') as HTMLInputElement;

  const run = async () => {
    if (!out || !inp) return;
    const q = inp.value.trim();
    if (!q) {
      out.textContent = 'พิมพ์คำสั่ง เช่น “แสดงบิลค้างเดือนนี้”';
      return;
    }

    out.textContent = '⌛ กำลังประมวลผล...';
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: q }),
      });
      const data = await res.json();

      if (data.ok) {
  let result = data.reply || '✅ สำเร็จ';

  if (Array.isArray(data.results)) {
    result += '\n\n' + data.results.map((r: any) =>
      `• ห้อง ${r.room} · งวด ${r.period} · ฿${r.amount.toLocaleString('th-TH')}`
    ).join('\n');
  }

  if (data.logs?.length) result += '\n\n🪶 Log:\n' + data.logs.join('\n');
  out.textContent = result;

  // ✅ แสดงปุ่ม Action ถ้ามี
  const actionBox = document.getElementById('aiActions');
  if (actionBox) {
    actionBox.innerHTML = '';
    if (Array.isArray(data.actions)) {
      data.actions.forEach((a: any) => {
        if (a.type === 'open_url') {
          const btn = document.createElement('a');
          btn.href = a.url;
          btn.target = '_blank';
          btn.textContent = a.label || 'เปิดลิงก์';
          btn.className = 'cta';
          actionBox.appendChild(btn);
        }
      });
    }
  }
} else {
        out.textContent = '❌ ' + (data.error || 'เกิดข้อผิดพลาดจาก AI');
      }
    } catch (err: any) {
      out.textContent = '❌ ไม่สามารถเชื่อมต่อได้ (' + err.message + ')';
    }
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

            <section className="card col-4" id="reserveSummary">
  <div className="label">สรุปการจองล่าสุด</div>

  {!summary ? (
    <div className="muted" style={{ padding: 12 }}>
      ยังไม่มีอีเวนต์ <code>reserve_summary</code> — รอการจองเสร็จจาก Worker
    </div>
  ) : (
    <>
      <div className="kpi" style={{ marginBottom: 8 }}>
        <div>
          <div className="label">ต้องจ่ายวันนี้</div>
          <div className="value" style={{ color: '#21d07a' }}>
            {fmtTH(Number(summary?.money?.must_pay_today || 0))}฿
          </div>
        </div>
        <span className="badge">{summary.room_no || ''}</span>
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0', lineHeight: 1.6 }}>
        <li>มัดจำ: ฿{fmtTH(Number(summary?.money?.deposit || 0))}</li>
        <li>ค่าจอง: ฿{fmtTH(Number(summary?.money?.reserve || 0))}</li>
        <li>ค่าเช่าเดือนแรก: ฿{fmtTH(Number(summary?.money?.first_month_rent || 0))}</li>
        {Number(summary?.money?.other_fee || 0) > 0 && (
          <li>อื่น ๆ: ฿{fmtTH(Number(summary?.money?.other_fee || 0))}</li>
        )}
        <li>ชำระแล้ววันนี้: ฿{fmtTH(Number(summary?.money?.paid_today || 0))}</li>
        <li><b>คงเหลือวันนี้: ฿{fmtTH(Number(summary?.money?.remain_today || 0))}</b></li>
      </ul>

      <div className="row" style={{ gap: 8, marginTop: 8 }}>
        <button className="cta" onClick={handlePayCashNow} disabled={paying}>
          {paying ? 'กำลังบันทึก…' : 'ชำระเงินสดตอนนี้'}
        </button>
        {/* ออปชัน: ปุ่มอื่นจาก next_actions */}
        {(summary.next_actions || [])
          .filter((a: any) => a.type !== 'pay_cash_now')
          .slice(0, 2)
          .map((a: any, i: number) => (
            <button key={i} className="cta" onClick={() => alert('TODO: ' + a.type)}>
              {a.label || a.type}
            </button>
          ))}
      </div>
    </>
  )}
</section>
            <section className="card col-4"><div className="label">ช่องทางการชำระ</div><div style={{ height: 180 }}><canvas id="piePay" /></div></section>

            <section className="card col-12">
              <div className="label">AI Command (Mock)</div>
              <div className="row">
                <input id="aiInput" placeholder="พิมพ์คำสั่ง..." className="ai-input" />
                <button id="btnAI" className="cta">ส่ง</button>
              </div>
              <pre id="aiOut" className="ai-out">ผลลัพธ์จะปรากฏที่นี่…</pre>
              <div id="aiActions" style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 10 }}></div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}