/**
 * Demasía sintética para archivos que vinieron sin ella.
 *
 * Cuando el arte llega al tamaño exacto de corte, no hay tinta para el
 * sangrado y cualquier corrimiento de guillotina deja un filo blanco. La
 * técnica estándar del oficio es **espejar los bordes**: se refleja la banda
 * exterior del arte hacia afuera del corte.
 *
 * Se dibuja la pieza nueve veces: el arte al centro, cuatro bandas espejadas
 * sobre cada lado, y cuatro esquinas espejadas en los dos ejes. Cada copia va
 * recortada a su banda, así que fuera del trim sólo se ve el reflejo.
 *
 *        ┌───┬───────────┬───┐
 *        │ ↖ │     ↑     │ ↗ │     esquinas: espejo en X e Y
 *        ├───┼───────────┼───┤
 *        │ ← │   arte    │ → │     bandas: espejo en un eje
 *        ├───┼───────────┼───┤
 *        │ ↙ │     ↓     │ ↘ │
 *        └───┴───────────┴───┘
 *
 * Funciona muy bien con fondos, texturas y degradés —el caso de un dorso de
 * naipe o un borde ornamental— y puede quedar raro si el arte tiene un motivo
 * reconocible pegado al corte. Por eso el informe marca siempre qué páginas
 * necesitaron demasía sintética, para que el operador las mire antes de
 * mandar a imprimir.
 */

import {
  pushGraphicsState, popGraphicsState, concatTransformationMatrix,
  rectangle, clip, endPath,
} from 'pdf-lib';

/**
 * Coloca el arte en una celda que puede estar girada 90°.
 *
 * Cuando la pose decide rotar la pieza, la celda queda apaisada pero el arte
 * sigue siendo el mismo rectángulo parado: hay que **girarlo**, no estirarlo.
 * Estirarlo deformaría el diseño, que es lo que pasaba antes de este cambio.
 *
 * Se gira 90° en sentido antihorario con la matriz [0 1 −1 0 tx ty], y el arte
 * se dibuja en su orientación natural dentro del sistema girado.
 *
 * @param {Function} dibujar  Recibe la celda ya en el sistema de coordenadas
 *        correcto y dibuja el arte ahí.
 */
function enLaCelda(hoja, celda, rotada, dibujar) {
  if (!rotada) {
    dibujar(celda);
    return;
  }

  hoja.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(0, 1, -1, 0, celda.x + celda.ancho, celda.y),
  );
  // Ya girado, la celda vuelve a ser la del arte: parada y en el origen.
  dibujar({ x: 0, y: 0, ancho: celda.alto, alto: celda.ancho });
  hoja.pushOperators(popGraphicsState());
}

/**
 * Dibuja una pieza con demasía espejada.
 *
 * @param {import('pdf-lib').PDFPage} hoja
 * @param {import('pdf-lib').PDFEmbeddedPage} arte  Embebido recortado al trim.
 * @param {object} destino  Caja de trim en puntos, origen abajo-izquierda.
 * @param {number} destino.x
 * @param {number} destino.y
 * @param {number} destino.ancho
 * @param {number} destino.alto
 * @param {number} sangrado  En puntos.
 * @param {boolean} [rotada=false]  La pose puso la pieza de costado.
 */
export function dibujarConDemasiaEspejada(hoja, arte, celda, sangrado, rotada = false) {
  enLaCelda(hoja, celda, rotada, (destino) => espejarEn(hoja, arte, destino, sangrado));
}

function espejarEn(hoja, arte, destino, sangrado) {
  const { x, y, ancho, alto } = destino;
  const s = sangrado;

  // El arte tal cual, dentro del corte.
  hoja.drawPage(arte, { x, y, width: ancho, height: alto });

  if (s <= 0) return;

  const derecha = x + ancho;
  const arriba = y + alto;

  // Cada banda: el rectángulo a rellenar y el espejo que la genera.
  //   ejeX / ejeY: sobre qué coordenada se refleja (null = no se refleja).
  const bandas = [
    { caja: [x - s, y, s, alto], ejeX: x, ejeY: null },              // izquierda
    { caja: [derecha, y, s, alto], ejeX: derecha, ejeY: null },      // derecha
    { caja: [x, arriba, ancho, s], ejeX: null, ejeY: arriba },       // arriba
    { caja: [x, y - s, ancho, s], ejeX: null, ejeY: y },             // abajo
    { caja: [x - s, arriba, s, s], ejeX: x, ejeY: arriba },          // esquinas
    { caja: [derecha, arriba, s, s], ejeX: derecha, ejeY: arriba },
    { caja: [x - s, y - s, s, s], ejeX: x, ejeY: y },
    { caja: [derecha, y - s, s, s], ejeX: derecha, ejeY: y },
  ];

  for (const { caja, ejeX, ejeY } of bandas) {
    const escalaX = ejeX === null ? 1 : -1;
    const escalaY = ejeY === null ? 1 : -1;

    hoja.pushOperators(
      pushGraphicsState(),
      // El recorte se define en el espacio de la hoja, antes del espejo.
      rectangle(caja[0], caja[1], caja[2], caja[3]),
      clip(),
      endPath(),
      // Reflexión sobre el borde del trim: x' = 2·eje − x.
      concatTransformationMatrix(
        escalaX, 0, 0, escalaY,
        ejeX === null ? 0 : 2 * ejeX,
        ejeY === null ? 0 : 2 * ejeY,
      ),
    );
    hoja.drawPage(arte, { x, y, width: ancho, height: alto });
    hoja.pushOperators(popGraphicsState());
  }
}

/**
 * Dibuja una pieza cuyo arte ya trae demasía: la caja de sangrado del origen
 * va sobre la caja de sangrado del destino, sin espejar nada.
 */
export function dibujarConDemasiaPropia(hoja, arte, celda, sangrado, rotada = false) {
  enLaCelda(hoja, celda, rotada, (destino) => {
    hoja.drawPage(arte, {
      x: destino.x - sangrado,
      y: destino.y - sangrado,
      width: destino.ancho + sangrado * 2,
      height: destino.alto + sangrado * 2,
    });
  });
}
