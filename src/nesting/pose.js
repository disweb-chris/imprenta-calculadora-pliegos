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
 * @param {{ancho:number,alto:number}} [params.pliego]   Pliego en mm (32×47 cm por defecto).
 * @param {{ancho:number,alto:number}}  params.pieza     Tamaño final de corte (trim) en mm.
 * @param {number} [params.sangrado=3]                   Demasía por lado, en mm.
 * @param {number} [params.espaciado=0]                  Separación entre piezas, en mm.
 * @param {number} [params.margenMinimo=0]               Margen de pinza al borde, en mm.
 * @param {number} [params.margenMarcas=5]               Lugar reservado para las marcas de corte, en mm.
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

  const cfg = validarParametros(params, { ...PARAMETROS_POR_DEFECTO, pliego: PLIEGO_POR_DEFECTO });
  const { pliego, pieza, sangrado, espaciado, margenMinimo, margenMarcas, margenEfectivo, permitirRotacion } = cfg;

  const grilla = resolver({ pliego, pieza, sangrado, espaciado, margenEfectivo, permitirRotacion });
  const { columnas, filas, cantidad, rotada, piezaEfectiva, orientacion, alternativas } = grilla;

  // Una pieza que no entra ni girada es un error del pedido, no un resultado 0.
  if (cantidad <= 0) {
    throw new ErrorDePose(
      `La pieza de ${pieza.ancho}×${pieza.alto} mm con ${sangrado} mm de demasía por lado no entra ` +
        `en un pliego de ${pliego.ancho}×${pliego.alto} mm` +
        (margenEfectivo > 0
          ? ` dejando ${margenEfectivo} mm por lado` +
            (margenEfectivo === margenMarcas && margenMarcas > margenMinimo
              ? ' para las marcas de corte.'
              : ' de margen.')
          : '.'),
      'pieza',
    );
  }

  const calle = redondear(sangrado * 2 + espaciado);
  const bloque = calcularBloque({ pliego, piezaEfectiva, columnas, filas, sangrado, espaciado });
  const posiciones = generarPosiciones({ bloque, piezaEfectiva, columnas, filas, calle, rotada, sangrado });
  const marcasCorte = generarMarcasCorte({ bloque, piezaEfectiva, columnas, filas, calle });
  const ticks = generarTicks({ pliego, bloque, marcasCorte });
  const advertencias = revisarEspacioDeMarcas({ bloque });

  const areaPliego = pliego.ancho * pliego.alto;
  const areaUtil = cantidad * pieza.ancho * pieza.alto;

  return {
    estrategia,
    cantidad,
    orientacion,
    rotada,
    columnas,
    filas,
    alternativas,
    aprovechamiento: redondear(areaUtil / areaPliego, 4),
    desperdicio_mm2: redondear(areaPliego - areaUtil, 2),
    pliego,
    pieza,
    piezaEfectiva,
    /** La pieza tal como la ve la máquina: trim + demasía a los cuatro lados. */
    piezaConSangrado: {
      ancho: redondear(piezaEfectiva.ancho + sangrado * 2),
      alto: redondear(piezaEfectiva.alto + sangrado * 2),
    },
    parametros: { sangrado, espaciado, margenMinimo, margenMarcas, margenEfectivo, permitirRotacion, calle },
    bloque,
    pitch: { x: redondear(piezaEfectiva.ancho + calle), y: redondear(piezaEfectiva.alto + calle) },
    posiciones,
    marcasCorte,
    ticks,
    totalLineasDeMarca: marcasCorte.verticales.length + marcasCorte.horizontales.length,
    totalMarcas: (marcasCorte.verticales.length + marcasCorte.horizontales.length) * 2,
    marcas: { largo: MARCAS.largo, grosorPt: MARCAS.grosorPt },
    advertencias,
  };
}
