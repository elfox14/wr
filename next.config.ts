import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
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
