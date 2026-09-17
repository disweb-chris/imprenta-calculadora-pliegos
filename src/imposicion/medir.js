/**
 * Medición de un pliego ya impuesto, venga de donde venga.
 *
 * Lee el PDF con pdf.js y reconstruye la geometría a partir de lo que está
 * realmente dibujado: las marcas de corte. No mira cómo se armó el archivo,
 * así que sirve igual para un pliego que generó este servicio y para uno que
 * armó una persona en Illustrator. Es lo que permite comparar los dos.
 *
 * De las marcas se deduce todo lo demás: la grilla, el tamaño de la pieza, la
 * calle entre piezas y los márgenes.
 */

import { enMm, mmApt } from './unidades.js';

/** Un tick de guillotina mide unos 5 mm. Se aceptan trazos de 2 a 15 mm. */
const TICK_MIN_MM = 2;
const TICK_MAX_MM = 15;
/** Grosor máximo para considerar que un trazo es una línea y no un relleno. */
const GROSOR_MAX_MM = 0.6;
/** Dos marcas a menos de esto son la misma línea vista dos veces. */
const AGRUPAR_MM = 0.4;
/** Tolerancia al emparejar el tick de un borde con el del borde opuesto. */
const EMPAREJAR_MM = 0.6;

const multiplicar = (a, b) => [
  a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
  a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5],
];

const aplicar = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/**
 * Luminancia 0–1 de un color de trazo.
 *
 * pdf.js normaliza todo a RGB y lo entrega como string CSS (`"#06060c"`), no
 * como terna de números. El negro de registro, CMYK 100/100/100/100, llega
 * como un casi negro.
 */
