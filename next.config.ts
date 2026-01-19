import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker/Cloud Run
  output: 'standalone',
  // Optimize images for production
  images: {
    unoptimized: false,
  },
  // Memory optimizations for dev server
  ...(process.env.NODE_ENV === 'development' && {
    // Reduce memory usage in development
    webpack: (config, { dev }) => {
      if (dev) {
        // Limit chunk size to reduce memory usage
        config.optimization = {
          ...config.optimization,
          splitChunks: {
            chunks: 'all',
            cacheGroups: {
              default: false,
              vendors: false,
              // Smaller chunks
              vendor: {
                name: 'vendor',
                chunks: 'all',
                test: /node_modules/,
                priority: 20,
              },
            },
          },
        };
      }
      return config;
    },
  }),
};

export default nextConfig;
