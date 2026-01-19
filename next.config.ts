import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker/Cloud Run
  output: 'standalone',
  // Optimize images for production
  images: {
    unoptimized: false,
  },
  // Use webpack instead of Turbopack in development (to reduce memory usage)
  // Add empty turbopack config to silence the warning
  turbopack: {},
  // Memory optimizations for dev server
  ...(process.env.NODE_ENV === 'development' && {
    // Disable source maps in dev to reduce memory usage
    productionBrowserSourceMaps: false,
    // Reduce memory usage in webpack
    webpack: (config, { dev, isServer }) => {
      if (dev && !isServer) {
        // Reduce memory usage by limiting chunk sizes
        config.optimization = {
          ...config.optimization,
          splitChunks: {
            chunks: 'all',
            maxSize: 200000, // 200KB max chunk size
            cacheGroups: {
              default: false,
              vendors: false,
              vendor: {
                name: 'vendor',
                chunks: 'all',
                test: /node_modules/,
                priority: 20,
                maxSize: 200000,
              },
            },
          },
        };
        // Disable source maps to save memory
        config.devtool = false;
      }
      return config;
    },
  }),
};

export default nextConfig;
