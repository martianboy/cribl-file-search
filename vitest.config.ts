import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    includeSource: ['src/**/*.ts'],
    coverage: {
      exclude: ['src/config.ts'],
    },
    environment: 'node',
    globals: true,
  },
});
