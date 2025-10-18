'use client';
import React from 'react';
import { Home, User } from 'lucide-react';

type RawRoom = {
  room_no?: string;
  room?: string;
  status?: string;          // reserved | occupied | vacant (หรือค่าอื่น)
  room_status?: string;     // จากตาราง rooms
  booking_status?: string;  // จากตาราง bookings
  tenant?: string;
  tenant_name?: string;
};

export default function RoomsOverviewPanel({ data }: { data: any }) {
  // ---- รับได้ทุกทรง: {rooms:[]}, {data:{rooms:[]}}, [] ----
  const payload = data?.rooms
    ? data
    : data?.data?.rooms
    ? data.data
    : Array.isArray(data)
    ? { rooms: data }
    : { rooms: [] };

  const rawList: RawRoom[] = Array.isArray(payload.rooms) ? payload.rooms : [];

  const deriveStatus = (r: RawRoom) => {
    const b = (r.booking_status || '').toLowerCase();
    const rs = (r.room_status || '').toLowerCase();
    const s = (r.status || '').toLowerCase();
    const x = b || s || rs;

    if (['reserved', 'reserve', 'booking'].includes(x)) return 'reserved';
    if (['occupied', 'checked_in', 'active'].includes(x)) return 'occupied';
    if (['vacant', 'available', 'empty'].includes(x)) return 'vacant';
    return x || 'vacant';
  };

  const list = rawList
    .map((r) => ({
      room_no: r.room_no ?? r.room ?? '',
      status: deriveStatus(r),
      tenant: r.tenant ?? r.tenant_name ?? '-',
    }))
    .filter((r) => !!r.room_no); // กันค่าที่ไม่มีเลขห้อง

  if (!list.length) {
    return (
      <div
        className="rounded-2xl p-5 border border-dashed text-center text-sm"
        style={{ borderColor: 'rgba(255,255,255,.25)', color: '#bbb' }}
      >
        ยังไม่มีข้อมูลห้อง
      </div>
    );
  }

  const colorByStatus: Record<string, string> = {
    reserved: '#ffb347',
    occupied: '#21d07a',
    vacant: '#6ec1ff',
  };

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background:
          'linear-gradient(135deg, rgba(255,122,0,.10), rgba(40,25,60,.60))',
        border: '1px solid rgba(255,255,255,.12)',
        boxShadow: '0 0 25px rgba(255,122,0,.15)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-[#ffb347] font-semibold">
          <Home className="w-5 h-5" />
          <span>ภาพรวมสถานะห้อง</span>
        </div>
        <div className="text-xs text-gray-300">
          อัพเดทล่าสุด:{' '}
          {payload.updated_at
            ? new Date(payload.updated_at).toLocaleString('th-TH')
            : '-'}
        </div>
      </div>

      <div
        className="grid"
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        }}
      >
        {list.map((r) => {
          const color = colorByStatus[r.status] || '#bbb';
          return (
            <div
              key={r.room_no}
              className="rounded-xl p-3"
              style={{
                background: 'rgba(16,16,32,.55)',
                border: '1px solid rgba(255,255,255,.12)',
                boxShadow: `0 0 0 1px rgba(255,255,255,.06) inset, 0 0 14px ${color}22`,
              }}
            >
              <div
                className="text-sm font-bold mb-2"
                style={{ color: '#ffb347' }}
              >
                ห้อง {r.room_no}
              </div>

              <div
                className="inline-block text-xs font-semibold px-2 py-1 rounded-md mb-2"
                style={{
                  background: `${color}22`,
                  color,
                  border: `1px solid ${color}66`,
                }}
              >
                {r.status === 'reserved'
                  ? 'จอง'
                  : r.status === 'occupied'
                  ? 'เข้าอยู่'
                  : 'ว่าง'}
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-300">
                <User className="w-4 h-4 opacity-70" />
                <span>{r.tenant || '-'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}