/**
 * Selección y orden de las páginas del arte.
 *
 * Un PDF real casi nunca viene listo para imponer tal cual: trae una portada
 * adelante, el dorso en la misma tirada, o dos cartas cambiadas de lugar. Acá
 * se resuelve qué páginas entran y en qué orden, antes de tocar la geometría.
 */

import { ErrorDePose } from '../nesting/validacion.js';

/**
 * Convierte una selección a índices 0-based, validando contra el documento.
 *
 * @param {number[]|undefined} seleccion  Páginas 1-based, en orden de imposición.
 *        Sin selección, entran todas las páginas en el orden del archivo.
 * @param {number} total   Páginas que tiene el documento.
 * @param {string} campo   Para el mensaje de error.
 */
export function resolverSeleccion(seleccion, total, campo) {
  if (seleccion === undefined) return Array.from({ length: total }, (_, i) => i);

  if (!Array.isArray(seleccion) || seleccion.length === 0) {
    throw new ErrorDePose(`"${campo}" tiene que ser una lista de páginas.`, campo);
  }

  return seleccion.map((n) => {
    if (!Number.isInteger(n) || n < 1 || n > total) {
      throw new ErrorDePose(
        `"${campo}" pide la página ${n}, y el documento tiene ${total}.`,
        campo,
      );
    }
    return n - 1;
  });
}

/**
 * Interpreta un rango de páginas escrito a mano: `"3,2,4-27"`.
 *
 * El orden se respeta tal cual se escribe —`"3,2"` no es lo mismo que `"2,3"`—
 * porque es justamente lo que sirve para corregir dos cartas cambiadas. Un
 * rango descendente (`"27-4"`) cuenta para atrás.
 */
export function interpretarRango(texto, campo = 'páginas') {
  const paginas = [];

  for (const parte of String(texto).split(',')) {
    const limpio = parte.trim();
    if (!limpio) continue;

    const rango = /^(\d+)\s*-\s*(\d+)$/.exec(limpio);
    if (rango) {
      const desde = Number(rango[1]);
      const hasta = Number(rango[2]);
      const paso = desde <= hasta ? 1 : -1;
      for (let n = desde; paso > 0 ? n <= hasta : n >= hasta; n += paso) paginas.push(n);
      continue;
    }

    if (!/^\d+$/.test(limpio)) {
      throw new ErrorDePose(
        `No entiendo "${limpio}" en ${campo}. Esperaba números y rangos: "1,3,5-12".`,
        campo,
      );
    }
    paginas.push(Number(limpio));
  }

  if (paginas.length === 0) {
    throw new ErrorDePose(`${campo} quedó vacío.`, campo);
  }
  return paginas;
}
