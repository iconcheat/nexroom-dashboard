'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function TopbarPortal() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = document.createElement('div');
    el.id = 'nxrTopbarHost';
    el.style.position = 'absolute';
    el.style.top = '0';
    el.style.left = '0';
    document.body.appendChild(el);
    setHost(el);
    return () => { document.body.removeChild(el); };
  }, []);

  if (!host) return null;

  return createPortal(
    <nav
      id="nxrTopbar"
      style={{
        position: 'fixed',
        top: '12px',
        right: '40px',
        display: 'flex',
        gap: '1.2rem',
        padding: '10px 20px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, rgba(255,122,0,.85), rgba(138,43,226,.85))',
        boxShadow: '0 0 30px rgba(255,122,0,.4), 0 0 40px rgba(138,43,226,.3)',
        border: '1px solid rgba(255,255,255,.15)',
        backdropFilter: 'blur(10px)',
        color: '#fff',
        fontWeight: 600,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        transition: 'all .3s ease',
      }}
    >
      {[
        ['🏠 จองห้องพัก', 'reserve'],
        ['👤 ข้อมูลลูกค้า', 'customers'],
        ['⚡ บันทึกมิเตอร์', 'meters'],
        ['💳 ใบแจ้งหนี้', 'invoices'],
      ].map(([label, key]) => (
        <a
          key={key}
          href="#"
          style={{
            color: '#fff',
            textDecoration: 'none',
            padding: '8px 12px',
            borderRadius: '10px',
            transition: 'all .25s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,.12)';
            e.currentTarget.style.boxShadow = '0 0 10px rgba(255,255,255,.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {label}
        </a>
      ))}
    </nav>,
    host
  );
}