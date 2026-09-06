/**
 * Pose doble faz: frente y dorso registrados sobre el mismo pliego.
 *
 * Caso real: el mazo de tarot. Se imprime una cara con los frentes de las
 * cartas y la otra con el dorso repetido. Cuando el pliego se da vuelta, la
 * carta que estaba en la columna 0 del frente aparece en la última columna,
 * así que el dorso hay que ESPEJARLO para que cada frente caiga sobre su
 * propio dorso.
 *
 * Ejes de volteo:
 *
 *   "vertical"   → el pliego gira sobre su eje vertical (izquierda ↔ derecha).
 *                  Es el volteo estándar de guillotina/imprenta plana.
 *                  x' = anchoPliego - (x + ancho);  columna' = columnas-1-columna
 *
 *   "horizontal" → el pliego gira sobre su eje horizontal (arriba ↔ abajo).
 *                  y' = altoPliego - (y + alto);    fila' = filas-1-fila
 *
 * Detalle importante: como el bloque va CENTRADO, los márgenes son simétricos
 * y las marcas de corte del dorso caen exactamente sobre las del frente. Eso
 * es lo que hace que la pose registre con una sola tirada de guillotina. El
 * módulo igual calcula el espejo de las marcas y verifica la coincidencia
 * (`registro`), para que un cambio futuro en el modelo de márgenes que rompa
 * la simetría se detecte solo.
 */

import { EJE_VOLTEO_POR_DEFECTO } from '../config/defaults.js';
import { validarEjeVolteo } from './validacion.js';
import { calcularPose } from './pose.js';
import { generarTicks } from './layout.js';

const redondear = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;
const TOLERANCIA_REGISTRO = 0.01; // mm

/** Espeja una posición sobre el eje indicado. */
function espejarPosicion(pos, { pliego, ejeVolteo, columnas, filas }) {
  if (ejeVolteo === 'vertical') {
    return {
      ...pos,
      columna: columnas - 1 - pos.columna,
      x: redondear(pliego.ancho - (pos.x + pos.ancho)),
      sangradoCaja: {
        ...pos.sangradoCaja,
        x: redondear(pliego.ancho - (pos.sangradoCaja.x + pos.sangradoCaja.ancho)),
      },
    };
  }
  return {
    ...pos,
    fila: filas - 1 - pos.fila,
    y: redondear(pliego.alto - (pos.y + pos.alto)),
    sangradoCaja: {
      ...pos.sangradoCaja,
      y: redondear(pliego.alto - (pos.sangradoCaja.y + pos.sangradoCaja.alto)),
    },
  };
}

/** Espeja las líneas de trim sobre el eje indicado. */
function espejarMarcas(marcasCorte, { pliego, ejeVolteo }) {
  if (ejeVolteo === 'vertical') {
    return {
      verticales: marcasCorte.verticales.map((x) => redondear(pliego.ancho - x)).sort((a, b) => a - b),
      horizontales: [...marcasCorte.horizontales],
    };
  }
  return {
    verticales: [...marcasCorte.verticales],
    horizontales: marcasCorte.horizontales.map((y) => redondear(pliego.alto - y)).sort((a, b) => a - b),
  };
}

/** Espeja los márgenes del bloque (relevante sólo si el bloque no está centrado). */
function espejarBloque(bloque, ejeVolteo) {
  if (ejeVolteo === 'vertical') {
    return { ...bloque, margenIzquierdo: bloque.margenDerecho, margenDerecho: bloque.margenIzquierdo };
  }
  return { ...bloque, margenSuperior: bloque.margenInferior, margenInferior: bloque.margenSuperior };
}

/** Desvío máximo entre las marcas del frente y las del dorso, en mm. */
function medirRegistro(frente, dorso) {
  const desvio = (a, b) => Math.max(0, ...a.map((v, i) => Math.abs(v - b[i])));
  const desvioMaximo = redondear(
    Math.max(
      desvio(frente.verticales, dorso.verticales),
      desvio(frente.horizontales, dorso.horizontales),
    ),
    4,
  );
  return { desvioMaximo_mm: desvioMaximo, registra: desvioMaximo <= TOLERANCIA_REGISTRO };
}

/**
 * Calcula una pose doble faz.
 *
 * Acepta los mismos parámetros que `calcularPose` más:
 * @param {"vertical"|"horizontal"} [params.ejeVolteo="vertical"]
 *
 * En la salida, `frente.posiciones[i]` y `dorso.posiciones[i]` son SIEMPRE la
 * misma pieza lógica (mismo `indice`): la número i del mazo. Lo que cambia es
 * en qué celda de la grilla cae en cada cara.
 */
export function calcularPoseDobleFaz(params = {}) {
  const ejeVolteo = validarEjeVolteo(params.ejeVolteo, EJE_VOLTEO_POR_DEFECTO);
  const base = calcularPose(params);

  const { pliego, columnas, filas, bloque, marcasCorte, posiciones } = base;
  const sangrado = base.parametros.sangrado;

  const posicionesDorso = posiciones
    .map((pos) => espejarPosicion(pos, { pliego, ejeVolteo, columnas, filas }))
    .sort((a, b) => a.indice - b.indice);

  const marcasDorso = espejarMarcas(marcasCorte, { pliego, ejeVolteo });
  const bloqueDorso = espejarBloque(bloque, ejeVolteo);
  const ticksDorso = generarTicks({
    pliego,
    bloque: bloqueDorso,
    marcasCorte: marcasDorso,
    sangrado,
  });

  const mapeo = posiciones.map((pos, i) => ({
    indice: pos.indice,
    frente: { fila: pos.fila, columna: pos.columna, x: pos.x, y: pos.y },
    dorso: {
      fila: posicionesDorso[i].fila,
      columna: posicionesDorso[i].columna,
      x: posicionesDorso[i].x,
      y: posicionesDorso[i].y,
    },
  }));

  // La cara con la que hay que alimentar la máquina en la segunda pasada:
  // el orden de lectura del dorso, celda por celda.
  const ordenDorso = [...posicionesDorso]
    .sort((a, b) => a.fila - b.fila || a.columna - b.columna)
    .map((pos) => pos.indice);

  const { advertencias: _omitir, posiciones: _pos, marcasCorte: _marcas, ticks: _ticks, bloque: _bloque, ...comun } = base;

  return {
    ...comun,
    dobleFaz: true,
    ejeVolteo,
    bloque,
    frente: {
      cara: 'frente',
      bloque,
      posiciones,
      marcasCorte,
      ticks: base.ticks,
      /** Orden de lectura izquierda→derecha, arriba→abajo. */
      orden: posiciones.map((p) => p.indice),
    },
    dorso: {
      cara: 'dorso',
      bloque: bloqueDorso,
      posiciones: posicionesDorso,
      marcasCorte: marcasDorso,
      ticks: ticksDorso,
      orden: ordenDorso,
    },
    mapeo,
    registro: medirRegistro(marcasCorte, marcasDorso),
    advertencias: base.advertencias,
  };
}

/** Devuelve la cara pedida de una pose doble faz, o la pose entera si es simple. */
export function obtenerCara(pose, cara = 'frente') {
  if (!pose.dobleFaz) return pose;
  if (cara !== 'frente' && cara !== 'dorso') {
    throw new Error(`Cara "${cara}" desconocida: esperaba "frente" o "dorso".`);
  }
  return { ...pose, ...pose[cara] };
}
