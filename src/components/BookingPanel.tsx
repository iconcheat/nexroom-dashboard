'use client';
import React from 'react';
import { CalendarDays, User, Home, Wallet } from 'lucide-react';

const num = (x:any)=>(typeof x==='number'?x:Number(x||0));
const fmtTH = (x:any)=> num(x).toLocaleString('th-TH');

export default function BookingPanel({data}:{data:any}){
  if(!data){return(<div className="p-6 text-center text-gray-400 text-sm border border-dashed rounded-xl">ยังไม่มีข้อมูลการจอง</div>);}
  const {room_no,start_date,message}=data;
  const customer=data.customer||data.tenants||{};
  const fullname=customer.fullname||customer.full_name||'-';
  const phone=customer.phone||'';
  const m=data.money||{};
  const deposit=num(m.deposit??m.deposit_amount);
  const firstRent=num(m.first_rent??m.rent_first??m.first_month_rent??m.rent_per_month);
  const reserve=num(m.reserve??m.reserve_paid);
  const mustPayToday=m.must_pay_today!==undefined?num(m.must_pay_today):Math.max(deposit+firstRent-reserve,0);

  return (
    <div className={['rounded-2xl p-5',
      'bg-[radial-gradient(120%_140%_at_0%_0%,#2a1840_0%,#180f2c_52%,#0e0a1d_100%)]',
      'border border-white/15 shadow-[0_0_25px_rgba(255,122,0,0.18)] outline outline-1 outline-orange-400/20'
    ].join(' ')}>
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-2 text-orange-400 font-semibold"><Home className="w-5 h-5"/><span>ห้อง {room_no||'-'}</span></div>
        <div className="flex items-center gap-1 text-gray-300 text-sm"><CalendarDays className="w-4 h-4"/><span>{start_date?new Date(start_date).toLocaleDateString('th-TH',{day:'2-digit',month:'short',year:'numeric'}):'-'}</span></div>
      </div>

      {/* Customer */}
      <div className="flex items-center gap-2 text-sm text-gray-100 mb-4">
        <User className="w-4 h-4 text-gray-300"/><span className="font-medium">{fullname}</span>{phone?<span className="text-gray-400">· {phone}</span>:null}
      </div>

      {/* --- MOBILE: horizontal scroll row (fix card width = desktop) --- */}
      <div className="md:hidden -mx-5 px-5 overflow-x-auto" style={{ WebkitOverflowScrolling:'touch' }}>
        <div className="flex gap-4 snap-x snap-mandatory w-max">
          <Card label="มัดจำ" value={fmtTH(deposit)} className="basis-[260px] shrink-0 snap-start"/>
          <Card label="ค่าเช่าเดือนแรก" value={fmtTH(firstRent)} className="basis-[260px] shrink-0 snap-start"/>
          <Card label="ยอดจอง" value={fmtTH(reserve)} className="basis-[260px] shrink-0 snap-start"/>
          <Card label="ยอดรวมย้ายเข้า" value={fmtTH(mustPayToday)} highlight className="basis-[260px] shrink-0 snap-start"/>
        </div>
      </div>

      {/* --- DESKTOP/TABLET: 4-cols grid as usual --- */}
      <div className="hidden md:grid grid-cols-4 gap-5">
        <Card label="มัดจำ" value={fmtTH(deposit)}/>
        <Card label="ค่าเช่าเดือนแรก" value={fmtTH(firstRent)}/>
        <Card label="ยอดจอง" value={fmtTH(reserve)}/>
        <Card label="ยอดรวมย้ายเข้า" value={fmtTH(mustPayToday)} highlight/>
      </div>

      {/* Footer */}
      <div className="mt-5 text-xs text-gray-300/80 border-t border-white/10 pt-3">{message||'บันทึกการจองสำเร็จ'}</div>

      {/* shine for highlight (desktop only in Card) */}
      <style jsx>{`@keyframes shine{0%{transform:translateX(-60%) skewX(-20deg);opacity:0;}20%{opacity:.45;}100%{transform:translateX(160%) skewX(-20deg);opacity:0;}}`}</style>
      <style jsx>{`
        /* ซ่อนสกอร์บาร์แบบสุภาพบน iOS/Android */
        div::-webkit-scrollbar{height:0;}
      `}</style>
    </div>
  );
}

function Card({
  label, value, highlight=false, className=''
}:{ label:string; value:string|number; highlight?:boolean; className?:string; }){
  return (
    <div className={[
      'relative rounded-2xl p-4 flex flex-col gap-1.5 min-w-0',
      'w-full max-w-full',
      highlight
        ? 'bg-gradient-to-br from-orange-500/15 to-amber-400/10 border border-orange-400/35 shadow-[0_0_20px_rgba(255,140,60,.28)]'
        : 'bg-white/[0.045] border border-white/10',
      className
    ].join(' ')}>
      <div className={['text-[11px] md:text-xs leading-snug', highlight?'text-orange-300':'text-gray-400'].join(' ')}>{label}</div>
      <div className={[
        highlight
          ? 'text-[clamp(20px,5.6vw,26px)] md:text-[clamp(22px,2.2vw,34px)] text-orange-200'
          : 'text-[clamp(18px,5vw,22px)] md:text-[clamp(20px,2vw,28px)] text-gray-100',
        'font-extrabold leading-[1.05] tracking-tight tabular-nums whitespace-normal md:whitespace-nowrap min-w-0 pr-0.5'
      ].join(' ')} style={{ textShadow: highlight ? '0 1px 2px rgba(0,0,0,.35)' : 'none' }}>
        {value}
      </div>
      <div className={['text-[11px]', highlight ? 'text-orange-200/85' : 'text-gray-400'].join(' ')}>บาท</div>
      {highlight && (
        <span className="pointer-events-none hidden md:block absolute inset-y-0 -left-24 md:-left-36 w-24 md:w-32 bg-gradient-to-r from-transparent via-white/50 to-transparent blur-md md:blur-lg" style={{ animation:'shine 3.6s linear infinite' }}/>
      )}
    </div>
  );
}