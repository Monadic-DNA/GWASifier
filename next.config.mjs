import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true, // Enable gzip compression for API responses
  experimental: {
    optimizePackageImports: ["react", "react-dom"]
  },
  async rewrites() {
    return [
      {
        source: '/favicon.ico',
        destination: '/icon.svg',
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Reduce file watching overhead - prevent watching parent directories
    config.watchOptions = {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/localdata/**',
        '**/.next/**',
        // Explicitly ignore parent directories
        path.resolve(__dirname, '..'),
      ],
      aggregateTimeout: 300,
    };

    // Fix sql.js Node.js polyfills for browser-only usage
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    return config;
  },
};

export default nextConfig;
