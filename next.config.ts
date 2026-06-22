import path from "node:path";
import type { NextConfig } from "next";

const turbopackBuildStubAliases = {
  'framer-motion': './lib/build-stubs/framer-motion.tsx',
  'lucide-react': './lib/build-stubs/lucide-react.tsx',
  recharts: './lib/build-stubs/recharts.tsx',
};

const webpackBuildStubAliases = {
  'framer-motion': path.resolve(__dirname, 'lib/build-stubs/framer-motion.tsx'),
  'lucide-react': path.resolve(__dirname, 'lib/build-stubs/lucide-react.tsx'),
  recharts: path.resolve(__dirname, 'lib/build-stubs/recharts.tsx'),
};

const nextConfig: NextConfig = {
  cacheMaxMemorySize: 0,
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    resolveAlias: turbopackBuildStubAliases,
  },
  experimental: {
    workerThreads: false,
    cpus: 1,
    webpackMemoryOptimizations: true,
    staticGenerationMaxConcurrency: 1,
    staticGenerationMinPagesPerWorker: 1,
  },
  webpack(config, { dev }) {
    if (!dev) {
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        ...webpackBuildStubAliases,
      };
    }
    return config;
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
      { protocol: 'https', hostname: 'media.mcprim.com' },
      { protocol: 'https', hostname: 'ui-avatars.com' }
    ],
  },
};

export default nextConfig;
