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
  // Aggressive memory optimizations for dev server
  ...(process.env.NODE_ENV === 'development' && {
    // Disable source maps completely
    productionBrowserSourceMaps: false,
    // Reduce memory usage in webpack
    webpack: (config, { dev, isServer }) => {
      if (dev && !isServer) {
        // Aggressive memory optimizations
        config.optimization = {
          ...config.optimization,
          // Minimize memory usage
          minimize: false, // Don't minify in dev (saves memory)
          splitChunks: {
            chunks: 'all',
            maxSize: 150000, // Smaller chunks (150KB)
            minSize: 20000, // Don't split tiny chunks
            cacheGroups: {
              default: false,
              vendors: false,
              // Single vendor chunk
              vendor: {
                name: 'vendor',
                chunks: 'all',
                test: /node_modules/,
                priority: 20,
                maxSize: 150000,
                enforce: true,
              },
            },
          },
        };
        // Disable source maps completely
        config.devtool = false;
        // Reduce memory for file watching
        config.watchOptions = {
          ...config.watchOptions,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/.next/**',
            '**/dist/**',
            '**/build/**',
          ],
        };
        // Reduce module resolution memory
        config.resolve = {
          ...config.resolve,
          // Cache fewer modules
          cache: false, // Disable module resolution cache
        };
      }
      return config;
    },
  }),
};

export default nextConfig;
