import React from 'react';

export const metadata = {
  title: 'Unified Media Platform | Netflix + YouTube + Instagram',
  description: 'Production-ready all-in-one media streaming and social ecosystem with multi-account Cloudflare R2 storage.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ background: '#090a0f', color: '#f3f4f6', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#090a0f', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {children}
      </body>
    </html>
  );
}
