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
};

export default nextConfig;
