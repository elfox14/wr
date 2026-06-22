import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheMaxMemorySize: 0,
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
  async redirects() {
    return [
      {
        source: '/ai-analyst',
        destination: '/intelligence',
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.thesportsdb.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'flagcdn.com' },
      { protocol: 'https', hostname: 'media.api-sports.io' },
      { protocol: 'https', hostname: 'ui-avatars.com' }
    ],
  },
};

export default nextConfig;
