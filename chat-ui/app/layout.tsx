import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Clínica Comvida — Chat' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#111b21] h-screen overflow-hidden">{children}</body>
    </html>
  );
}
