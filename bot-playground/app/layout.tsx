import './globals.css';

export const metadata = { title: 'Bot Playground — Clínica ComVida' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans">{children}</body>
    </html>
  );
}
