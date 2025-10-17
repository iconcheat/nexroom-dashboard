'use client';
import React from 'react';
import { CalendarDays, User, Home, Wallet } from 'lucide-react';

export default function BookingPanel({ data }: { data: any }) {
  if (!data) {
    return (
      <div className="p-6 text-center text-gray-400 text-sm border border-dashed rounded-lg">
        ยังไม่มีข้อมูลการจอง
      </div>
    );
  }

  const { customer = {}, money = {}, room_no, start_date, message } = data;

  return (
    <div className="booking-card rounded-2xl p-5 bg-gradient-to-br from-[#1b1230] to-[#120c22] border border-white/15 shadow-[0_0_25px_rgba(255,122,0,0.15)] transition-all hover:shadow-[0_0_40px_rgba(255,122,0,0.25)]">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2 text-[#ff7a00] font-semibold">
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

      {/* Body */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-200">
        <div className="flex items-center gap-2 col-span-2">
          <User className="w-4 h-4 text-gray-400" />
          <span className="font-medium">{customer.fullname || '-'}</span>
          <span className="text-gray-400 ml-1">{customer.phone || ''}</span>
        </div>

        <div>
          <span className="text-gray-400">มัดจำ:</span>{' '}
          <span className="font-semibold text-gray-100">
            {money.deposit?.toLocaleString() ?? 0} บาท
          </span>
        </div>
        <div>
          <span className="text-gray-400">ค่าเช่าเดือนแรก:</span>{' '}
          <span className="font-semibold text-gray-100">
            {money.first_month_rent?.toLocaleString() ?? 0} บาท
          </span>
        </div>
        <div>
          <span className="text-gray-400">ยอดจอง:</span>{' '}
          <span className="font-semibold text-gray-100">
            {money.reserve?.toLocaleString() ?? 0} บาท
          </span>
        </div>
        <div>
          <span className="text-gray-400">ยอดรวมย้ายเข้า:</span>{' '}
          <span className="font-semibold text-[#ffb347]">
            {money.total_movein?.toLocaleString() ?? 0} บาท
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-5 text-xs text-gray-400 border-t border-white/10 pt-3">
        {message || 'บันทึกการจองสำเร็จ'}
      </div>
    </div>
  );
}