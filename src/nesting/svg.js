/**
 * Render del layout a SVG.
 *
 * modo "preview"    → para mostrarle al cliente: piezas rellenas, márgenes
 *                     punteados, marcas en naranja para que se vean.
 * modo "produccion" → para superponer al arte: sólo contornos de trim y
 *                     marcas de corte, en negro de registro.
 *
 * El SVG sale en milímetros reales (width/height en mm, viewBox 1:1), así que
 * se puede importar en Illustrator y queda a escala.
 */

import { MARCAS } from '../config/defaults.js';
import { obtenerCara } from './dobleFaz.js';

const AZUL = '#2e509e';
const NARANJA = '#FF6B00';
const BLANCO = '#ffffff';
/**
 * En producción las marcas van en "negro de registro" (CMYK 100/100/100/100),
 * que SVG no puede expresar. Se exporta negro puro y se convierte a registro
 * al armar el PDF de impresión.
 */
const NEGRO_REGISTRO = '#000000';

const PT_A_MM = 25.4 / 72;
const n = (v) => Number(v.toFixed(4));

/**
 * @param {object} pose            Resultado de calcularPose o calcularPoseDobleFaz.
 * @param {object} [opciones]
 * @param {"preview"|"produccion"} [opciones.modo="preview"]
 * @param {"frente"|"dorso"} [opciones.cara="frente"]  Sólo aplica a poses doble faz.
 * @param {boolean} [opciones.numerarPiezas=false]     Numera las piezas (útil para
 *        revisar el registro de una doble faz); apagado por defecto porque el
 *        SVG de producción no lleva texto.
 * @returns {string} SVG
 */
export function generarSVG(pose, opciones = {}) {
  const { modo = 'preview', cara = 'frente', numerarPiezas = false } = opciones;
  if (modo !== 'preview' && modo !== 'produccion') {
    throw new Error(`Modo "${modo}" desconocido: esperaba "preview" o "produccion".`);
  }

  const capa = obtenerCara(pose, cara);
  const { pliego } = pose;
  const esProduccion = modo === 'produccion';
  /**
   * En producción el trazo es el de norma (0.25 pt ≈ 0.088 mm). En preview eso
   * es invisible: el SVG se muestra a unos 200 px para un pliego de 320 mm, o
   * sea 1 px cada 1.6 mm. Se engrosa para que el operador vea dónde va a caer
   * la guillotina.
   */
  const grosor = n(esProduccion ? MARCAS.grosorPt * PT_A_MM : Math.max(pliego.ancho, pliego.alto) / 400);
  const colorMarca = esProduccion ? NEGRO_REGISTRO : NARANJA;

  const partes = [];
  partes.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pliego.ancho}mm" height="${pliego.alto}mm" ` +
      `viewBox="0 0 ${pliego.ancho} ${pliego.alto}">`,
  );
  partes.push(`<rect x="0" y="0" width="${pliego.ancho}" height="${pliego.alto}" fill="${BLANCO}"/>`);

  if (!esProduccion) {
    // Borde del pliego y área de márgenes punteada.
    partes.push(
      `<rect x="0" y="0" width="${pliego.ancho}" height="${pliego.alto}" fill="none" ` +
        `stroke="${AZUL}" stroke-width="${grosor}"/>`,
    );
    const b = capa.bloque;
    partes.push(
      `<rect x="${n(b.margenIzquierdo)}" y="${n(b.margenSuperior)}" width="${n(b.ancho)}" ` +
        `height="${n(b.alto)}" fill="none" stroke="${AZUL}" stroke-width="${grosor}" ` +
        `stroke-dasharray="${n(grosor * 4)} ${n(grosor * 4)}" opacity="0.6"/>`,
    );
  }

  // Piezas.
  partes.push('<g id="piezas">');
  for (const p of capa.posiciones) {
    if (esProduccion) {
      partes.push(
        `<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.ancho)}" height="${n(p.alto)}" ` +
          `fill="none" stroke="${NEGRO_REGISTRO}" stroke-width="${grosor}"/>`,
      );
    } else {
      partes.push(
        `<rect x="${n(p.sangradoCaja.x)}" y="${n(p.sangradoCaja.y)}" width="${n(p.sangradoCaja.ancho)}" ` +
          `height="${n(p.sangradoCaja.alto)}" fill="${AZUL}" opacity="0.15"/>`,
      );
      partes.push(
        `<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.ancho)}" height="${n(p.alto)}" ` +
          `fill="${AZUL}" opacity="0.35" stroke="${AZUL}" stroke-width="${grosor}"/>`,
      );
    }
  }
  partes.push('</g>');

  // Marcas de corte de guillotina.
  partes.push('<g id="marcas-de-corte">');
  for (const t of capa.ticks) {
    partes.push(
      `<line x1="${n(t.x1)}" y1="${n(t.y1)}" x2="${n(t.x2)}" y2="${n(t.y2)}" ` +
        `stroke="${colorMarca}" stroke-width="${grosor}"/>`,
    );
  }
  partes.push('</g>');

  if (numerarPiezas) {
    partes.push('<g id="numeracion" font-family="monospace" text-anchor="middle">');
    for (const p of capa.posiciones) {
      const tamano = n(Math.min(p.ancho, p.alto) * 0.25);
      partes.push(
        `<text x="${n(p.x + p.ancho / 2)}" y="${n(p.y + p.alto / 2 + tamano * 0.35)}" ` +
          `font-size="${tamano}" fill="${esProduccion ? NEGRO_REGISTRO : AZUL}">${p.indice + 1}</text>`,
      );
    }
    partes.push('</g>');
  }

  if (!esProduccion) {
    // Único texto del preview: la cantidad total (y la cara, si es doble faz).
    const etiqueta = pose.dobleFaz ? `${capa.cantidad ?? pose.cantidad} — ${cara}` : `${pose.cantidad}`;
    partes.push(
      `<text x="${n(pliego.ancho / 2)}" y="${n(pliego.alto - 2)}" text-anchor="middle" ` +
        `font-family="monospace" font-size="4" fill="${AZUL}">${etiqueta}</text>`,
    );
  }

  partes.push('</svg>');
  return partes.join('\n');
}

/** Atajo: devuelve { frente, dorso } como dos strings SVG. */
export function generarSVGDobleFaz(pose, opciones = {}) {
  if (!pose.dobleFaz) throw new Error('La pose no es doble faz.');
  return {
    frente: generarSVG(pose, { ...opciones, cara: 'frente' }),
    dorso: generarSVG(pose, { ...opciones, cara: 'dorso' }),
  };
}
