import { defineConfig } from 'vitest/config';

// Standalone config (does not load the app's vite.config) so society-engine
// tests run in a fast Node environment without the React/Tailwind pipeline.
export default defineConfig({
  test: {
    include: ['server/**/*.test.ts'],
    environment: 'node',
  },
});
