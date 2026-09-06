/**
 * Catálogo de materiales.
 *
 * ⚠️ ALCANCE: acá está la GEOMETRÍA de cada material (formato de pliego y
 * perfil de pose calibrado), que es lo que necesita el módulo de nesting y lo
 * que se validó contra producción.
 *
 * Los PRECIOS todavía no viven acá: siguen en el microservicio desplegado en
 * Cloud Run. Migrarlos es la Etapa 0 y requiere el código actual del servicio;
 * hasta entonces `precio` queda en null a propósito, para no inventar números
 * de negocio. Ver README → "Pendiente de migración".
 */

import { PERFILES_SOPORTE } from '../config/defaults.js';

/**
 * @typedef {object} Material
 * @property {string} id
 * @property {string} nombre
 * @property {"hoja"|"rollo"} soporte
 * @property {{ancho:number, alto:number}} pliego  Medidas en mm.
 * @property {{sangrado:number, espaciado:number, margenMinimo:number}} perfilPose
 * @property {null|number} precio                  Pendiente de migración.
 */

/** @type {Material[]} */
const CATALOGO = [
  {
    id: 'papel-obra-32x47',
    nombre: 'Papel obra 32 × 47',
    soporte: 'hoja',
    pliego: { ancho: 320, alto: 470 },
    perfilPose: PERFILES_SOPORTE.hoja,
    precio: null,
  },
  {
    id: 'papel-ilustracion-a3',
    nombre: 'Papel ilustración A3',
    soporte: 'hoja',
    pliego: { ancho: 297, alto: 420 },
    perfilPose: PERFILES_SOPORTE.hoja,
    precio: null,
  },
  {
    id: 'vinilo-mate',
    nombre: 'Vinilo mate (rollo)',
    soporte: 'rollo',
    pliego: { ancho: 1000, alto: 1000 },
    perfilPose: PERFILES_SOPORTE.rollo,
    precio: null,
  },
];

/** Devuelve el catálogo completo (copia congelada). */
export function listarMateriales() {
  return CATALOGO.map((m) => Object.freeze({ ...m }));
}

/** Busca un material por id. Devuelve undefined si no existe. */
export function obtenerMaterial(id) {
  const material = CATALOGO.find((m) => m.id === id);
  return material ? Object.freeze({ ...material }) : undefined;
}

/**
 * Arma los parámetros de pose de un material, permitiendo sobrescribir
 * cualquier campo. Útil para no repetir el perfil en cada request.
 */
export function parametrosDePose(id, overrides = {}) {
  const material = obtenerMaterial(id);
  if (!material) return undefined;
  return { pliego: material.pliego, ...material.perfilPose, ...overrides };
}
