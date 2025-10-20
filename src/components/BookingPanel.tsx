'use client';
import React from 'react';
import { CalendarDays, User, Home, Wallet } from 'lucide-react';

// helpers (เดิม)
const num = (x: any) => (typeof x === 'number' ? x : Number(x || 0));
const fmtTH = (x: any) => num(x).toLocaleString('th-TH');

export default function BookingPanel({ data }: { data: any }) {
  if (!data) {
    return (
      <div className="p-6 text-center text-gray-400 text-sm border border-dashed rounded-2xl">
        ยังไม่มีข้อมูลการจอง
      </div>
    );
  }

  const { room_no, start_date, message } = data;
  const customer = data.customer || data.tenants || {};
  const fullname = customer.fullname || customer.full_name || '-';
  const phone = customer.phone || '';

  const m = data.money || {};
  const deposit   = num(m.deposit ?? m.deposit_amount);
  const firstRent = num(m.first_rent ?? m.rent_first ?? m.first_month_rent ?? m.rent_per_month);
  const reserve   = num(m.reserve ?? m.reserve_paid);
  const mustPayToday =
    m.must_pay_today !== undefined
      ? num(m.must_pay_today)
      : Math.max(deposit + firstRent - reserve, 0);

  return (
    <div
      className={[
        'rounded-3xl p-4 md:p-5 overflow-visible w-full', // overflow-visible กันเลขโดนตัดที่ขอบการ์ด
        'bg-[radial-gradient(120%_140%_at_0%_0%,#2a1840_0%,#180f2c_52%,#0e0a1d_100%)]',
        'border border-white/15 shadow-[0_0_25px_rgba(255,122,0,0.18)] outline outline-1 outline-orange-400/20',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4 md:mb-5">
        <div className="flex items-center gap-2 text-orange-400 font-semibold min-w-0">
          <Home className="w-5 h-5 shrink-0" />
          <span className="truncate">ห้อง {room_no || '-'}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-300 text-xs md:text-sm">
          <CalendarDays className="w-4 h-4 shrink-0" />
          <span>
            {start_date
              ? new Date(start_date).toLocaleDateString('th-TH', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })
              : '-'}
          </span>
        </div>
      </div>

      {/* Customer */}
      <div className="flex items-center gap-2 text-sm text-gray-100 mb-4 min-w-0">
        <User className="w-4 h-4 text-gray-300 shrink-0" />
        <span className="font-medium truncate">{fullname}</span>
        {phone ? <span className="text-gray-400 shrink-0">· {phone}</span> : null}
      </div>

      {/* Money cards: mobile 2x2, desktop 4 คอลัมน์ */}
      <div
        className={[
          // บังคับ 2 คอลัมน์บนมือถือ, 4 คอลัมน์ตั้งแต่ md ขึ้นไป
          'grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4',
          // ทำให้คอลัมน์รับพื้นที่เท่า ๆ กัน และการ์ดไม่หดจนกลายเป็นแท่งแคบ
          '[&>*]:min-w-0 auto-rows-fr',
        ].join(' ')}
      >
        <MoneyCard label="มัดจำ" value={fmtTH(deposit)} />
        <MoneyCard label="ค่าเช่าเดือนแรก" value={fmtTH(firstRent)} />
        <MoneyCard label="ยอดจอง" value={fmtTH(reserve)} />
        <MoneyCard
          label="ยอดรวมย้ายเข้า"
          value={fmtTH(mustPayToday)}
          highlight
          icon={<Wallet className="w-4 h-4" />}
        />
      </div>

      {/* Footer */}
      <div className="mt-5 text-xs text-gray-300/80 border-t border-white/10 pt-3">
        {message || 'บันทึกการจองสำเร็จ'}
      </div>

      <style jsx>{`
        @keyframes shine { 0% { transform: translateX(-80%) skewX(-20deg); }
                           100% { transform: translateX(180%) skewX(-20deg); } }
      `}</style>
    </div>
  );
}

/* ---------- Card ---------- */
function MoneyCard({
  label,
  value,
  highlight = false,
  icon,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  icon?: React.ReactNode;
}) {
  // หมายเหตุ:
  // - ใช้ aspect และ padding ให้การ์ด “ดูหนา” เหมือนเดสก์ท็อปบนมือถือ
  // - ใช้ clamp() ให้ขนาดตัวเลขยืดหยุ่น ไม่ล้น และไม่เล็กเกินไป
  // - min-w-0 ป้องกันไม่ให้ grid บีบการ์ดจนกลายเป็นเสาแคบ

  const base =
    'rounded-2xl p-3 sm:p-4 aspect-[7/5] w-full relative overflow-hidden flex flex-col justify-between min-w-0';
  const normal =
    'bg-[linear-gradient(145deg,rgba(90,55,35,0.35),rgba(40,25,18,0.30))] border border-[rgba(255,180,120,0.28)] shadow-[inset_0_0_0_1px_rgba(255,255,255,.05),0_8px_16px_rgba(0,0,0,.25)]';
  const high =
    'bg-[linear-gradient(145deg,rgba(255,145,60,0.20),rgba(110,60,30,0.22))] border border-orange-400/45 shadow-[0_0_18px_rgba(255,140,60,.35)]';

  return (
    <div className={[base, highlight ? high : normal].join(' ')}>
      {/* หัวการ์ด */}
      <div
        className={[
          'flex items-center gap-1 text-[11px] sm:text-xs leading-none',
          highlight ? 'text-orange-200' : 'text-amber-200/80',
        ].join(' ')}
      >
        {icon || null}
        <span className="truncate">{label}</span>
      </div>

      {/* ตัวเลข — ปรับขนาดอัตโนมัติไม่ล้น/ไม่ตกขอบ */}
      <div
        className={[
          'text-white font-extrabold tabular-nums leading-tight whitespace-nowrap',
          // ปรับด้วย clamp: มือถือจะใหญ่ขึ้นตามความกว้าง, เดสก์ท็อปไม่เกินเพดาน
          highlight
            ? 'text-[clamp(24px,6vw,40px)] md:text-[clamp(28px,3.2vw,44px)]'
            : 'text-[clamp(20px,5vw,32px)] md:text-[clamp(24px,2.8vw,36px)]',
        ].join(' ')}
        style={{ paddingRight: 2 }} // กันโดนขอบขวาตัด 1–2px
      >
        {value}
      </div>

      {/* หน่วย */}
      <div
        className={[
          'text-[10px] sm:text-[11px] md:text-xs leading-none',
          highlight ? 'text-orange-200/80' : 'text-amber-200/70',
        ].join(' ')}
      >
        บาท
      </div>

      {/* แสงเฉพาะ highlight */}
      {highlight && (
        <span
          className="pointer-events-none absolute inset-y-0 -left-24 w-28 bg-gradient-to-r from-transparent via-white/40 to-transparent blur-md"
          style={{ animation: 'shine 3.6s linear infinite' }}
        />
      )}
    </div>
  );
}