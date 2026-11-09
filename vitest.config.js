import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['apps/**/test/**/*.test.js', 'packages/**/test/**/*.test.js'],
    exclude: ['**/node_modules/**'],
    globalSetup: ['./test/globalSetup.js'],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
