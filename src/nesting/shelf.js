/**
 * Estrategia "shelf": empaquetado en grilla regular.
 *
 * Cubre el 95% de los trabajos de la imprenta (stickers, etiquetas, tarjetas,
 * cartas): todas las piezas son el mismo rectángulo, así que la grilla regular
 * es óptima y además es la única que la guillotina puede cortar de una pasada.
 *
 * ── Modelo de medidas ────────────────────────────────────────────────────
 *
 *   caja de sangrado = trim + sangrado * 2      (la mancha de tinta de la pieza)
 *   pitch            = trim + sangrado * 2 + espaciado
 *   calle            = sangrado * 2 + espaciado (separación entre dos trims)
 *
 * N piezas ocupan `N · pitch − espaciado` de tinta: hay N cajas de sangrado
 * separadas por N−1 espaciados. De ahí sale la cantidad que entra:
 *
 *   N = floor((pliego − margen · 2 + espaciado) / pitch)
 *
 * Con `margen = 0` esto es exactamente la fórmula de la calculadora en
 * producción, que suma la demasía a la pieza y hace
 * `floor((pliego + separación) / (piezaEfectiva + separación))`.
 *
 * El margen es el más exigente de dos restricciones sobre la misma distancia
 * (borde del pliego a la tinta): `margenMinimo`, la pinza de la máquina, y
 * `margenMarcas`, el lugar que necesitan las marcas de corte. Sin el segundo,
 * el 27% de las poses sale sin manera de marcarla para la guillotina.
 */

/**
 * Cuántas piezas de `lado` entran en `medida`.
 * Todas las medidas en mm.
 */
export function contar({ medida, lado, sangrado, espaciado, margenEfectivo }) {
  const pitch = lado + sangrado * 2 + espaciado;
  if (pitch <= 0) return 0;
  const disponible = medida - margenEfectivo * 2 + espaciado;
  if (disponible <= 0) return 0;
  return Math.max(0, Math.floor(disponible / pitch));
}

/** Calcula la grilla para una orientación concreta de la pieza. */
export function calcularGrilla({ pliego, pieza, sangrado, espaciado, margenEfectivo }) {
  const columnas = contar({ medida: pliego.ancho, lado: pieza.ancho, sangrado, espaciado, margenEfectivo });
  const filas = contar({ medida: pliego.alto, lado: pieza.alto, sangrado, espaciado, margenEfectivo });
  return { columnas, filas, cantidad: columnas * filas };
}

/** Tinta que ocupa el bloque en un eje: N cajas de sangrado y N−1 espaciados. */
const anchoDeTinta = (n, lado, sangrado, espaciado) =>
  n > 0 ? n * (lado + sangrado * 2) + (n - 1) * espaciado : 0;

/**
 * Resuelve la mejor grilla probando la pieza derecha y, si está permitido,
 * girada 90°. Gana la que entre más piezas.
 *
 * ── Desempate ────────────────────────────────────────────────────────────
 *
 * A igualdad de cantidad se prefiere **no rotar**. La calculadora en
 * producción desempata por `sobranteAncho + sobranteAlto` (suma un sobrante
 * horizontal con uno vertical, que no es una magnitud comparable) y por eso
 * elige mal el mazo de tarot: 2×6 rotada en vez de 4×3, porque 8.2 < 10.8.
 * Las dos poses dan 12 cartas, pero la rotada deja 7 mm de margen vertical
 * contra 46 mm de la derecha, y obliga a girar el arte de todas las cartas.
 * Ver docs/NESTING.md § "Desempate de orientación".
 */
export function resolverShelf({ pliego, pieza, sangrado, espaciado, margenEfectivo, permitirRotacion }) {
  const candidatos = [{ rotada: false, piezaEfectiva: { ancho: pieza.ancho, alto: pieza.alto } }];

  if (permitirRotacion && pieza.ancho !== pieza.alto) {
    candidatos.push({ rotada: true, piezaEfectiva: { ancho: pieza.alto, alto: pieza.ancho } });
  }

  let mejor = null;
  for (const candidato of candidatos) {
    const grilla = calcularGrilla({
      pliego,
      pieza: candidato.piezaEfectiva,
      sangrado,
      espaciado,
      margenEfectivo,
    });
    // Sólo gana por cantidad estricta: a igualdad se queda el primero, que es
    // el candidato sin rotar.
    if (!mejor || grilla.cantidad > mejor.cantidad) mejor = { ...grilla, ...candidato };
  }

  const { piezaEfectiva, columnas, filas } = mejor;

  // Las dos orientaciones, para que la UI pueda mostrarlas lado a lado.
  const alternativas = {
    normal: calcularGrilla({ pliego, pieza, sangrado, espaciado, margenEfectivo }),
    rotada: calcularGrilla({
      pliego,
      pieza: { ancho: pieza.alto, alto: pieza.ancho },
      sangrado,
      espaciado,
      margenEfectivo,
    }),
  };

  return {
    ...mejor,
    alternativas,
    orientacion: piezaEfectiva.alto >= piezaEfectiva.ancho ? 'vertical' : 'horizontal',
    tinta: {
      ancho: anchoDeTinta(columnas, piezaEfectiva.ancho, sangrado, espaciado),
      alto: anchoDeTinta(filas, piezaEfectiva.alto, sangrado, espaciado),
    },
  };
}
