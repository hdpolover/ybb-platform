// vitest.config.ts
//
// Mirrors ybb-program-next's vitest setup so the two Next apps in this
// workspace behave identically and nobody has to relearn the harness when
// moving between them.
//
// Note what adding this runner exposed: npm previously hoisted jsdom (reachable
// from the runtime dependency isomorphic-dompurify) to the top level, and
// installing anything new nested it instead. Turbopack's Node File Tracing only
// trips over the nested copy, so the production build broke on a dependency
// change that had nothing to do with jsdom. The fix lives in next.config.ts's
// outputFileTracingExcludes, not here — see the comment there.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e'],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
});
