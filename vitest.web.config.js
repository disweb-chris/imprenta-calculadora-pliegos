import { defineConfig } from 'vitest/config';

/**
 * Config aparte para los tests de navegador: necesitan Chromium y son
 * bastante más lentos que la suite unitaria, así que no entran en `npm test`.
 */
export default defineConfig({
  test: {
    include: ['tests/web/**/*.test.js'],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