function luminancia(color) {
  // pdf.js entrega el color de tres formas según la versión y el operador:
  // el string suelto, el string dentro de un array de un elemento, o una
  // terna de números. Se aceptan las tres.
  const valor = Array.isArray(color) && color.length === 1 ? color[0] : color;

  let r;
  let g;
  let b;

  if (typeof valor === 'string') {
    const hex = /^#?([\da-f]{6})$/i.exec(valor.trim());
    if (!hex) return 1; // color que no se puede leer: se trata como claro
    const n = parseInt(hex[1], 16);
    [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  } else if (Array.isArray(valor) && valor.length >= 3) {
    [r, g, b] = valor;
  } else {
    return 1;
  }

  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Una marca de corte va en negro de registro; el arte casi nunca es negro puro. */
const LUMINANCIA_MAXIMA = 0.35;

/**
 * Recorre la lista de operadores llevando la matriz de transformación, y
 * devuelve la caja de cada trazo ya en coordenadas de la página, en mm.
 */
function trazosDe(listaDeOperadores, OPS) {
  const { fnArray, argsArray } = listaDeOperadores;
  const trazos = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  let colorTrazo = '#000000';
  let recorte = SIN_RECORTE;
  const pila = [];

  /** Caja de un path del contenido, ya transformada a la página y en mm. */
  const cajaEnLaPagina = (caja) => {
    const [x0, y0] = aplicar(ctm, caja[0], caja[1]);
    const [x1, y1] = aplicar(ctm, caja[2], caja[3]);
    return {
      x: enMm(Math.min(x0, x1)), y: enMm(Math.min(y0, y1)),
      ancho: enMm(Math.abs(x1 - x0)), alto: enMm(Math.abs(y1 - y0)),
    };
  };

  for (let i = 0; i < fnArray.length; i += 1) {
    const fn = fnArray[i];

    if (fn === OPS.save) pila.push({ ctm, colorTrazo, recorte });
    else if (fn === OPS.restore) {
      const previo = pila.pop();
      if (previo) ({ ctm, colorTrazo, recorte } = previo);
    } else if (fn === OPS.transform) ctm = multiplicar(argsArray[i], ctm);
    else if (fn === OPS.setStrokeRGBColor) colorTrazo = argsArray[i];
    else if (fn === OPS.constructPath) {
      const caja = argsArray[i][2];
      if (!caja) continue;

      // Un path seguido de clip no es tinta: define hasta dónde se ve lo que
      // venga después. Hay que llevarlo, no descartarlo — el arte trae
      // geometría fuera de su propia página, que el recorte esconde, y sin
      // esto entra como ruido en la detección de marcas.
      const siguiente = fnArray[i + 1];
      if (siguiente === OPS.clip || siguiente === OPS.eoClip) {
        recorte = intersecar(recorte, cajaEnLaPagina(caja));
        continue;
      }

      const c = cajaEnLaPagina(caja);
      if (!seVe(c, recorte)) continue;

      trazos.push({ ...c, oscuro: luminancia(colorTrazo) <= LUMINANCIA_MAXIMA });
    }
  }
  return trazos;
}

/** Un recorte que no recorta nada, para arrancar. */
const SIN_RECORTE = { x0: -1e6, y0: -1e6, x1: 1e6, y1: 1e6 };

const intersecar = (a, b) => ({
  x0: Math.max(a.x0, b.x), y0: Math.max(a.y0, b.y),
  x1: Math.min(a.x1, b.x + b.ancho), y1: Math.min(a.y1, b.y + b.alto),
});

/**
 * Si la caja no toca el recorte vigente, lo que se dibuje ahí no se ve.
 * Se deja un margen de medio milímetro para no descartar un trazo que apoya
 * justo sobre el borde del recorte.
 */
function seVe(caja, recorte) {
  const holgura = 0.5;
  return (
    caja.x + caja.ancho >= recorte.x0 - holgura &&
    caja.x <= recorte.x1 + holgura &&
    caja.y + caja.alto >= recorte.y0 - holgura &&
    caja.y <= recorte.y1 + holgura
  );
}

/** Agrupa coordenadas casi iguales y devuelve el promedio de cada grupo. */
function agrupar(valores, tolerancia = AGRUPAR_MM) {
  const ordenados = [...valores].sort((a, b) => a - b);
  const grupos = [];
  for (const v of ordenados) {
    const ultimo = grupos.at(-1);
    if (ultimo && v - ultimo.at(-1) <= tolerancia) ultimo.push(v);
    else grupos.push([v]);
  }
  return grupos.map((g) => Math.round((g.reduce((s, v) => s + v, 0) / g.length) * 100) / 100);
}

/**
 * Deduce la pose a partir de las líneas de trim.
 *
 * Las marcas vienen de a pares —una por cada borde de pieza— así que de la
 * lista salen el tamaño de la pieza, la calle y el margen.
 */
function deducirEje(lineas, medidaPliego) {
  if (lineas.length < 2 || lineas.length % 2 !== 0) {
    return { cantidad: null, motivo: `${lineas.length} líneas: esperaba un número par y al menos 2.` };
  }

  const piezas = [];
  const calles = [];
  for (let i = 0; i < lineas.length; i += 2) {
    piezas.push(Math.round((lineas[i + 1] - lineas[i]) * 100) / 100);
    if (i + 2 < lineas.length) calles.push(Math.round((lineas[i + 2] - lineas[i + 1]) * 100) / 100);
  }

  const iguales = (xs) => xs.every((x) => Math.abs(x - xs[0]) <= 0.2);

  return {
    cantidad: lineas.length / 2,
    pieza: piezas[0],
    piezaUniforme: iguales(piezas),
    calle: calles.length ? calles[0] : 0,
    calleUniforme: calles.length === 0 || iguales(calles),
    margenInicio: lineas[0],
    margenFin: Math.round((medidaPliego - lineas.at(-1)) * 100) / 100,
  };
}

/**
 * Mide un pliego impuesto.
 *
 * @param {object} pdfjs   El módulo pdf.js ya importado.
 * @param {Uint8Array} bytes
 * @param {number[]} [paginas]  Páginas a medir, 1-based. Por defecto, todas.
 */
export async function medirPliego(pdfjs, bytes, paginas) {
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
  const OPS = pdfjs.OPS;
  const aMedir = paginas ?? Array.from({ length: doc.numPages }, (_, i) => i + 1);
  const medidas = [];

  for (const n of aMedir) {
    const pagina = await doc.getPage(n);
    const vista = pagina.getViewport({ scale: 1 });
    const pliego = { ancho: enMm(vista.width), alto: enMm(vista.height) };

    const trazos = trazosDe(await pagina.getOperatorList(), OPS);

    // Sólo trazos que caigan dentro del pliego: lo de afuera es arte recortado.
    const dentro = trazos.filter((t) =>
      t.x >= -1 && t.y >= -1 &&
      t.x + t.ancho <= pliego.ancho + 1 && t.y + t.alto <= pliego.alto + 1);

    const candidatosV = [];
    const candidatosH = [];
    for (const t of dentro) {
      if (!t.oscuro) continue;
      // Un tick vertical es alto y finísimo; uno horizontal, ancho y finísimo.
      if (t.ancho <= GROSOR_MAX_MM && t.alto >= TICK_MIN_MM && t.alto <= TICK_MAX_MM) {
        candidatosV.push({ pos: t.x + t.ancho / 2, banda: t.y + t.alto / 2 });
      } else if (t.alto <= GROSOR_MAX_MM && t.ancho >= TICK_MIN_MM && t.ancho <= TICK_MAX_MM) {
        candidatosH.push({ pos: t.y + t.alto / 2, banda: t.x + t.ancho / 2 });
      }
    }

    const lineasV = lineasDeCorte(candidatosV, pliego.alto);
    // El origen del PDF está abajo; la pose habla de arriba hacia abajo.
    const lineasH = agrupar(lineasDeCorte(candidatosH, pliego.ancho).map((y) => pliego.alto - y));

    medidas.push({
      pagina: n,
      pliego,
      marcasCorte: { verticales: lineasV, horizontales: lineasH },
      columnas: deducirEje(lineasV, pliego.ancho),
      filas: deducirEje(lineasH, pliego.alto),
      trazosLeidos: trazos.length,
    });
  }

  return medidas;
}

/**
 * Separa las marcas de corte del ruido del arte.
 *
 * Un filete decorativo de una carta es un trazo fino y corto igual que un
 * tick, así que la forma no alcanza para distinguirlos. Lo que sí los
 * distingue es una propiedad que sólo tienen las marcas de guillotina:
 * **aparecen de a pares en los dos bordes opuestos del pliego, en la misma
 * coordenada**. Para cada línea de trim hay un tick arriba y otro abajo.
 *
 * Entonces se piden tres cosas a la vez:
 *
 *   1. El trazo tiene que ser oscuro. Las marcas van en negro de registro; el
 *      arte casi nunca tiene filetes negros puros.
 *   2. Tiene que estar en la banda **más extrema** de su borde. Los filetes
 *      decorativos viven adentro del bloque, no contra el borde del pliego.
 *   3. Tiene que estar emparejado: la misma coordenada aparece en el borde de
 *      arriba y en el de abajo. El arte no cumple eso salvo por casualidad.
 *
 * Se probó también acotar por la mancha de tinta, y no sirve: los paths de
 * recorte y los fondos de página la estiran hasta el borde del pliego.
 */
function lineasDeCorte(candidatos, medidaTransversal) {
  if (candidatos.length < 4) return [];

  const VENTANA = 1;
  const enBanda = (b) => candidatos.filter((c) => Math.abs(c.banda - b) <= VENTANA);

  const posiciones = [...new Set(candidatos.map((c) => Math.round(c.banda * 10) / 10))]
    .sort((a, b) => a - b)
    .filter((b) => enBanda(b).length >= 2);

  const mitad = medidaTransversal / 2;
  const desdeElBorde = posiciones.filter((b) => b < mitad);
  const desdeElOtro = posiciones.filter((b) => b > mitad).reverse();

  // Se prueban todos los pares de bandas y gana el que describa la grilla más
  // completa. Un filete decorativo puede estar emparejado y contra el borde
  // por casualidad, pero es muy difícil que además produzca piezas y calles
  // todas iguales, y más difícil todavía que produzca más líneas que las
  // marcas de verdad.
  let mejor = [];
  let respaldo = [];

  for (const inicio of desdeElBorde) {
    for (const fin of desdeElOtro) {
      const arranque = agrupar(enBanda(inicio).map((c) => c.pos));
      const cierre = agrupar(enBanda(fin).map((c) => c.pos));
      const lineas = arranque.filter((x) => cierre.some((y) => Math.abs(x - y) <= EMPAREJAR_MM));

      if (lineas.length < 2 || lineas.length % 2 !== 0) continue;

      if (patronCoherente(lineas)) {
        if (lineas.length > mejor.length) mejor = lineas;
      } else if (lineas.length > respaldo.length) {
        respaldo = lineas;
      }
    }
  }

  return mejor.length ? mejor : respaldo;
}

/**
 * Una grilla regular alterna pieza, calle, pieza, calle… con la misma pieza y
 * la misma calle siempre, y la pieza siempre es más grande que la calle —la
 * calle es la tira de descarte—. Es lo que separa una fila de marcas de corte
 * de un conjunto de trazos que quedaron alineados de casualidad, y también lo
 * que evita leer la grilla corrida en uno, tomando las calles por piezas.
 */
function patronCoherente(lineas) {
  const piezas = [];
  const calles = [];
  for (let i = 0; i < lineas.length; i += 2) {
    piezas.push(lineas[i + 1] - lineas[i]);
    if (i + 2 < lineas.length) calles.push(lineas[i + 2] - lineas[i + 1]);
  }

  const uniforme = (xs) => xs.every((x) => Math.abs(x - xs[0]) <= 0.2);
  if (!(piezas[0] > 0) || !uniforme(piezas)) return false;
  if (calles.length === 0) return true;
  return calles[0] >= 0 && uniforme(calles) && piezas[0] > calles[0];
}

/**
 * Compara dos mediciones y devuelve las diferencias en milímetros.
 * `null` en un desvío significa que ni siquiera coincide la cantidad de líneas.
 */
export function compararMedidas(a, b, tolerancia = 0.5) {
  const desvio = (xs, ys) => {
    if (xs.length !== ys.length) return null;
    return Math.max(0, ...xs.map((x, i) => Math.abs(x - ys[i])));
  };

  const dv = desvio(a.marcasCorte.verticales, b.marcasCorte.verticales);
  const dh = desvio(a.marcasCorte.horizontales, b.marcasCorte.horizontales);

  return {
    pliegoIgual:
      Math.abs(a.pliego.ancho - b.pliego.ancho) <= tolerancia &&
      Math.abs(a.pliego.alto - b.pliego.alto) <= tolerancia,
    lineasVerticales: { a: a.marcasCorte.verticales.length, b: b.marcasCorte.verticales.length, desvioMaximo_mm: dv },
    lineasHorizontales: { a: a.marcasCorte.horizontales.length, b: b.marcasCorte.horizontales.length, desvioMaximo_mm: dh },
    coincide: dv !== null && dh !== null && dv <= tolerancia && dh <= tolerancia,
  };
}
