'use client';
import React from 'react';

type RoomItem = {
  room_no: string;
  status: 'reserved' | 'occupied' | 'vacant';
  display: string;
  tenant: string;
};

export default function RoomsOverviewPanel({ data }: { data?: { rooms?: RoomItem[] } }) {
  const rooms = data?.rooms || [];
  if (!rooms.length) {
    return (
      <div className="p-6 text-center text-gray-400 text-sm border border-dashed rounded-lg">
        ยังไม่มีข้อมูลห้อง
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-5 bg-[#141024] border border-white/12
                    shadow-[0_0_18px_rgba(255,122,0,.15)]
                    hover:shadow-[0_0_28px_rgba(255,122,0,.25)] transition">
      <div className="text-[#ffb347] font-semibold mb-3">แผนผังห้องทั้งหมด</div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {rooms.map((r) => {
          const color =
            r.status === 'reserved' ? 'bg-yellow-500/15 text-yellow-300 border-yellow-400/30' :
            r.status === 'occupied' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' :
            'bg-sky-500/15 text-sky-300 border-sky-400/30';

          return (
            <div key={r.room_no}
                 className={`rounded-xl border ${color} p-3`}>
              <div className="flex items-center justify-between mb-1">
                <div className="font-extrabold tracking-wide">ห้อง {r.room_no}</div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10">
                  {r.display}
                </span>
              </div>
              <div className="text-sm text-gray-200 truncate">
                ผู้เช่า: <span className="font-medium">{r.tenant || '-'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-sky-400/70" /> ว่าง
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-yellow-400/70" /> จอง
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-emerald-400/70" /> เข้าอยู่
        </div>
      </div>
    </div>
  );
}