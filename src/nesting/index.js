/** Superficie pública del módulo de armado de pose. */

export { calcularPose, estrategiasDisponibles } from './pose.js';
export { calcularPoseDobleFaz, obtenerCara } from './dobleFaz.js';
export { generarSVG, generarSVGDobleFaz } from './svg.js';
export { ErrorDePose } from './validacion.js';
export { PERFILES_SOPORTE, PARAMETROS_POR_DEFECTO, PLIEGO_POR_DEFECTO } from '../config/defaults.js';
