/**
 * Valores por defecto y perfiles calibrados de armado de pose.
 * Todas las medidas están en milímetros salvo que se aclare lo contrario.
 */

/** Pliego por defecto: el formato de trabajo habitual, 32 × 47 cm. */
export const PLIEGO_POR_DEFECTO = Object.freeze({ ancho: 320, alto: 470 });

/**
 * Parámetros por defecto.
 *
 * `margenMinimo: 0` replica la calculadora en producción, que no tiene
 * concepto de margen: las piezas se acomodan contra el borde del pliego y lo
 * que queda de margen es el sobrante del centrado. Es un parámetro opcional
 * para las máquinas que sí necesitan margen de pinza.
 */
export const PARAMETROS_POR_DEFECTO = Object.freeze({
  sangrado: 3,
  espaciado: 0,
  margenMinimo: 0,
  permitirRotacion: true,
  estrategia: 'shelf',
});

/**
 * Perfiles por tipo de soporte.
 *
 * `hoja`  → papel cortado (obra, ilustración, opalina). La guillotina entra
 *           limpia, no hace falta separación extra entre piezas.
 * `rollo` → material continuo (vinilos, lonas). El avance del rollo tiene
 *           tolerancia mecánica, así que se separan las piezas 6 mm.
 *
 * Los valores de `rollo` están calibrados contra producción real; ver
 * docs/NESTING.md para el detalle del procedimiento.
 */
export const PERFILES_SOPORTE = Object.freeze({
  hoja: Object.freeze({ sangrado: 3, espaciado: 0, margenMinimo: 0 }),
  rollo: Object.freeze({ sangrado: 3, espaciado: 6, margenMinimo: 0 }),
});

/** Geometría de las marcas de corte para guillotina. */
export const MARCAS = Object.freeze({
  /** Largo del tick, en mm. */
  largo: 5,
  /** Grosor del trazo en puntos tipográficos (0.25 pt ≈ 0.0882 mm). */
  grosorPt: 0.25,
});

/** Eje de volteo por defecto en poses doble faz (espejo izquierda↔derecha). */
export const EJE_VOLTEO_POR_DEFECTO = 'vertical';

/** Ejes de volteo admitidos. */
export const EJES_VOLTEO = Object.freeze(['vertical', 'horizontal']);

/** Alícuota de IVA general. */
export const IVA = 0.21;

/** Merma por defecto, en pliegos extra. */
export const MERMA_POR_DEFECTO = 2;
