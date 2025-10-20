'use client';
import React from 'react';
import { CalendarDays, User, Home, Wallet } from 'lucide-react';

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
        'rounded-3xl p-4 sm:p-5 overflow-hidden',
        'bg-[radial-gradient(120%_140%_at_0%_0%,#2a1840_0%,#180f2c_52%,#0e0a1d_100%)]',
        'border border-white/15',
        'shadow-[0_0_25px_rgba(255,122,0,0.18)]',
        'outline outline-1 outline-orange-400/20',
        'transition-all hover:shadow-[0_0_36px_rgba(255,160,60,0.35)]',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4 sm:mb-5">
        <div className="flex items-center gap-2 text-orange-400 font-semibold">
          <Home className="w-5 h-5 shrink-0" />
          <span>ห้อง {room_no || '-'}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-300 text-xs sm:text-sm">
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
      <div className="flex items-center gap-2 text-sm text-gray-100 mb-4">
        <User className="w-4 h-4 text-gray-300 shrink-0" />
        <span className="font-medium">{fullname}</span>
        {phone ? <span className="text-gray-400">· {phone}</span> : null}
      </div>

      {/* Money blocks: มือถือ 2 คอลัมน์ (2 แถว), เดสก์ท็อป 4 คอลัมน์ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* แถว 1 */}
        <MoneyBlock label="มัดจำ" value={fmtTH(deposit)} />
        <MoneyBlock label="ค่าเช่าเดือนแรก" value={fmtTH(firstRent)} />

        {/* แถว 2 */}
        <MoneyBlock label="ยอดจอง" value={fmtTH(reserve)} />
        <MoneyBlock
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

      {/* keyframes สำหรับแสงวูบวาบ */}
      <style jsx>{`
        @keyframes shine {
          0% { transform: translateX(-80%) skewX(-20deg); }
          100% { transform: translateX(180%) skewX(-20deg); }
        }
      `}</style>
    </div>
  );
}

/** ---- Sub component ---- */
function MoneyBlock({
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
  return (
    <div
      className={[
        'rounded-2xl p-3 sm:p-4 min-w-0 relative overflow-hidden',
        highlight
          ? 'bg-gradient-to-br from-orange-500/15 to-amber-400/10 border border-orange-400/35'
          : 'bg-white/[0.04] border border-white/10',
        'flex flex-col justify-center',
      ].join(' ')}
    >
      <div
        className={[
          'flex items-center gap-1 text-xs sm:text-sm',
          highlight ? 'text-orange-300' : 'text-gray-400',
        ].join(' ')}
      >
        {icon || null}
        <span>{label}</span>
      </div>

      {/* บังคับไม่ตัดบรรทัดกันตัวเลขแตกเป็นเสา */}
      <div
        className={[
          'font-extrabold tracking-tight tabular-nums leading-tight whitespace-nowrap',
          highlight
            ? 'text-orange-300 text-2xl sm:text-3xl'
            : 'text-gray-100 text-xl sm:text-2xl',
        ].join(' ')}
      >
        {value}
      </div>

      <div
        className={[
          'text-[11px] sm:text-xs',
          highlight ? 'text-orange-200/80' : 'text-gray-400',
        ].join(' ')}
      >
        บาท
      </div>

      {/* แสงวูบวาบเฉพาะกล่อง highlight */}
      {highlight && (
        <span
          className="pointer-events-none absolute inset-y-0 -left-24 w-28 bg-gradient-to-r from-transparent via-white/35 to-transparent blur-md"
          style={{ animation: 'shine 3.6s linear infinite' }}
        />
      )}
    </div>
  );
}