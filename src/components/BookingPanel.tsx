

'use client';
import React from 'react';
import { CalendarDays, User, Home, Wallet } from 'lucide-react';

// แปลงตัวเลขให้ปลอดภัย
const num = (x: any) => (typeof x === 'number' ? x : Number(x || 0));
// format TH
const fmtTH = (x: any) => num(x).toLocaleString('th-TH');

export default function BookingPanel({ data }: { data: any }) {
  if (!data) {
    return (
      <div className="p-6 text-center text-gray-400 text-sm border border-dashed rounded-xl">
        ยังไม่มีข้อมูลการจอง
      </div>
    );
  }

  const { room_no, start_date, message } = data;
  // รองรับทั้ง customer/tenants
  const customer = data.customer || data.tenants || {};
  const fullname = customer.fullname || customer.full_name || '-';
  const phone = customer.phone || '';

  const m = data.money || {};
  // รองรับหลายชื่อคีย์จาก n8n/DB
  const deposit = num(m.deposit ?? m.deposit_amount);
  const firstRent = num(m.first_rent ?? m.rent_first ?? m.first_month_rent ?? m.rent_per_month);
  const reserve = num(m.reserve ?? m.reserve_paid);
  const mustPayToday = m.must_pay_today !== undefined
    ? num(m.must_pay_today)
    : Math.max(deposit + firstRent - reserve, 0);

  return (
    <div
      className={[
        // พื้นหลัง/กรอบสว่างขึ้น โทนส้ม-ม่วง
        'rounded-2xl p-5',
        'bg-[radial-gradient(120%_140%_at_0%_0%,#2a1840_0%,#180f2c_52%,#0e0a1d_100%)]',
        'border border-white/15',
        'shadow-[0_0_25px_rgba(255,122,0,0.18)]',
        'outline outline-1 outline-orange-400/20',
        'transition-all hover:shadow-[0_0_36px_rgba(255,160,60,0.35)]',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-2 text-orange-400 font-semibold">
          <Home className="w-5 h-5" />
          <span>ห้อง {room_no || '-'}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-300 text-sm">
          <CalendarDays className="w-4 h-4" />
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
        <User className="w-4 h-4 text-gray-300" />
        <span className="font-medium">{fullname}</span>
        {phone ? <span className="text-gray-400">· {phone}</span> : null}
      </div>

      {/* Money blocks */}
<div
  className={[
    // บังคับ mobile = 2 คอลัมน์, md ขึ้นไป = 4 คอลัมน์
    'grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4',
    // กันทุกการ์ดหดเป็นแท่ง/บานล้น
    '[&>*]:min-w-0 [&>*]:shrink-0 items-stretch',
  ].join(' ')}
  // กันเคส CSS อื่นมากวน grid (Safari บางเครื่อง)
  style={{ gridAutoRows: '1fr' }}
>
  {/* มัดจำ */}
  <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 flex flex-col justify-between">
    <div className="text-xs text-gray-400">มัดจำ</div>
    <div className="text-[clamp(18px,5.2vw,22px)] font-bold text-gray-100 leading-tight">
      {fmtTH(deposit)}
    </div>
    <div className="text-[11px] text-gray-400">บาท</div>
  </div>

  {/* ค่าเช่าเดือนแรก */}
  <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 flex flex-col justify-between">
    <div className="text-xs text-gray-400">ค่าเช่าเดือนแรก</div>
    <div className="text-[clamp(18px,5.2vw,22px)] font-bold text-gray-100 leading-tight">
      {fmtTH(firstRent)}
    </div>
    <div className="text-[11px] text-gray-400">บาท</div>
  </div>

  {/* ยอดจอง */}
  <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 flex flex-col justify-between">
    <div className="text-xs text-gray-400">ยอดจอง</div>
    <div className="text-[clamp(18px,5.2vw,22px)] font-bold text-gray-100 leading-tight">
      {fmtTH(reserve)}
    </div>
    <div className="text-[11px] text-gray-400">บาท</div>
  </div>

  {/* ยอดรวมย้ายเข้า */}
  <div className="relative rounded-xl bg-gradient-to-br from-orange-500/15 to-amber-400/10 border border-orange-400/35 p-3 flex flex-col justify-between overflow-hidden">
    <div className="flex items-center gap-1 text-xs text-orange-300">
      <Wallet className="w-4 h-4" />
      <span className="truncate">ยอดรวมย้ายเข้า</span>
    </div>

    <div
      className="text-[clamp(22px,6vw,28px)] md:text-[clamp(22px,2.2vw,34px)] 
                 font-extrabold text-orange-200 leading-tight tabular-nums whitespace-nowrap pr-0.5"
      style={{ textShadow: '0 1px 2px rgba(0,0,0,.35)' }}
    >
      {fmtTH(mustPayToday)}
    </div>
    <div className="text-[11px] text-orange-200/80">บาท</div>

    {/* แสงวูบวาบ: เปิดตั้งแต่ md ขึ้นไป เพื่อไม่ทำให้จอเล็กเป็น “ดวงกลม” */}
    <span
      className="pointer-events-none hidden md:block absolute inset-y-0 -left-24 md:-left-36 w-24 md:w-32 
                 bg-gradient-to-r from-transparent via-white/50 to-transparent blur-md md:blur-lg"
      style={{ animation: 'shine 3.6s linear infinite' }}
    />
  </div>
</div>

      {/* Footer */}
      <div className="mt-5 text-xs text-gray-300/80 border-t border-white/10 pt-3">
        {message || 'บันทึกการจองสำเร็จ'}
      </div>
    </div>
  );
}
