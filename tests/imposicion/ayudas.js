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

/** Devuelve todos los flujos de contenido del PDF, descomprimidos y concatenados. */
export function operadoresDe(bytes) {
  const crudo = Buffer.from(bytes);
  const texto = crudo.toString('latin1');
  let salida = '';
  const re = /stream\r?\n/g;
  let m;
  while ((m = re.exec(texto))) {
    const ini = m.index + m[0].length;
    const fin = texto.indexOf('endstream', ini);
    if (fin < 0) continue;
    const buf = crudo.subarray(ini, fin);
    try {
      salida += `${zlib.inflateSync(buf).toString('latin1')}\n`;
    } catch {
      salida += `${buf.toString('latin1')}\n`;
    }
  }
  return salida;
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
