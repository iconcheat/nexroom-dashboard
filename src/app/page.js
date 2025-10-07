"use client";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // ดึงข้อมูลจาก n8n API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/dashboard-summary`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 text-gray-900 p-8">
      <h1 className="text-2xl font-bold mb-4">📊 NEXRoom Dashboard</h1>

      {loading ? (
        <p>⏳ กำลังโหลดข้อมูล...</p>
      ) : data ? (
        <div className="space-y-3">
          <div>🏠 ห้องทั้งหมด: {data.total}</div>
          <div>🟩 ห้องว่าง: {data.vacant}</div>
          <div>🟥 มีผู้เช่า: {data.occupied}</div>
          <div>📅 จอง: {data.reserved}</div>
          <div>🛠 งานซ่อม: {data.maintenance_open}</div>
        </div>
      ) : (
        <p>⚠️ ไม่พบข้อมูลจากระบบ</p>
      )}
    </main>
  );
}
