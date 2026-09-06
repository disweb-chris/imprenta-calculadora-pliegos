/**
 * Lectura del arte del cliente: medidas reales y detección de demasía.
 *
 * Un PDF de imprenta declara hasta cinco cajas por página. Las que importan:
 *
 *   MediaBox → la hoja física del archivo.
 *   TrimBox  → dónde va a cortar la guillotina. El tamaño final de la pieza.
 *   BleedBox → hasta dónde llega la tinta. TrimBox + demasía.
 *
 * Cuando el diseñador las declara bien, la demasía se lee del archivo y no hay
 * nada que adivinar. Cuando no —que es lo habitual en archivos exportados a
 * las apuradas— se cae a comparar la medida de la página contra la pieza que
 * pidió el cliente.
 */

import { enMm, mmApt } from './unidades.js';

/** Tolerancia al comparar medidas, en mm. Media décima: el ruido de exportar. */
const TOLERANCIA = 0.5;

const parecido = (a, b) => Math.abs(a - b) <= TOLERANCIA;

function leerCaja(pagina, metodo) {
  try {
    const c = pagina[metodo]();
    return c ? { x: c.x, y: c.y, ancho: c.width, alto: c.height } : null;
  } catch {
    return null;
  }
}

/**
 * Analiza una página del arte contra la pieza pedida.
 *
 * @returns {{
 *   demasia: "declarada"|"por medida"|"ausente"|"indeterminada",
 *   tieneDemasia: boolean|null,
 *   demasiaMm: number|null,   Demasía disponible por lado, la menor de los cuatro.
 *   recorte: {left:number,bottom:number,right:number,top:number},  En puntos.
 *   trimMm: {ancho:number, alto:number},
 *   motivo?: string
 * }}
 */
export function analizarPagina(pagina, { pieza, sangrado }) {
  const media = leerCaja(pagina, 'getMediaBox');
  const trim = leerCaja(pagina, 'getTrimBox');
  const bleed = leerCaja(pagina, 'getBleedBox');
  const externa = bleed ?? media;

  // ── Nivel 1: el archivo declara sus cajas. Es el dato autoritativo.
  if (trim && externa && (!parecido(enMm(trim.ancho), enMm(externa.ancho)) || !parecido(enMm(trim.alto), enMm(externa.alto)))) {
    const disponible = Math.min(
      trim.x - externa.x,
      trim.y - externa.y,
      externa.x + externa.ancho - (trim.x + trim.ancho),
      externa.y + externa.alto - (trim.y + trim.alto),
    );
    return {
      demasia: 'declarada',
      tieneDemasia: true,
      demasiaMm: enMm(disponible),
      recorte: recorteAlrededorDe(trim, Math.min(disponible, mmApt(sangrado))),
      trimMm: { ancho: enMm(trim.ancho), alto: enMm(trim.alto) },
    };
  }

  // ── Nivel 2: comparar la medida de la página con lo que pidió el cliente.
  const pagina_ = { ancho: enMm(externa.ancho), alto: enMm(externa.alto) };
  const conDemasia = { ancho: pieza.ancho + sangrado * 2, alto: pieza.alto + sangrado * 2 };

  const encaja = (medida) => (parecido(pagina_.ancho, medida.ancho) && parecido(pagina_.alto, medida.alto))
    || (parecido(pagina_.ancho, medida.alto) && parecido(pagina_.alto, medida.ancho));

  if (encaja(conDemasia)) {
    return {
      demasia: 'por medida',
      tieneDemasia: true,
      demasiaMm: sangrado,
      recorte: { left: externa.x, bottom: externa.y, right: externa.x + externa.ancho, top: externa.y + externa.alto },
      trimMm: { ...pieza },
    };
  }

  if (encaja(pieza)) {
    return {
      demasia: 'ausente',
      tieneDemasia: false,
      demasiaMm: 0,
      recorte: { left: externa.x, bottom: externa.y, right: externa.x + externa.ancho, top: externa.y + externa.alto },
      trimMm: { ...pieza },
    };
  }

  return {
    demasia: 'indeterminada',
    tieneDemasia: null,
    demasiaMm: null,
    recorte: { left: externa.x, bottom: externa.y, right: externa.x + externa.ancho, top: externa.y + externa.alto },
    trimMm: pagina_,
    motivo:
      `La página mide ${pagina_.ancho}×${pagina_.alto} mm y no coincide con ` +
      `${pieza.ancho}×${pieza.alto} mm (sin demasía) ni con ` +
      `${conDemasia.ancho}×${conDemasia.alto} mm (con ${sangrado} mm por lado).`,
  };
}

function recorteAlrededorDe(trim, margen) {
  return {
    left: trim.x - margen,
    bottom: trim.y - margen,
    right: trim.x + trim.ancho + margen,
    top: trim.y + trim.alto + margen,
  };
}

/**
 * Resume el análisis agrupando por diagnóstico.
 *
 * @param {object[]} analisis
 * @param {number[]} [elegidas]  Índices 0-based en el documento original, para
 *        que el informe hable de la página que el operador ve en su visor y no
 *        de la posición dentro de la selección.
 */
export function resumirAnalisis(analisis, elegidas) {
  const porTipo = {};
  analisis.forEach((a, i) => {
    (porTipo[a.demasia] ??= []).push(elegidas ? elegidas[i] + 1 : i + 1);
  });
  return porTipo;
}
