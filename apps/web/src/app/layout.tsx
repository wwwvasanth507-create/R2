import React from 'react';

export const metadata = {
  title: 'VD Player - Stream Movies, Series & Music | Ultra-Fast R2 Streaming',
  description: 'Premium Netflix & JioHotstar cinematic streaming platform powered by multi-bucket Cloudflare R2 storage.',
  icons: {
    icon: '/vd-logo.jpg',
    apple: '/vd-logo.jpg'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ background: '#08090d', color: '#f3f4f6', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#08090d" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="icon" href="/vd-logo.jpg" />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#08090d', minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
        {children}
      </body>
    </html>
  );
}
