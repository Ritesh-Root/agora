import { defineConfig } from 'vitest/config';

// Standalone config (no app plugins) so the pure-logic society tests run fast
// in a Node environment without the React/Tailwind/relay dev pipeline.
export default defineConfig({
  test: {
    include: ['src/core/society/**/*.test.ts', 'src/simulation/**/*.test.ts', 'server/**/*.test.ts'],
    environment: 'node',
  },
});
