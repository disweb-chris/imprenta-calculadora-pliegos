#!/usr/bin/env node
/**
 * CLI de imposición.
 *
 * Corre en la máquina, así que no tiene el límite de 32 MB que tiene Cloud Run
 * para el cuerpo de una request: sirve para los mazos grandes mientras la
 * subida por el sitio no esté resuelta.
 *
 *   node bin/imponer.js --frente cartas.pdf --dorso dorso.pdf \
 *     --pieza 70x120 --pliego 320x470 --salida pliegos.pdf
 */

import { readFile, writeFile } from 'node:fs/promises';
import { imponer } from '../src/imposicion/imponer.js';
import { interpretarRango } from '../src/imposicion/seleccion.js';

const AYUDA = `
Imposición de pliegos — Imprenta Online

  node bin/imponer.js --frente <pdf> --pieza <ancho>x<alto> [opciones]

Obligatorio
  --frente <pdf>          PDF con el arte de las piezas (una página por pieza).
  --pieza <ancho>x<alto>  Tamaño final de corte, en mm. Ej: 70x120

Opcional
  --paginas <rango>       Qué páginas del frente imponer y en qué orden.
                          Ej: "3,2,4-27" saltea la 1 y corrige dos cambiadas.
  --dorso <pdf>           Dorso. Una página se repite; N páginas = una por pieza.
                          Se puede omitir y usar --dorso-paginas sobre el mismo PDF.
  --dorso-paginas <rango> Qué páginas usar de dorso.
  --pliego <ancho>x<alto> Pliego en mm (por defecto 320x470).
  --sangrado <mm>         Demasía por lado (3).
  --espaciado <mm>        Separación entre piezas (0).
  --margen <mm>           Margen de pinza (0).
  --eje <vertical|horizontal>  Eje de volteo de la doble faz (vertical).
  --sin-marcas            No dibujar las marcas de guillotina.
  --exigir-demasia        Cortar si algún arte viene sin demasía, en vez de espejarla.
  --salida <pdf>          Archivo de salida (pliegos.pdf).
`;

function parsear(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const clave = a.slice(2);
    const siguiente = argv[i + 1];
    if (siguiente === undefined || siguiente.startsWith('--')) args[clave] = true;
    else { args[clave] = siguiente; i += 1; }
  }
  return args;
}

function medida(texto, campo) {
  const m = /^(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)$/i.exec(String(texto).trim());
  if (!m) throw new Error(`"${campo}" tiene que ser <ancho>x<alto> en mm. Recibido: "${texto}".`);
  return { ancho: Number(m[1]), alto: Number(m[2]) };
}

const numero = (v, porDefecto) => (v === undefined ? porDefecto : Number(v));

async function principal() {
  const args = parsear(process.argv.slice(2));

  if (args.ayuda || args.help || !args.frente || !args.pieza) {
    process.stdout.write(AYUDA);
    process.exit(args.frente && args.pieza ? 0 : 1);
  }

  const salida = args.salida ?? 'pliegos.pdf';

  const { pdf, informe } = await imponer({
    frente: await readFile(args.frente),
    dorso: args.dorso ? await readFile(args.dorso) : undefined,
    paginasFrente: args.paginas ? interpretarRango(args.paginas, '--paginas') : undefined,
    paginasDorso: args['dorso-paginas'] ? interpretarRango(args['dorso-paginas'], '--dorso-paginas') : undefined,
    pieza: medida(args.pieza, 'pieza'),
    pliego: args.pliego ? medida(args.pliego, 'pliego') : undefined,
    sangrado: numero(args.sangrado, 3),
    espaciado: numero(args.espaciado, 0),
    margenMinimo: numero(args.margen, 0),
    ejeVolteo: args.eje,
    marcas: !args['sin-marcas'],
    demasiaSintetica: args['exigir-demasia'] ? 'nunca' : 'auto',
  });

  await writeFile(salida, pdf);

  const l = (etiqueta, valor) => process.stdout.write(`  ${etiqueta.padEnd(24)} ${valor}\n`);
  process.stdout.write(`\n${salida}\n`);
  l('piezas', informe.piezas);
  l('por pliego', `${informe.piezasPorPliego} (${informe.grilla.columnas} × ${informe.grilla.filas})`);
  l('pliegos', `${informe.pliegos}${informe.lugaresVacios ? ` (${informe.lugaresVacios} lugares vacíos)` : ''}`);
  l('caras', informe.caras.join(' + '));
  for (const [cara, pgs] of Object.entries(informe.paginasUsadas)) {
    l(`páginas de ${cara}`, pgs.length > 8 ? `${pgs.length} (${pgs[0]}…${pgs.at(-1)})` : pgs.join(', '));
  }
  l('páginas del PDF', informe.paginasDelPdf);
  l('marcas por pliego', informe.marcasPorPliego);
  if (informe.registro) l('registro frente/dorso', informe.registro.registra ? 'coincide' : `⚠ desvío ${informe.registro.desvioMaximo_mm} mm`);
  for (const [cara, tipos] of Object.entries(informe.demasia)) {
    l(`demasía ${cara}`, Object.entries(tipos).map(([t, ps]) => `${t}: ${ps.length} pág.`).join(', '));
  }
  for (const a of informe.advertencias) process.stdout.write(`\n  ⚠  ${a}\n`);
  process.stdout.write('\n');
}

principal().catch((e) => {
  process.stderr.write(`\nError: ${e.message}\n\n`);
  process.exit(1);
});
