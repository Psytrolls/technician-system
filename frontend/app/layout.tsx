import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'מערכת ניהול טכנאים',
  description: 'מעקב וניהול עבודת טכנאים בשטח',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className="dark">
      <body>{children}</body>
    </html>
  );
}
