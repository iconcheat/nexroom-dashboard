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
        // พื้นหลัง/กรอบ + โค้งมนมากขึ้น + กันล้นบนมือถือ
        'rounded-3xl p-4 sm:p-5 overflow-hidden',
        'bg-[radial-gradient(120%_140%_at_0%_0%,#2a1840_0%,#180f2c_52%,#0e0a1d_100%)]',
        'border border-white/15',
        'shadow-[0_0_25px_rgba(255,122,0,0.18)]',
        'outline outline-1 outline-orange-400/20',
        'transition-all hover:shadow-[0_0_36px_rgba(255,160,60,0.35)]',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <div className="flex items-center gap-2 text-orange-400 font-semibold">
          <Home className="w-5 h-5 shrink-0" />
          <span className="truncate">ห้อง {room_no || '-'}</span>
        </div>
        <div className="flex items-center gap-1 text-gray-300 text-xs sm:text-sm">
          <CalendarDays className="w-4 h-4 shrink-0" />
          <span className="tabular-nums">
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
        <span className="font-medium truncate">{fullname}</span>
        {phone ? <span className="text-gray-400">· {phone}</span> : null}
      </div>

      {/* Money blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* มัดจำ */}
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3 min-w-0">
          <div className="text-xs text-gray-400">มัดจำ</div>
          <div className="text-xl sm:text-2xl font-bold text-gray-100 tabular-nums break-words">
            {fmtTH(deposit)}
          </div>
          <div className="text-[11px] text-gray-400">บาท</div>
        </div>

        {/* ค่าเช่าเดือนแรก */}
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3 min-w-0">
          <div className="text-xs text-gray-400">ค่าเช่าเดือนแรก</div>
          <div className="text-xl sm:text-2xl font-bold text-gray-100 tabular-nums break-words">
            {fmtTH(firstRent)}
          </div>
          <div className="text-[11px] text-gray-400">บาท</div>
        </div>

        {/* ยอดจอง */}
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3 min-w-0">
          <div className="text-xs text-gray-400">ยอดจอง</div>
          <div className="text-xl sm:text-2xl font-bold text-gray-100 tabular-nums break-words">
            {fmtTH(reserve)}
          </div>
          <div className="text-[11px] text-gray-400">บาท</div>
        </div>

        {/* ยอดรวมย้ายเข้า (ขยาย 2 คอลัมน์บนจอเล็ก/กลาง เพื่อไม่ชิดขอบ) */}
        <div className="rounded-2xl bg-gradient-to-br from-orange-500/15 to-amber-400/10 border border-orange-400/35 p-3 min-w-0 sm:col-span-2 lg:col-span-1 relative overflow-hidden">
          <div className="flex items-center gap-1 text-xs text-orange-300">
            <Wallet className="w-4 h-4 shrink-0" />
            <span>ยอดรวมย้ายเข้า</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-orange-300 drop-shadow-sm tabular-nums break-words">
            {fmtTH(mustPayToday)}
          </div>
          <div className="text-[11px] text-orange-200/80">บาท</div>

          {/* แสงวิ่งเพิ่มมิติ */}
          <span className="pointer-events-none absolute -left-24 top-0 bottom-0 w-24 rotate-6 bg-gradient-to-r from-transparent via-white/30 to-transparent blur-md animate-[shine_3.8s_linear_infinite]" />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-5 text-xs text-gray-300/80 border-t border-white/10 pt-3">
        {message || 'บันทึกการจองสำเร็จ'}
      </div>

      {/* keyframes สำหรับแสงวิ่ง */}
      <style jsx>{`
        @keyframes shine {
          0% { transform: translateX(0) rotate(6deg); }
          100% { transform: translateX(140%) rotate(6deg); }
        }
      `}</style>
    </div>
  );
}