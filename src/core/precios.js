/**
 * Cotización de un trabajo.
 *
 * Réplica exacta de la cadena de cálculo de la calculadora que está hoy en el
 * sitio, en el mismo orden y con los mismos redondeos (o sea: ninguno hasta el
 * final). El orden importa — la ganancia se aplica sobre el costo ya recargado
 * por producción, no sobre el costo base — así que cambiarlo cambiaría los
 * precios de producción.
 *
 *   costoTotal    = pliegos·costoPapel + impresiones·costoImpresion + costoFijo
 *   costoConProd  = costoTotal · (1 + %producción/100)
 *   precioFinal   = costoConProd · (1 + %ganancia/100)
 *   IVA           = precioFinal · 0.21
 *
 * Las funciones son puras y reciben todos los precios como argumento: este
 * módulo no conoce ningún número del negocio.
 */

import { IVA } from '../config/defaults.js';

const redondearPesos = (n) => Math.round(n * 100) / 100;

/**
 * Resuelve el precio unitario de una escala por cantidad.
 *
 * @param {number} cantidad
 * @param {Array<{desde:number, precioUnitario:number}>} escalas
 *        Tramos ordenados o no; se usa el tramo de mayor `desde` que no supere
 *        la cantidad pedida.
 */
export function precioUnitarioPorEscala(cantidad, escalas) {
  if (!Array.isArray(escalas) || escalas.length === 0) {
    throw new Error('No hay escalas de precio configuradas.');
  }
  const aplicables = escalas.filter((e) => cantidad >= e.desde).sort((a, b) => b.desde - a.desde);
  if (aplicables.length === 0) {
    throw new Error(`La cantidad ${cantidad} está por debajo de la escala mínima.`);
  }
  return aplicables[0].precioUnitario;
}

/**
 * @param {object} params
 * @param {number} params.cantidad         Unidades pedidas (para el precio unitario).
 * @param {number} params.pliegos          Pliegos a imprimir (con merma).
 * @param {number} params.impresiones      Pliegos × caras.
 * @param {number} [params.costoPapel=0]   Por pliego.
 * @param {number} [params.costoImpresion=0] Por pliego y por cara.
 * @param {number} [params.costoFijo=0]    Por trabajo.
 * @param {number} [params.porcentajeProduccion=0]
 * @param {number} [params.porcentajeGanancia=0]
 * @param {boolean} [params.aplicarIva=false]
 */
export function cotizar({
  cantidad,
  pliegos,
  impresiones,
  costoPapel = 0,
  costoImpresion = 0,
  costoFijo = 0,
  porcentajeProduccion = 0,
  porcentajeGanancia = 0,
  aplicarIva = false,
}) {
  const numeros = { cantidad, pliegos, impresiones, costoPapel, costoImpresion, costoFijo, porcentajeProduccion, porcentajeGanancia };
  for (const [nombre, valor] of Object.entries(numeros)) {
    if (!Number.isFinite(valor) || valor < 0) {
      throw new Error(`"${nombre}" tiene que ser un número mayor o igual a cero.`);
    }
  }
  if (cantidad <= 0) throw new Error('"cantidad" tiene que ser mayor que cero.');

  const papel = pliegos * costoPapel;
  const impresion = impresiones * costoImpresion;
  const costoTotal = papel + impresion + costoFijo;

  const costoConProduccion = costoTotal * (1 + porcentajeProduccion / 100);
  const precioFinal = costoConProduccion * (1 + porcentajeGanancia / 100);

  const iva = aplicarIva ? precioFinal * IVA : 0;
  const precioFinalConIva = precioFinal + iva;

  return {
    papel: redondearPesos(papel),
    impresion: redondearPesos(impresion),
    costoFijo: redondearPesos(costoFijo),
    costoTotal: redondearPesos(costoTotal),
    costoUnitario: redondearPesos(costoTotal / cantidad),

    porcentajeProduccion,
    porcentajeGanancia,
    precioFinal: redondearPesos(precioFinal),
    precioUnitario: redondearPesos(precioFinal / cantidad),

    aplicarIva,
    iva: redondearPesos(iva),
    precioFinalConIva: redondearPesos(precioFinalConIva),
    precioUnitarioConIva: redondearPesos(precioFinalConIva / cantidad),
  };
}
