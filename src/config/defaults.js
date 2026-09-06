/**
 * Valores por defecto y perfiles calibrados de armado de pose.
 * Todas las medidas están en milímetros salvo que se aclare lo contrario.
 */

/** Pliego por defecto: A3. */
export const PLIEGO_POR_DEFECTO = Object.freeze({ ancho: 297, alto: 420 });

/** Parámetros por defecto de una pose sobre hoja suelta. */
export const PARAMETROS_POR_DEFECTO = Object.freeze({
  sangrado: 3,
  espaciado: 0,
  margenMinimo: 10,
  permitirRotacion: true,
  estrategia: 'shelf',
});

/**
 * Perfiles por tipo de soporte.
 *
 * `hoja`  → papel cortado (ilustración, obra, opalina). La guillotina entra
 *           limpia, no hace falta espaciado extra entre calles.
 * `rollo` → material continuo (vinilos, lonas). El avance del rollo tiene
 *           tolerancia mecánica, así que se agrega espaciado de seguridad.
 *
 * Los valores de `rollo` están calibrados contra producción real; ver
 * docs/NESTING.md para el detalle del procedimiento.
 */
export const PERFILES_SOPORTE = Object.freeze({
  hoja: Object.freeze({ sangrado: 3, espaciado: 0, margenMinimo: 10 }),
  rollo: Object.freeze({ sangrado: 3, espaciado: 5, margenMinimo: 10 }),
});

/** Geometría de las marcas de corte para guillotina. */
export const MARCAS = Object.freeze({
  /** Largo del tick, en mm. */
  largo: 5,
  /** Grosor del trazo en puntos tipográficos (0.25 pt ≈ 0.0882 mm). */
  grosorPt: 0.25,
  /**
   * Separación entre la línea de trim y el arranque del tick.
   * Por defecto se resuelve como el sangrado, para que el tick nunca pise el
   * arte: arranca justo donde termina la caja de sangrado.
   */
  separacion: null,
});

/** Eje de volteo por defecto en poses doble faz (espejo izquierda↔derecha). */
export const EJE_VOLTEO_POR_DEFECTO = 'vertical';

/** Ejes de volteo admitidos. */
export const EJES_VOLTEO = Object.freeze(['vertical', 'horizontal']);
