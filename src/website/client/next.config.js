/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/graphql',
        destination: 'http://localhost:3456/graphql',
      },
      {
        source: '/api/auth/:path*',
        destination: 'http://localhost:3456/auth/:path*',
      },
    ]
  },
}

module.exports = nextConfig
