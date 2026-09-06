/**
 * Marcas de corte sobre el pliego impuesto.
 *
 * Van en **negro de registro**: CMYK 100/100/100/100. Eso hace que la marca
 * salga en las cuatro planchas y quede negra aunque el registro de la máquina
 * se corra un pelo. Un negro plano (0/0/0/100) sale sólo en la plancha del
 * negro y es más difícil de ver contra el arte.
 */

import { cmyk } from 'pdf-lib';
import { mmApt } from './unidades.js';

const NEGRO_DE_REGISTRO = cmyk(1, 1, 1, 1);

/**
 * @param {import('pdf-lib').PDFPage} hoja
 * @param {object} pose        Resultado de calcularPose (una cara), en mm.
 * @param {object} [opciones]
 * @param {number} [opciones.largo=5]      Largo del tick, en mm.
 * @param {number} [opciones.grosorPt=0.25]
 */
export function dibujarMarcas(hoja, pose, { largo = 5, grosorPt = 0.25 } = {}) {
  const altoPliego = mmApt(pose.pliego.alto);
  const grosor = grosorPt * (72 / 72); // los puntos del PDF ya son puntos tipográficos

  for (const tick of pose.ticks) {
    // El módulo de pose usa origen arriba-izquierda; el PDF, abajo-izquierda.
    hoja.drawLine({
      start: { x: mmApt(tick.x1), y: altoPliego - mmApt(tick.y1) },
      end: { x: mmApt(tick.x2), y: altoPliego - mmApt(tick.y2) },
      color: NEGRO_DE_REGISTRO,
      thickness: grosor,
    });
  }
}
