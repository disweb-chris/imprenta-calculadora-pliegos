import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * El respaldo del navegador (`web/pose.bundle.js`) se construye desde `src/`.
 * Si alguien toca el core y no vuelve a construirlo, el widget seguiría
 * cotizando offline con la versión vieja — un precio distinto del que da el
 * servicio, y sin manera de notarlo. Este test es el que lo impide.
 *
 * Si falla: `npm run build:web` y commitear el resultado.
 */
describe('bundle del navegador', () => {
  it('está al día con src/', () => {
    const salida = join(mkdtempSync(join(tmpdir(), 'io-bundle-')), 'pose.bundle.js');

    execFileSync('npx', [
      'esbuild', 'src/web/entrada.js',
      '--bundle', '--format=iife', '--global-name=IOPose', '--target=es2019',
      `--outfile=${salida}`,
      '--banner:js=/* Generado por `npm run build:web` desde src/. No editar a mano. */',
    ], { stdio: 'pipe' });

    const recien = readFileSync(salida, 'utf8');
    const commiteado = readFileSync('web/pose.bundle.js', 'utf8');

    expect(
      commiteado === recien,
      'web/pose.bundle.js quedó desactualizado. Corré `npm run build:web` y commiteá el resultado.',
    ).toBe(true);
  });
});
