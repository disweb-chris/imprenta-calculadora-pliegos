/**
 * El PDF trabaja en puntos tipográficos (1/72"), el taller en milímetros.
 * La conversión pasa por acá y sólo por acá.
 */

export const PT_POR_MM = 72 / 25.4;

export const mmApt = (mm) => mm * PT_POR_MM;
export const ptAmm = (pt) => pt / PT_POR_MM;

/** Redondeo a centésima de milímetro, que es más fino que cualquier guillotina. */
export const enMm = (pt) => Math.round(ptAmm(pt) * 100) / 100;
