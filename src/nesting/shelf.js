/**
 * Estrategia "shelf": empaquetado en grilla regular.
 *
 * Cubre el 95% de los trabajos de la imprenta (stickers, etiquetas, tarjetas,
 * cartas): todas las piezas son el mismo rectángulo, así que la grilla regular
 * es óptima y además es la única que la guillotina puede cortar de una pasada.
 *
 * Modelo de márgenes — esto es lo importante y difiere del cálculo ingenuo:
 *
 *   calle = sangrado * 2 + espaciado     (separación entre dos trims contiguos)
 *   pitch = lado de la pieza + calle
 *
 * Entre dos piezas contiguas hay una calle completa, pero DESPUÉS de la última
 * pieza no hay calle: lo que tiene que respetar el margen mínimo es el bloque
 * de TRIM, no el bloque de pitches. Por eso:
 *
 *   n = floor((util + calle) / pitch)     y NO     floor(util / pitch)
 *
 * El sangrado exterior del bloque (3 mm) invade el margen, que es exactamente
 * lo que pasa en producción: en la pose de tarot de referencia el margen de
 * trim es 11 mm y el sangrado llega hasta los 8 mm del borde del pliego.
 */

/**
 * Calcula la grilla para una orientación concreta de la pieza.
 * @returns {{columnas:number, filas:number, cantidad:number}}
 */
export function calcularGrilla({ pliego, pieza, calle, margenMinimo }) {
  const utilAncho = pliego.ancho - margenMinimo * 2;
  const utilAlto = pliego.alto - margenMinimo * 2;

  const columnas = contar(utilAncho, pieza.ancho, calle);
  const filas = contar(utilAlto, pieza.alto, calle);

  return { columnas, filas, cantidad: columnas * filas };
}

function contar(disponible, lado, calle) {
  if (disponible <= 0) return 0;
  const n = Math.floor((disponible + calle) / (lado + calle));
  return Math.max(0, n);
}

/**
 * Resuelve la mejor grilla probando la pieza en su orientación original y,
 * si está permitido, girada 90°. Gana la que entre más piezas; a igualdad de
 * cantidad se prefiere no rotar (menos manipulación del arte).
 *
 * @returns {{columnas:number, filas:number, cantidad:number, rotada:boolean,
 *            piezaEfectiva:{ancho:number,alto:number}, orientacion:string}}
 */
export function resolverShelf({ pliego, pieza, calle, margenMinimo, permitirRotacion }) {
  const candidatos = [
    { rotada: false, piezaEfectiva: { ancho: pieza.ancho, alto: pieza.alto } },
  ];

  if (permitirRotacion && pieza.ancho !== pieza.alto) {
    candidatos.push({ rotada: true, piezaEfectiva: { ancho: pieza.alto, alto: pieza.ancho } });
  }

  let mejor = null;
  for (const candidato of candidatos) {
    const grilla = calcularGrilla({
      pliego,
      pieza: candidato.piezaEfectiva,
      calle,
      margenMinimo,
    });
    const resultado = { ...grilla, ...candidato };
    if (!mejor || resultado.cantidad > mejor.cantidad) mejor = resultado;
  }

  return {
    ...mejor,
    orientacion: mejor.piezaEfectiva.alto >= mejor.piezaEfectiva.ancho ? 'vertical' : 'horizontal',
  };
}
