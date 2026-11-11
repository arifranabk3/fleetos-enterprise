import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FleetOS — Enterprise Fleet & Logistics Management SaaS',
  description: 'Mission-critical enterprise platform for multi-tenant fleet dispatch, telemetry tracking, and logistics operations.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-graphite-50 text-graphite-900 antialiased">
        {children}
      </body>
    </html>
  );
}

