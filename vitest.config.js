import { defineConfig } from 'vitest/config';

/** Suite unitaria: sin navegador, tiene que correr en menos de un par de segundos. */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    exclude: ['tests/web/**'],
  },
});
