/**
 * Cálculo de pliegos: cuántos pliegos hacen falta para una tirada, dada una
 * pose ya resuelta. Función pura, sin dependencias de HTTP.
 */

/**
 * @param {object} params
 * @param {number} params.cantidadPedida    Piezas que pide el cliente.
 * @param {number} params.piezasPorPliego   Salida de `calcularPose().cantidad`.
 * @param {number} [params.demasia=0]       Pliegos extra de arranque/merma.
 * @param {number} [params.caras=1]         1 = simple faz, 2 = doble faz.
 */
export function calcularPliegos({ cantidadPedida, piezasPorPliego, demasia = 0, caras = 1 }) {
  if (!Number.isFinite(cantidadPedida) || cantidadPedida <= 0) {
    throw new Error('"cantidadPedida" tiene que ser un número mayor que cero.');
  }
  if (!Number.isFinite(piezasPorPliego) || piezasPorPliego <= 0) {
    throw new Error('"piezasPorPliego" tiene que ser un número mayor que cero.');
  }
  if (caras !== 1 && caras !== 2) {
    throw new Error('"caras" tiene que ser 1 (simple faz) o 2 (doble faz).');
  }

  const pliegosNetos = Math.ceil(cantidadPedida / piezasPorPliego);
  const pliegosTotales = pliegosNetos + demasia;

  return {
    pliegosNetos,
    demasia,
    pliegosTotales,
    /** Pasadas de máquina: la doble faz se imprime dos veces sobre el mismo pliego. */
    pasadas: pliegosTotales * caras,
    piezasProducidas: pliegosTotales * piezasPorPliego,
    sobrante: pliegosTotales * piezasPorPliego - cantidadPedida,
  };
}
