'use client';
import React from 'react';
import { CalendarDays, User, Home, Wallet } from 'lucide-react';
const num = (x:any)=> (typeof x==='number'?x:Number(x||0));
const fmtTH = (x:any)=> num(x).toLocaleString('th-TH');
export default function BookingPanel({data}:{data:any}){
  if(!data){return(<div className="p-6 text-center text-gray-400 text-sm border border-dashed rounded-xl">ยังไม่มีข้อมูลการจอง</div>);}
  const {room_no,start_date,message}=data;
  const customer=data.customer||data.tenants||{}; const fullname=customer.fullname||customer.full_name||'-'; const phone=customer.phone||'';
  const m=data.money||{}; const deposit=num(m.deposit??m.deposit_amount); const firstRent=num(m.first_rent??m.rent_first??m.first_month_rent??m.rent_per_month); const reserve=num(m.reserve??m.reserve_paid); const mustPayToday=m.must_pay_today!==undefined?num(m.must_pay_today):Math.max(deposit+firstRent-reserve,0);
  return(
    <div className={['rounded-2xl p-5','bg-[radial-gradient(120%_140%_at_0%_0%,#2a1840_0%,#180f2c_52%,#0e0a1d_100%)]','border border-white/15','shadow-[0_0_25px_rgba(255,122,0,0.18)]','outline outline-1 outline-orange-400/20','transition-all hover:shadow-[0_0_36px_rgba(255,160,60,0.35)]'].join(' ')}>
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-2 text-orange-400 font-semibold"><Home className="w-5 h-5"/><span>ห้อง {room_no||'-'}</span></div>
        <div className="flex items-center gap-1 text-gray-300 text-sm"><CalendarDays className="w-4 h-4"/><span>{start_date?new Date(start_date).toLocaleDateString('th-TH',{day:'2-digit',month:'short',year:'numeric'}):'-'}</span></div>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-100 mb-4"><User className="w-4 h-4 text-gray-300"/><span className="font-medium">{fullname}</span>{phone?<span className="text-gray-400">· {phone}</span>:null}</div>

      {/* GRID: มือถือ 2 คอลัมน์ (การ์ดกว้างขึ้น), เดสก์ท็อป 4 คอลัมน์ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 items-stretch" style={{gridAutoRows:'1fr'}}>
        <div className="min-w-[160px] rounded-2xl bg-white/[0.045] border border-white/10 p-4 flex flex-col justify-between">
          <div className="text-[11px] text-gray-400 leading-snug">มัดจำ</div>
          <div className="text-[clamp(20px,6vw,24px)] font-extrabold text-gray-100 leading-tight tabular-nums">{fmtTH(deposit)}</div>
          <div className="text-[11px] text-gray-400">บาท</div>
        </div>
        <div className="min-w-[160px] rounded-2xl bg-white/[0.045] border border-white/10 p-4 flex flex-col justify-between">
          <div className="text-[11px] text-gray-400 leading-snug">ค่าเช่าเดือนแรก</div>
          <div className="text-[clamp(20px,6vw,24px)] font-extrabold text-gray-100 leading-tight tabular-nums">{fmtTH(firstRent)}</div>
          <div className="text-[11px] text-gray-400">บาท</div>
        </div>
        <div className="min-w-[160px] rounded-2xl bg-white/[0.045] border border-white/10 p-4 flex flex-col justify-between">
          <div className="text-[11px] text-gray-400 leading-snug">ยอดจอง</div>
          <div className="text-[clamp(20px,6vw,24px)] font-extrabold text-gray-100 leading-tight tabular-nums">{fmtTH(reserve)}</div>
          <div className="text-[11px] text-gray-400">บาท</div>
        </div>
        <div className="min-w-[160px] relative rounded-2xl bg-gradient-to-br from-orange-500/15 to-amber-400/10 border border-orange-400/35 p-4 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center gap-1 text-[11px] text-orange-300 leading-snug"><Wallet className="w-4 h-4"/><span className="truncate">ยอดรวมย้ายเข้า</span></div>
          <div className="text-[clamp(22px,6.4vw,28px)] md:text-[clamp(22px,2.2vw,34px)] font-extrabold text-orange-200 leading-tight tabular-nums whitespace-nowrap pr-0.5" style={{textShadow:'0 1px 2px rgba(0,0,0,.35)'}}>{fmtTH(mustPayToday)}</div>
          <div className="text-[11px] text-orange-200/80">บาท</div>
          <span className="pointer-events-none hidden md:block absolute inset-y-0 -left-24 md:-left-36 w-24 md:w-32 bg-gradient-to-r from-transparent via-white/50 to-transparent blur-md md:blur-lg" style={{animation:'shine 3.6s linear infinite'}}/>
        </div>
      </div>

      <div className="mt-5 text-xs text-gray-300/80 border-t border-white/10 pt-3">{message||'บันทึกการจองสำเร็จ'}</div>
      <style jsx>{`@keyframes shine{0%{transform:translateX(-60%) skewX(-20deg);opacity:0;}20%{opacity:.45;}100%{transform:translateX(160%) skewX(-20deg);opacity:0;}}`}</style>
    </div>
  );
}