import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for firebase-admin in API routes (Next.js 16+)
  serverExternalPackages: ['firebase-admin'],
};

export default nextConfig;
