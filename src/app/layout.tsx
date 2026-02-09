import type { Metadata, Viewport } from 'next';
import './globals.css';
import BottomNav from '@/components/BottomNav';
import DesktopSidebar from '@/components/DesktopSidebar';
import Providers from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Noonan Hockey - Youth Hockey Clinics & Camps Worldwide',
  description:
    'Discover youth hockey clinics, camps, showcases, and development programs worldwide. Real-time internet scanning for the most comprehensive hockey opportunity listing.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Noonan Hockey',
  },
  openGraph: {
    title: 'Noonan Hockey',
    description: 'Discover youth hockey clinics worldwide',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0ea5e9',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="antialiased font-sans theme-text" style={{ backgroundColor: 'var(--theme-bg)' }}>
        <Providers>
          <div className="flex min-h-screen">
            <DesktopSidebar />
            <main className="flex-1 lg:ml-[260px]">
              {children}
            </main>
          </div>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
