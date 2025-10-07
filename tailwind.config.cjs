/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}", // เผื่อไฟล์อื่นๆใต้ src
  ],
  theme: { extend: {} },
  // สำหรับคลาสที่ประกอบเป็นสตริงแบบ dynamic ต้อง safelist
  safelist: [
    'border-cyan-500','border-emerald-500','border-amber-500','border-red-500','border-rose-500','border-violet-500',
    'text-cyan-400','text-emerald-400','text-amber-400','text-red-400','text-rose-400','text-violet-400',
    'shadow-cyan-400','shadow-emerald-400','shadow-amber-400','shadow-red-400','shadow-rose-400','shadow-violet-400',
  ],
  plugins: [],
};