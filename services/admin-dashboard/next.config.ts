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

  // Turbopack's Node File Tracing dies with
  // "NftJsonAsset: cannot handle filepath node:worker_threads" when it walks
  // jsdom's xhr-sync-worker.js, which is reachable from the runtime dependency
  // isomorphic-dompurify (lib/sanitize-html.ts) and only matters for
  // synchronous XHR in a browser-like environment — something this app never
  // does server-side.
  //
  // It surfaced when a test runner was added, and the cause is not the runner:
  // npm hoisted jsdom to the top level before that install and nested it under
  // isomorphic-dompurify afterwards, and ONLY the nested path trips the tracer.
  // Verified by building the commit before (clean) and after (broken), then
  // confirming the break persisted with jsdom and testing-library removed
  // entirely. So any future dependency that perturbs hoisting would produce the
  // same broken build - relying on the hoist order is the fragile fix, this is
  // the durable one. With it in place the full DOM testing stack installs and
  // the build still passes.
  outputFileTracingExcludes: {
    "*": ["**/jsdom/lib/jsdom/living/xhr/xhr-sync-worker.js"],
  },

  // TypeScript configuration
  // Type errors fail the build so regressions are caught at build time
  // instead of shipping silently.
  typescript: {
    ignoreBuildErrors: false,
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

