#!/usr/bin/env node
/**
 * Compara dos pliegos impuestos, midiendo lo que está realmente dibujado.
 *
 * Sirve para contrastar una pose generada por el servicio contra una armada a
 * mano: no mira cómo se construyó cada archivo, sólo las marcas de corte.
 *
 *   node bin/comparar.js --a mio.pdf --b hecha-a-mano.pdf
 */

import { readFile } from 'node:fs/promises';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { medirPliego, compararMedidas } from '../src/imposicion/medir.js';

const AYUDA = `
Comparar dos pliegos impuestos

  node bin/comparar.js --a <pdf> --b <pdf> [--pagina N] [--tolerancia mm]

  --a, --b       Los dos PDF a comparar.
  --pagina       Qué página medir de cada uno (por defecto la 1).
  --tolerancia   Desvío aceptable en mm (por defecto 0.5, la de la guillotina).
`;

function parsear(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue;
    const siguiente = argv[i + 1];
    if (siguiente === undefined || siguiente.startsWith('--')) args[argv[i].slice(2)] = true;
    else { args[argv[i].slice(2)] = siguiente; i += 1; }
  }
  return args;
}

const fila = (k, v) => process.stdout.write(`  ${k.padEnd(22)} ${v}\n`);

function describir(titulo, m) {
  process.stdout.write(`\n${titulo}\n`);
  fila('pliego', `${m.pliego.ancho} × ${m.pliego.alto} mm`);
  fila('marcas verticales', m.marcasCorte.verticales.join(', ') || '(ninguna)');
  fila('marcas horizontales', m.marcasCorte.horizontales.join(', ') || '(ninguna)');
  if (m.columnas.cantidad && m.filas.cantidad) {
    fila('grilla', `${m.columnas.cantidad} × ${m.filas.cantidad} = ${m.columnas.cantidad * m.filas.cantidad} piezas`);
    fila('pieza', `${m.columnas.pieza} × ${m.filas.pieza} mm`);
    fila('calle', `${m.columnas.calle} / ${m.filas.calle} mm`);
    fila('margen', `${m.columnas.margenInicio} lateral / ${m.filas.margenInicio} sup. (mm)`);
  } else {
    fila('grilla', `no se pudo deducir — ${m.columnas.motivo ?? ''} ${m.filas.motivo ?? ''}`.trim());
  }
}

async function principal() {
  const args = parsear(process.argv.slice(2));
  if (args.ayuda || args.help || !args.a || !args.b) {
    process.stdout.write(AYUDA);
    process.exit(args.a && args.b ? 0 : 1);
  }

  const pagina = Number(args.pagina ?? 1);
  const tolerancia = Number(args.tolerancia ?? 0.5);

  const [ma] = await medirPliego(pdfjs, new Uint8Array(await readFile(args.a)), [pagina]);
  const [mb] = await medirPliego(pdfjs, new Uint8Array(await readFile(args.b)), [pagina]);

  describir(`A · ${args.a}`, ma);
  describir(`B · ${args.b}`, mb);

  const r = compararMedidas(ma, mb, tolerancia);
  const desvio = (d) => (d === null ? 'no comparable' : `${d} mm`);

  process.stdout.write('\nComparación\n');
  fila('mismo pliego', r.pliegoIgual ? 'sí' : 'NO');
  fila('líneas verticales', `${r.lineasVerticales.a} vs ${r.lineasVerticales.b} — desvío ${desvio(r.lineasVerticales.desvioMaximo_mm)}`);
  fila('líneas horizontales', `${r.lineasHorizontales.a} vs ${r.lineasHorizontales.b} — desvío ${desvio(r.lineasHorizontales.desvioMaximo_mm)}`);
  process.stdout.write(
    r.coincide
      ? `\n  ✔ Las dos poses coinciden dentro de ${tolerancia} mm.\n\n`
      : `\n  ✘ Las poses NO coinciden.\n\n`,
  );
  process.exit(r.coincide ? 0 : 2);
}

principal().catch((e) => {
  process.stderr.write(`\nError: ${e.message}\n\n`);
  process.exit(1);
});
