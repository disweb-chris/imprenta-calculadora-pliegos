/**
 * Orquestador del trabajo completo: pose + pliegos + cotización.
 *
 * Es la composición que hoy hace la calculadora del sitio en el navegador.
 * Acá vive como función pura para que la consuman el sitio, el bot de WhatsApp
 * y cualquier otro cliente sin duplicar la aritmética.
 */

import { MERMA_POR_DEFECTO } from '../config/defaults.js';
import { calcularPose } from '../nesting/pose.js';
import { calcularPoseDobleFaz } from '../nesting/dobleFaz.js';
import { calcularPliegos } from './pliegos.js';
import { cotizar } from './precios.js';

/**
 * @param {object} params
 * @param {number} params.cantidad          Unidades a producir.
 * @param {number} [params.merma=2]         Pliegos extra de arranque.
 * @param {boolean} [params.dobleFaz=false] Impresión frente y dorso.
 * @param {boolean} [params.armarPose=false] Devolver también el layout de la pose.
 *
 * Más todos los parámetros de `calcularPose` y de `cotizar`.
 */
export function calcularTrabajo({
  cantidad,
  merma = MERMA_POR_DEFECTO,
  dobleFaz = false,
  armarPose = false,
  costoPapel = 0,
  costoImpresion = 0,
  costoFijo = 0,
  porcentajeProduccion = 0,
  porcentajeGanancia = 0,
  aplicarIva = false,
  ...parametrosDePose
}) {
  const pose = dobleFaz && armarPose
    ? calcularPoseDobleFaz(parametrosDePose)
    : calcularPose(parametrosDePose);

  const pliegos = calcularPliegos({
    cantidadPedida: cantidad,
    piezasPorPliego: pose.cantidad,
    demasia: merma,
    caras: dobleFaz ? 2 : 1,
  });

  const cotizacion = cotizar({
    cantidad,
    pliegos: pliegos.pliegosTotales,
    impresiones: pliegos.pasadas,
    costoPapel,
    costoImpresion,
    costoFijo,
    porcentajeProduccion,
    porcentajeGanancia,
    aplicarIva,
  });

  return {
    dobleFaz,
    piezasPorPliego: pose.cantidad,
    pose: armarPose ? pose : resumenDePose(pose),
    pliegos,
    cotizacion,
  };
}

/** Los datos de pose que muestra la calculadora, sin el layout completo. */
function resumenDePose(pose) {
  return {
    cantidad: pose.cantidad,
    columnas: pose.columnas,
    filas: pose.filas,
    rotada: pose.rotada,
    orientacion: pose.orientacion,
    piezaConSangrado: pose.piezaConSangrado,
    aprovechamiento: pose.aprovechamiento,
    bloque: pose.bloque,
    alternativas: pose.alternativas,
    advertencias: pose.advertencias,
  };
}
