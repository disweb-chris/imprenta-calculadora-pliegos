/**
 * Adaptador del contrato de la calculadora del sitio.
 *
 * El formulario mezcla unidades (pliego y pieza en cm, demasía y separación en
 * mm) y usa nombres en inglés. Se traduce acá, en un solo lugar, del que
 * dependen tanto la ruta HTTP como el bundle de respaldo del navegador: si la
 * traducción viviera en los dos, se irían separando.
 */

import { calcularTrabajo } from './trabajo.js';
import { desdeCalculadora } from './unidades.js';
import { generarSVG } from '../nesting/svg.js';
import { ErrorDePose } from '../nesting/validacion.js';

/** Traduce el body del formulario a parámetros nativos en milímetros. */
export function desdeContratoDelSitio(body = {}) {
  const {
    sheetW, sheetH, itemW, itemH, bleed, gutter,
    extraSheets, qty, doubleFace,
    costPaper, costPrint, costSetup, prodPct, profitPct, applyVat,
    // Etiquetas de la UI: no entran al cálculo.
    paperType: _paperType, paperSize: _paperSize, currency: _currency,
    ...resto
  } = body;

  return {
    ...desdeCalculadora({ sheetW, sheetH, itemW, itemH, bleed, gutter }),
    cantidad: qty,
    merma: extraSheets,
    dobleFaz: !!doubleFace,
    costoPapel: costPaper,
    costoImpresion: costPrint,
    costoFijo: costSetup,
    porcentajeProduccion: prodPct,
    porcentajeGanancia: profitPct,
    aplicarIva: !!applyVat,
    ...resto,
  };
}

/**
 * Resuelve el trabajo y, si lo piden, adjunta el preview de la pose en la
 * misma respuesta. Una sola ida y vuelta: la calculadora recalcula mientras el
 * operador tipea y no conviene pedir el SVG aparte.
 */
export function resolverTrabajo(entrada) {
  const { incluirSvg = false, modoSvg = 'preview', ...resto } = entrada;
  if (!incluirSvg) return calcularTrabajo(resto);

  const trabajo = calcularTrabajo({ ...resto, armarPose: true });

  // En doble faz se numeran las piezas: es la única forma de ver de un vistazo
  // que el dorso está espejado y que cada frente cae sobre su propio dorso.
  const opciones = { modo: modoSvg, numerarPiezas: trabajo.pose.dobleFaz && modoSvg === 'preview' };

  const svg = trabajo.pose.dobleFaz
    ? {
        frente: generarSVG(trabajo.pose, { ...opciones, cara: 'frente' }),
        dorso: generarSVG(trabajo.pose, { ...opciones, cara: 'dorso' }),
      }
    : { unica: generarSVG(trabajo.pose, opciones) };

  return { ...trabajo, svg };
}

/** Punto de entrada único para el contrato del sitio. */
export function calcularDesdeElSitio(body = {}) {
  if (body.sheetW === undefined || body.itemW === undefined) {
    throw new ErrorDePose('Faltan las medidas: esperaba sheetW/sheetH e itemW/itemH en centímetros.', 'sheetW');
  }
  return resolverTrabajo(desdeContratoDelSitio(body));
}
