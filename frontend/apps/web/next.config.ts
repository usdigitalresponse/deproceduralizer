import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force full rebuild - build ID ensures Vercel cache invalidation
  generateBuildId: async () => {
    // Use git commit hash for reproducible builds
    return process.env.VERCEL_GIT_COMMIT_SHA || `build-${Date.now()}`;
  },
};

export default nextConfig;
