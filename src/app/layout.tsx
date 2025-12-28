import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CodjiFlo',
  description: 'Code review tool for power users of pull requests',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-gray-100 text-gray-900">
          {children}
        </div>
      </body>
    </html>
  );
}
