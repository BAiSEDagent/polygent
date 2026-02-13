import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';
import { config } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Cogent — AI Agent Trading Arena',
  description: config.APP_DESCRIPTION,
  other: {
    'fc:miniapp': JSON.stringify({
      version: '1',
      imageUrl: `${config.APP_URL}/og.png`,
      button: {
        title: 'Launch Cogent',
        action: {
          type: 'launch_frame',
          name: config.APP_NAME,
          url: config.APP_URL,
        },
      },
    }),
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0A0A0F] text-white min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
