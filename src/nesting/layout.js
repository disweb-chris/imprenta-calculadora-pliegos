/**
 * Construcción del layout a partir de una grilla resuelta: posiciones de las
 * piezas, líneas de trim y ticks de guillotina.
 *
 * Todo redondeado a 4 decimales para evitar ruido de punto flotante en las
 * coordenadas (las medidas del taller no pasan de la décima de milímetro).
 */

import { MARCAS } from '../config/defaults.js';

const redondear = (n) => Math.round(n * 1e4) / 1e4;

/**
 * Centra el bloque de trim en el pliego.
 *
 * `margenMinimo` es una RESTRICCIÓN, no la posición final: el sobrante entre
 * el bloque y el pliego se reparte en partes iguales entre los dos márgenes.
 * En la pose de tarot de referencia eso da 11 mm de margen lateral y 49 mm de
 * margen superior/inferior — distintos entre sí, que es la prueba de que el
 * bloque va centrado y no anclado.
 */
export function calcularBloque({ pliego, piezaEfectiva, columnas, filas, calle }) {
  const anchoBloque = columnas > 0 ? columnas * piezaEfectiva.ancho + (columnas - 1) * calle : 0;
  const altoBloque = filas > 0 ? filas * piezaEfectiva.alto + (filas - 1) * calle : 0;

  return {
    ancho: redondear(anchoBloque),
    alto: redondear(altoBloque),
    margenIzquierdo: redondear((pliego.ancho - anchoBloque) / 2),
    margenDerecho: redondear((pliego.ancho - anchoBloque) / 2),
    margenSuperior: redondear((pliego.alto - altoBloque) / 2),
    margenInferior: redondear((pliego.alto - altoBloque) / 2),
  };
}

/**
 * Genera el array de posiciones. El origen (0,0) es la esquina superior
 * izquierda del pliego; `x`/`y` son la esquina superior izquierda del TRIM de
 * la pieza. `sangradoCaja` es la caja de arte con sangrado incluido.
 */
export function generarPosiciones({ bloque, piezaEfectiva, columnas, filas, calle, rotada, sangrado }) {
  const pitchX = piezaEfectiva.ancho + calle;
  const pitchY = piezaEfectiva.alto + calle;
  const posiciones = [];

  for (let fila = 0; fila < filas; fila += 1) {
    for (let columna = 0; columna < columnas; columna += 1) {
      const x = redondear(bloque.margenIzquierdo + columna * pitchX);
      const y = redondear(bloque.margenSuperior + fila * pitchY);

      posiciones.push({
        indice: fila * columnas + columna,
        fila,
        columna,
        x,
        y,
        ancho: piezaEfectiva.ancho,
        alto: piezaEfectiva.alto,
        rotada,
        sangradoCaja: {
          x: redondear(x - sangrado),
          y: redondear(y - sangrado),
          ancho: redondear(piezaEfectiva.ancho + sangrado * 2),
          alto: redondear(piezaEfectiva.alto + sangrado * 2),
        },
      });
    }
  }

  return posiciones;
}

/**
 * Líneas de trim: DOS por calle, una por cada borde de pieza.
 *
 * La guillotina hace doble pasada y cae una tira de descarte del ancho de la
 * calle. En los bordes exteriores del bloque va una sola línea.
 * Para C columnas salen 2·C líneas verticales; para F filas, 2·F horizontales.
 */
export function generarMarcasCorte({ bloque, piezaEfectiva, columnas, filas, calle }) {
  const pitchX = piezaEfectiva.ancho + calle;
  const pitchY = piezaEfectiva.alto + calle;

  const verticales = [];
  for (let c = 0; c < columnas; c += 1) {
    const izquierda = bloque.margenIzquierdo + c * pitchX;
    verticales.push(redondear(izquierda), redondear(izquierda + piezaEfectiva.ancho));
  }

  const horizontales = [];
  for (let f = 0; f < filas; f += 1) {
    const arriba = bloque.margenSuperior + f * pitchY;
    horizontales.push(redondear(arriba), redondear(arriba + piezaEfectiva.alto));
  }

  return { verticales, horizontales };
}

/**
 * Convierte las líneas de trim en segmentos dibujables (ticks).
 *
 * Los ticks viven SOLO en el margen del pliego, nunca cruzando el arte:
 * arrancan donde termina la caja de sangrado del bloque y se alejan del arte.
 * Cada línea de trim vertical genera un tick arriba y otro abajo; cada línea
 * horizontal, uno a izquierda y otro a derecha.
 */
export function generarTicks({ pliego, bloque, marcasCorte, sangrado, largo = MARCAS.largo, separacion }) {
  const sep = separacion ?? MARCAS.separacion ?? sangrado;
  const ticks = [];

  const topeSuperior = bloque.margenSuperior - sep;
  const topeInferior = pliego.alto - bloque.margenInferior + sep;
  for (const x of marcasCorte.verticales) {
    ticks.push({ orientacion: 'vertical', borde: 'superior', x1: x, y1: redondear(topeSuperior - largo), x2: x, y2: redondear(topeSuperior) });
    ticks.push({ orientacion: 'vertical', borde: 'inferior', x1: x, y1: redondear(topeInferior), x2: x, y2: redondear(topeInferior + largo) });
  }

  const topeIzquierdo = bloque.margenIzquierdo - sep;
  const topeDerecho = pliego.ancho - bloque.margenDerecho + sep;
  for (const y of marcasCorte.horizontales) {
    ticks.push({ orientacion: 'horizontal', borde: 'izquierdo', x1: redondear(topeIzquierdo - largo), y1: y, x2: redondear(topeIzquierdo), y2: y });
    ticks.push({ orientacion: 'horizontal', borde: 'derecho', x1: redondear(topeDerecho), y1: y, x2: redondear(topeDerecho + largo), y2: y });
  }

  return ticks;
}

/**
 * Verifica que los ticks entren en el margen sin salirse del pliego.
 * No es un error fatal: se reporta como advertencia para que el operador
 * decida (a veces se imprime con pinza y sobra papel fuera del pliego útil).
 */
export function revisarEspacioDeMarcas({ pliego, bloque, sangrado, largo = MARCAS.largo, separacion }) {
  const sep = separacion ?? MARCAS.separacion ?? sangrado;
  const necesario = sep + largo;
  const advertencias = [];

  if (bloque.margenIzquierdo < necesario || bloque.margenDerecho < necesario) {
    advertencias.push(
      `El margen lateral (${bloque.margenIzquierdo} mm) es menor que los ${necesario} mm ` +
        'que necesitan las marcas de corte; los ticks horizontales se recortan contra el borde.',
    );
  }
  if (bloque.margenSuperior < necesario || bloque.margenInferior < necesario) {
    advertencias.push(
      `El margen superior/inferior (${bloque.margenSuperior} mm) es menor que los ${necesario} mm ` +
        'que necesitan las marcas de corte; los ticks verticales se recortan contra el borde.',
    );
  }

  return advertencias;
}
