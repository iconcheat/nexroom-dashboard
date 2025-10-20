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
        'rounded-3xl p-4 md:p-5 w-full',
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
                  day: '2-digit', month: 'short', year: 'numeric',
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 [&>*]:min-w-0">
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

      {/* เอฟเฟกต์แสงสำหรับ highlight (เฉพาะจอ md ขึ้นไป เพื่อกันปัญหาจอเล็ก) */}
      <style jsx>{`
        @keyframes shine {
          0%   { transform: translateX(-60%) skewX(-20deg); opacity: .0; }
          20%  { opacity: .45; }
          100% { transform: translateX(160%) skewX(-20deg); opacity: 0; }
        }
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
  // ดีไซน์ใหม่: การ์ดไม่ใช้อัตราส่วนตายตัว (เลี่ยงกลายเป็นวงกลม)
  // ใช้ min-h + clamp ฟอนต์ ป้องกันเลขล้น/หาย ทั้งมือถือ/แท็บเล็ต/เดสก์ท็อป
  const base =
    'rounded-2xl p-3 md:p-4 min-h-[108px] md:min-h-[120px] relative overflow-hidden flex flex-col justify-between bg-clip-padding';
  const normal =
    'bg-[linear-gradient(145deg,rgba(90,55,35,0.35),rgba(40,25,18,0.30))] border border-[rgba(255,180,120,0.28)] shadow-[inset_0_0_0_1px_rgba(255,255,255,.05),0_8px_16px_rgba(0,0,0,.25)]';
  const high =
    'bg-[linear-gradient(145deg,rgba(255,145,60,0.22),rgba(110,60,30,0.24))] border border-orange-400/50 shadow-[0_0_20px_rgba(255,140,60,.35)]';

  return (
    <div className={[base, highlight ? high : normal].join(' ')}>
      {/* หัวการ์ด */}
      <div
        className={[
          'flex items-center gap-1 text-[11px] md:text-xs leading-none',
          highlight ? 'text-orange-200' : 'text-amber-200/80',
        ].join(' ')}
      >
        {icon || null}
        <span className="truncate">{label}</span>
      </div>

      {/* ตัวเลข — ยืดหยุ่น ไม่ล้น/ไม่โดนตัด, คมชัดบน iOS */}
      <div
        className={[
          'text-white font-extrabold tabular-nums leading-tight',
          'tracking-tight',
          // ใช้ clamp ให้โตตามความกว้าง แต่มีเพดานไม่ล้น
          highlight
            ? 'text-[clamp(22px,6.2vw,40px)] md:text-[clamp(26px,2.8vw,44px)]'
            : 'text-[clamp(20px,5.5vw,32px)] md:text-[clamp(22px,2.4vw,36px)]',
        ].join(' ')}
        style={{
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          // กันโดนขอบขวาตัด 1–2px (Safari)
          paddingRight: 2,
          // ถ้าพื้นหลังสว่างขึ้นในอนาคต เลขยังคมชัด
          textShadow: '0 1px 2px rgba(0,0,0,.35)',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>

      {/* หน่วย */}
      <div
        className={[
          'text-[10px] md:text-xs leading-none',
          highlight ? 'text-orange-200/85' : 'text-amber-200/70',
        ].join(' ')}
      >
        บาท
      </div>

      {/* แสงวูบวาบ: ปิดบนจอเล็ก เพื่อไม่ให้เป็น "จุดวงกลม" */}
      {highlight && (
        <span
          className="pointer-events-none absolute inset-y-0 -left-24 md:-left-36 w-24 md:w-32 bg-gradient-to-r from-transparent via-white/50 to-transparent blur-md md:blur-lg hidden md:block"
          style={{ animation: 'shine 3.6s linear infinite' }}
        />
      )}
    </div>
  );
}