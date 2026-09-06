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
 * Centra el bloque en el pliego y devuelve sus dos juegos de márgenes.
 *
 * `margenMinimo` es una RESTRICCIÓN, no la posición final: el sobrante entre
 * la tinta y el pliego se reparte en partes iguales entre los dos lados.
 *
 * Se reportan dos márgenes distintos porque el taller usa los dos:
 *
 *   margenSangrado → del borde del pliego al borde de la TINTA. Es el que
 *                    tiene que respetar la pinza de la máquina y donde entran
 *                    las marcas de corte.
 *   margenTrim     → del borde del pliego a la primera línea de CORTE.
 *                    Siempre es `margenSangrado + sangrado`.
 *
 * En la pose de tarot de referencia eso da 8 mm de tinta / 11 mm de trim a los
 * costados, y 46 / 49 mm arriba y abajo. Que lateral y vertical den distinto
 * es la prueba de que el bloque va centrado y no anclado a un margen fijo.
 */
export function calcularBloque({ pliego, piezaEfectiva, columnas, filas, sangrado, espaciado }) {
  const calle = sangrado * 2 + espaciado;

  const tintaAncho = columnas > 0 ? columnas * (piezaEfectiva.ancho + sangrado * 2) + (columnas - 1) * espaciado : 0;
  const tintaAlto = filas > 0 ? filas * (piezaEfectiva.alto + sangrado * 2) + (filas - 1) * espaciado : 0;

  const trimAncho = columnas > 0 ? columnas * piezaEfectiva.ancho + (columnas - 1) * calle : 0;
  const trimAlto = filas > 0 ? filas * piezaEfectiva.alto + (filas - 1) * calle : 0;

  const margenSangradoX = (pliego.ancho - tintaAncho) / 2;
  const margenSangradoY = (pliego.alto - tintaAlto) / 2;

  return {
    /** Bloque de líneas de corte: de la primera a la última. */
    ancho: redondear(trimAncho),
    alto: redondear(trimAlto),
    /** Bloque de tinta: incluye el sangrado exterior. */
    tinta: { ancho: redondear(tintaAncho), alto: redondear(tintaAlto) },

    margenIzquierdo: redondear(margenSangradoX + sangrado),
    margenDerecho: redondear(margenSangradoX + sangrado),
    margenSuperior: redondear(margenSangradoY + sangrado),
    margenInferior: redondear(margenSangradoY + sangrado),

    margenSangrado: {
      izquierdo: redondear(margenSangradoX),
      derecho: redondear(margenSangradoX),
      superior: redondear(margenSangradoY),
      inferior: redondear(margenSangradoY),
    },
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
 * arrancan donde termina la tinta del bloque y se alejan hacia el borde.
 * Cada línea de trim vertical genera un tick arriba y otro abajo; cada línea
 * horizontal, uno a izquierda y otro a derecha.
 */
export function generarTicks({ pliego, bloque, marcasCorte, largo = MARCAS.largo }) {
  const ticks = [];
  const m = bloque.margenSangrado;

  for (const x of marcasCorte.verticales) {
    ticks.push({ orientacion: 'vertical', borde: 'superior', x1: x, y1: redondear(m.superior - largo), x2: x, y2: redondear(m.superior) });
    ticks.push({ orientacion: 'vertical', borde: 'inferior', x1: x, y1: redondear(pliego.alto - m.inferior), x2: x, y2: redondear(pliego.alto - m.inferior + largo) });
  }

  for (const y of marcasCorte.horizontales) {
    ticks.push({ orientacion: 'horizontal', borde: 'izquierdo', x1: redondear(m.izquierdo - largo), y1: y, x2: redondear(m.izquierdo), y2: y });
    ticks.push({ orientacion: 'horizontal', borde: 'derecho', x1: redondear(pliego.ancho - m.derecho), y1: y, x2: redondear(pliego.ancho - m.derecho + largo), y2: y });
  }

  return ticks;
}

/**
 * Verifica que los ticks entren en el margen sin salirse del pliego.
 * No es un error fatal: se reporta como advertencia para que el operador
 * decida (a veces se imprime con pinza y sobra papel fuera del pliego útil).
 */
export function revisarEspacioDeMarcas({ bloque, largo = MARCAS.largo }) {
  const m = bloque.margenSangrado;
  const advertencias = [];

  if (m.izquierdo < largo || m.derecho < largo) {
    advertencias.push(
      `Del borde del pliego a la tinta quedan ${m.izquierdo} mm a los costados, menos que los ` +
        `${largo} mm del tick: las marcas de corte horizontales se recortan contra el borde.`,
    );
  }
  if (m.superior < largo || m.inferior < largo) {
    advertencias.push(
      `Del borde del pliego a la tinta quedan ${m.superior} mm arriba y abajo, menos que los ` +
        `${largo} mm del tick: las marcas de corte verticales se recortan contra el borde.`,
    );
  }

  return advertencias;
}
