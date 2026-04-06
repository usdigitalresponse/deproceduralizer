import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force full rebuild - build ID ensures Vercel cache invalidation
  generateBuildId: async () => {
    // Use git commit hash for reproducible builds
    return process.env.VERCEL_GIT_COMMIT_SHA || `build-${Date.now()}`;
  },

  // Allow test runs to use an isolated build directory so they don't
  // corrupt a running dev server or clash with other test runs.
  // Set NEXT_DIST_DIR=.next-test in your environment to activate.
  ...(process.env.NEXT_DIST_DIR && { distDir: process.env.NEXT_DIST_DIR }),

  async redirects() {
    return [
      {
        source: '/:state/bookmarks',
        destination: '/:state/saved',
        permanent: true,
      },
      {
        source: '/:state/markers',
        destination: '/:state/saved',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
