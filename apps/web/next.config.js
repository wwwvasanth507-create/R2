/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'images.unsplash.com',
      'api.dicebear.com',
      'app.wavemusic.dpdns.org',
      'api.wavemusic.dpdns.org',
      'localhost'
    ]
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*'
      }
    ];
  }
};

module.exports = nextConfig;
