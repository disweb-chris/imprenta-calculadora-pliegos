import { Router } from 'express';
import { calcularTrabajo } from '../../core/trabajo.js';
import { desdeCalculadora } from '../../core/unidades.js';
import { generarSVG } from '../../nesting/svg.js';
import { ErrorDePose } from '../../nesting/validacion.js';

export const rutasTrabajo = Router();

/**
 * Adaptador del contrato de la calculadora del sitio.
 *
 * El widget mezcla unidades (pliego y pieza en cm, demasía y separación en mm)
 * y usa nombres en inglés. Se traduce acá, en el borde, para que el core
 * hable un solo idioma y una sola unidad.
 */
function desdeContratoDelSitio(body = {}) {
  const {
    sheetW, sheetH, itemW, itemH, bleed, gutter,
    extraSheets, qty, doubleFace,
    costPaper, costPrint, costSetup, prodPct, profitPct, applyVat,
    ...resto
  } = body;

  // `paperType` y `currency` son etiquetas de la UI: no entran al cálculo.
  delete resto.paperType;
  delete resto.paperSize;
  delete resto.currency;

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
 * Resuelve el trabajo y, si lo piden, adjunta el preview de la pose en el
 * mismo response. Una sola ida y vuelta: la calculadora recalcula mientras el
 * operador tipea y no conviene pedir el SVG aparte.
 */
function resolver(entrada) {
  const { incluirSvg = false, modoSvg = 'preview', ...resto } = entrada;
  if (!incluirSvg) return calcularTrabajo(resto);

  const trabajo = calcularTrabajo({ ...resto, armarPose: true });

  // En doble faz se numeran las piezas: es la única forma de ver de un vistazo
  // que el dorso está espejado y que cada frente cae sobre su propio dorso.
  const opciones = { modo: modoSvg, numerarPiezas: trabajo.pose.dobleFaz && modoSvg === 'preview' };

  const svg = trabajo.pose.dobleFaz
    ? { frente: generarSVG(trabajo.pose, { ...opciones, cara: 'frente' }),
        dorso: generarSVG(trabajo.pose, { ...opciones, cara: 'dorso' }) }
    : { unica: generarSVG(trabajo.pose, opciones) };

  return { ...trabajo, svg };
}

/** Contrato nativo: todo en milímetros, nombres en español. */
rutasTrabajo.post('/calcular', (req, res) => {
  res.json(resolver(req.body ?? {}));
});

/**
 * Contrato compatible con la calculadora que está hoy en el sitio: mismos
 * nombres de campo y mismas unidades que el formulario.
 */
rutasTrabajo.post('/calcular/compat', (req, res) => {
  const body = req.body ?? {};
  if (body.sheetW === undefined || body.itemW === undefined) {
    throw new ErrorDePose('Faltan las medidas: esperaba sheetW/sheetH e itemW/itemH en centímetros.', 'sheetW');
  }
  res.json(resolver(desdeContratoDelSitio(body)));
});
