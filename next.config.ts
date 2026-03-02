import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker/Cloud Run
  output: 'standalone',
  // Optimize images for production
  images: {
    unoptimized: false,
  },
  experimental: {
    // Disable build worker to avoid SIGTERM exits inside constrained dev containers
    webpackBuildWorker: false,
  },
  // Do not opt into Turbopack; stick with webpack which is more stable in CI
  // Treat googleapis as external to avoid bundling issues
  serverExternalPackages: ['googleapis', 'google-auth-library', 'firebase-admin', 'puppeteer'],
};

export default nextConfig;
