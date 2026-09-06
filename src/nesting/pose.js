/**
 * Armado de pose de una cara (nesting 2D en grilla regular).
 *
 * Función pura: entra un objeto plano, sale un objeto plano. Sin req/res, sin
 * estado global, sin I/O. Se puede reusar tal cual desde el bot de WhatsApp.
 */

import { PARAMETROS_POR_DEFECTO, PLIEGO_POR_DEFECTO, MARCAS } from '../config/defaults.js';
import { ErrorDePose, validarParametros } from './validacion.js';
import { resolverShelf } from './shelf.js';
import {
  calcularBloque,
  generarMarcasCorte,
  generarPosiciones,
  generarTicks,
  revisarEspacioDeMarcas,
} from './layout.js';

const redondear = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * Registro de estrategias. Hoy sólo "shelf"; la interfaz queda abierta para
 * agregar "guillotine" u otras sin tocar a los consumidores.
 */
const ESTRATEGIAS = {
  shelf: resolverShelf,
};

/** Estrategias disponibles, para exponer por API. */
export const estrategiasDisponibles = () => Object.keys(ESTRATEGIAS);

/**
 * @param {object} params
 * @param {{ancho:number,alto:number}} [params.pliego]   Pliego en mm (A3 por defecto).
 * @param {{ancho:number,alto:number}}  params.pieza     Tamaño final de corte (trim) en mm.
 * @param {number} [params.sangrado=3]                   Sangrado por lado, en mm.
 * @param {number} [params.espaciado=0]                  Separación extra entre calles, en mm.
 * @param {number} [params.margenMinimo=10]              Margen mínimo de trim al borde, en mm.
 * @param {boolean} [params.permitirRotacion=true]       Probar la pieza girada 90°.
 * @param {string} [params.estrategia="shelf"]
 */
export function calcularPose(params = {}) {
  const estrategia = params.estrategia ?? PARAMETROS_POR_DEFECTO.estrategia;
  const resolver = ESTRATEGIAS[estrategia];
  if (!resolver) {
    throw new ErrorDePose(
      `Estrategia "${estrategia}" desconocida. Disponibles: ${estrategiasDisponibles().join(', ')}.`,
      'estrategia',
    );
  }

  const cfg = validarParametros(params, {
    ...PARAMETROS_POR_DEFECTO,
    pliego: PLIEGO_POR_DEFECTO,
  });

  const { pliego, pieza, sangrado, espaciado, margenMinimo, permitirRotacion } = cfg;

  // Una pieza que no entra ni girada es un error del pedido, no un resultado 0.
  const entraDerecha = pieza.ancho + margenMinimo * 2 <= pliego.ancho && pieza.alto + margenMinimo * 2 <= pliego.alto;
  const entraGirada =
    permitirRotacion && pieza.alto + margenMinimo * 2 <= pliego.ancho && pieza.ancho + margenMinimo * 2 <= pliego.alto;
  if (!entraDerecha && !entraGirada) {
    throw new ErrorDePose(
      `La pieza de ${pieza.ancho}×${pieza.alto} mm no entra en un pliego de ` +
        `${pliego.ancho}×${pliego.alto} mm respetando un margen de ${margenMinimo} mm por lado.`,
      'pieza',
    );
  }

  const calle = redondear(sangrado * 2 + espaciado);
  const grilla = resolver({ pliego, pieza, calle, margenMinimo, permitirRotacion });
  const { columnas, filas, cantidad, rotada, piezaEfectiva, orientacion } = grilla;

  const bloque = calcularBloque({ pliego, piezaEfectiva, columnas, filas, calle });
  const posiciones = generarPosiciones({ bloque, piezaEfectiva, columnas, filas, calle, rotada, sangrado });
  const marcasCorte = generarMarcasCorte({ bloque, piezaEfectiva, columnas, filas, calle });
  const ticks = generarTicks({ pliego, bloque, marcasCorte, sangrado });
  const advertencias = revisarEspacioDeMarcas({ pliego, bloque, sangrado });

  const areaPliego = pliego.ancho * pliego.alto;
  const areaUtil = cantidad * pieza.ancho * pieza.alto;

  return {
    estrategia,
    cantidad,
    orientacion,
    rotada,
    columnas,
    filas,
    aprovechamiento: redondear(areaUtil / areaPliego, 4),
    desperdicio_mm2: redondear(areaPliego - areaUtil, 2),
    pliego,
    pieza,
    piezaEfectiva,
    parametros: { sangrado, espaciado, margenMinimo, permitirRotacion, calle },
    bloque,
    pitch: { x: redondear(piezaEfectiva.ancho + calle), y: redondear(piezaEfectiva.alto + calle) },
    posiciones,
    marcasCorte,
    ticks,
    totalLineasDeMarca: marcasCorte.verticales.length + marcasCorte.horizontales.length,
    totalMarcas: (marcasCorte.verticales.length + marcasCorte.horizontales.length) * 2,
    marcas: { largo: MARCAS.largo, grosorPt: MARCAS.grosorPt, separacion: sangrado },
    advertencias,
  };
}
