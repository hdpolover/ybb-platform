import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Docker optimization
  output: "standalone",

  // TipTap v3 packages use a nested "types" condition in their exports map that
  // Turbopack cannot resolve. Listing them here forces Next.js to bundle them
  // directly (bypassing the exports resolution), which fixes the build.
  transpilePackages: [
    "@tiptap/extension-image",
    "@tiptap/extension-link",
    "@tiptap/extension-placeholder",
    "@tiptap/extension-text-align",
    "@tiptap/extension-text-style",
    "@tiptap/extension-underline",
  ],

  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: true,
  },

  // Enable compression to reduce bandwidth and improve performance
  compress: true,

  // Optimize images
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Production optimizations
  productionBrowserSourceMaps: false, // Disable source maps in production to save memory
  poweredByHeader: false, // Remove X-Powered-By header for security

  // Experimental features for better performance
  experimental: {
    // optimizeCss: true, // disabled — requires 'critters' package

    // Optimize package imports
    optimizePackageImports: ["@heroicons/react", "recharts"],
  },

  // Turbopack configuration (Next.js 16+)
  // Empty config to silence the warning and use default optimizations
  turbopack: {},

  // Headers for caching and security
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
        ],
      },
      {
        source: "/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

