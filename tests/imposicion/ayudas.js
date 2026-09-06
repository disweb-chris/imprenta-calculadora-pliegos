import { PDFDocument, cmyk } from 'pdf-lib';
import zlib from 'node:zlib';
import { mmApt } from '../../src/imposicion/unidades.js';

/**
 * Fabrica un arte de prueba en CMYK, con o sin demasía y declarando o no las
 * cajas de página. Los colores son valores distintivos para poder buscarlos
 * literalmente en el flujo de contenido del PDF resultante.
 */
export async function arteDePrueba({
  paginas = 1,
  pieza = { ancho: 70, alto: 120 },
  sangrado = 3,
  conDemasia = true,
  declararCajas = true,
  fondo = cmyk(0.11, 0.22, 0.33, 0.44),
} = {}) {
  const doc = await PDFDocument.create();
  const s = conDemasia ? mmApt(sangrado) : 0;
  const w = mmApt(pieza.ancho) + s * 2;
  const h = mmApt(pieza.alto) + s * 2;

  for (let i = 0; i < paginas; i += 1) {
    const p = doc.addPage([w, h]);
    p.drawRectangle({ x: 0, y: 0, width: w, height: h, color: fondo });
    // Un círculo, para tener curvas Bézier y poder comprobar que siguen siendo vectores.
    p.drawCircle({ x: w / 2, y: h / 2, size: 20, color: cmyk(0.91, 0.07, 0.05, 0.03) });
    if (declararCajas) {
      p.setTrimBox(s, s, mmApt(pieza.ancho), mmApt(pieza.alto));
      if (conDemasia) p.setBleedBox(0, 0, w, h);
    }
  }
  return doc.save();
}

/**
 * Devuelve los flujos de CONTENIDO del PDF, descomprimidos y concatenados.
 *
 * Sólo entran los streams que descomprimen y que parecen texto de operadores.
 * Los que no descomprimen (imágenes, fuentes) o son mayormente binarios se
 * descartan: concatenarlos hacía que un regex como /\brg\b/ matcheara basura
 * binaria de vez en cuando, y los tests salían inestables. El nombre que
 * pdf-lib le da a cada página embebida lleva un número al azar, así que los
 * bytes comprimidos —y la basura— cambian en cada corrida.
 */
export function operadoresDe(bytes) {
  const crudo = Buffer.from(bytes);
  const texto = crudo.toString('latin1');
  const partes = [];
  const re = /stream\r?\n/g;
  let m;

  while ((m = re.exec(texto))) {
    const ini = m.index + m[0].length;
    const fin = texto.indexOf('endstream', ini);
    if (fin < 0) continue;

    let contenido;
    try {
      contenido = zlib.inflateSync(crudo.subarray(ini, fin)).toString('latin1');
    } catch {
      continue; // no comprimido con Flate: no es un flujo de contenido
    }
    if (pareceTexto(contenido)) partes.push(contenido);
  }

  return partes.join('\n');
}

/** Un flujo de operadores es ASCII imprimible casi en su totalidad. */
function pareceTexto(s) {
  if (s.length === 0) return false;
  const muestra = s.slice(0, 4096);
  let imprimibles = 0;
  for (let i = 0; i < muestra.length; i += 1) {
    const c = muestra.charCodeAt(i);
    if (c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 126)) imprimibles += 1;
  }
  return imprimibles / muestra.length > 0.95;
}

/** El PDF crudo, para buscar entradas del diccionario (/Subtype, etc.). */
export const crudoDe = (bytes) => Buffer.from(bytes).toString('latin1');

/**
 * Cuenta cuántas veces se invoca un XObject (`/Nombre Do`). pdf-lib nombra las
 * páginas embebidas `/EmbeddedPdfPage-<id>`, con guion, así que el nombre no
 * es sólo `\w`.
 */
export const invocacionesDeXObject = (ops) => (ops.match(/\/[\w-]+ Do\b/g) ?? []).length;

/**
 * Traslaciones con las que se coloca cada página embebida, en puntos.
 * pdf-lib emite `1 0 0 1 tx ty cm` seguido de varios `cm` neutros y el `Do`.
 */
export function colocacionesDe(ops) {
  const re = /1 0 0 1 ([-\d.]+) ([-\d.]+) cm(?:\s*[-\d. ]+cm)*\s*\/[\w-]+ Do/g;
  const salida = [];
  let m;
  while ((m = re.exec(ops))) salida.push({ x: Number(m[1]), y: Number(m[2]) });
  return salida;
}
