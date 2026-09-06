/**
 * Reglas de pricing. Las funciones son puras y reciben la tabla de precios
 * como argumento: este módulo NO conoce ningún número del negocio.
 *
 * La tabla real vive todavía en el microservicio de Cloud Run; ver Etapa 0.
 */

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
  const aplicables = escalas
    .filter((e) => cantidad >= e.desde)
    .sort((a, b) => b.desde - a.desde);

  if (aplicables.length === 0) {
    throw new Error(`La cantidad ${cantidad} está por debajo de la escala mínima.`);
  }
  return aplicables[0].precioUnitario;
}

/**
 * Cotiza un trabajo a partir de la pose y la tirada.
 *
 * @param {object} params
 * @param {number} params.pliegosTotales
 * @param {number} params.precioPorPliego
 * @param {number} [params.costoFijo=0]     Preparación, clisé, arranque.
 * @param {number} [params.pasadas=1]       Pasadas de máquina (2 en doble faz).
 * @param {number} [params.precioPorPasada=0]
 */
export function cotizar({
  pliegosTotales,
  precioPorPliego,
  costoFijo = 0,
  pasadas = 1,
  precioPorPasada = 0,
}) {
  for (const [nombre, valor] of Object.entries({ pliegosTotales, precioPorPliego, costoFijo, pasadas, precioPorPasada })) {
    if (!Number.isFinite(valor) || valor < 0) {
      throw new Error(`"${nombre}" tiene que ser un número mayor o igual a cero.`);
    }
  }

  const materiales = pliegosTotales * precioPorPliego;
  const impresion = pasadas * precioPorPasada;
  const total = materiales + impresion + costoFijo;

  return {
    materiales: redondearPesos(materiales),
    impresion: redondearPesos(impresion),
    costoFijo: redondearPesos(costoFijo),
    total: redondearPesos(total),
  };
}

const redondearPesos = (n) => Math.round(n * 100) / 100;
