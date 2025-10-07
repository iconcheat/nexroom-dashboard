// ต้องอยู่บรรทัดบนสุด เพื่อให้ Next โหลด CSS เข้ามา
import './globals.css';

export const metadata = { title: 'NexRoom Dashboard' };

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}