import React from 'react';

export const metadata = {
  title: 'Storage & Operations Admin Console | Cloudflare R2 Management',
  description: 'Enterprise administration dashboard for multi-account Cloudflare R2 storage allocation, 8 GB logical quotas, alerts, and platform moderation.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ background: '#0a0d14', color: '#f3f4f6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#0a0d14', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {children}
      </body>
    </html>
  );
}
