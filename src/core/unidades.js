/**
 * Conversión de unidades.
 *
 * El módulo de nesting trabaja íntegramente en milímetros. La calculadora del
 * sitio mezcla unidades: pliego y pieza en centímetros, demasía y separación
 * en milímetros. Estas funciones traducen entre las dos convenciones para no
 * repetir el `/10` disperso por el código, que es donde se cuelan los errores.
 */

export const cmAmm = (cm) => cm * 10;
export const mmAcm = (mm) => mm / 10;

/**
 * Traduce el pedido de la calculadora del sitio a parámetros de pose en mm.
 *
 * @param {object} entrada
 * @param {number} entrada.sheetW  Ancho de pliego, en cm.
 * @param {number} entrada.sheetH  Alto de pliego, en cm.
 * @param {number} entrada.itemW   Ancho de pieza, en cm.
 * @param {number} entrada.itemH   Alto de pieza, en cm.
 * @param {number} [entrada.bleed]   Demasía por lado, en mm.
 * @param {number} [entrada.gutter]  Separación entre piezas, en mm.
 */
export function desdeCalculadora({ sheetW, sheetH, itemW, itemH, bleed = 3, gutter = 0, ...resto }) {
  return {
    pliego: { ancho: cmAmm(sheetW), alto: cmAmm(sheetH) },
    pieza: { ancho: cmAmm(itemW), alto: cmAmm(itemH) },
    sangrado: bleed,
    espaciado: gutter,
    ...resto,
  };
}
