import { Router } from 'express';
import { calcularTrabajo } from '../../core/trabajo.js';
import { desdeCalculadora } from '../../core/unidades.js';
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

/** Contrato nativo: todo en milímetros, nombres en español. */
rutasTrabajo.post('/calcular', (req, res) => {
  res.json(calcularTrabajo(req.body ?? {}));
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
  res.json(calcularTrabajo(desdeContratoDelSitio(body)));
});
