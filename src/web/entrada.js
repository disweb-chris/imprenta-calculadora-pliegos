/**
 * Punto de entrada del bundle para el navegador.
 *
 * Expone el MISMO código que corre en el servicio, empaquetado para que el
 * widget pueda seguir cotizando si Cloud Run no responde. No hay una segunda
 * implementación de la aritmética: es este archivo el que garantiza que el
 * respaldo y el servicio no puedan dar resultados distintos.
 *
 * Se construye con `npm run build:web` y el resultado se commitea en
 * `web/pose.bundle.js`; `tests/web/bundle.test.js` verifica que esté al día.
 */

export { calcularDesdeElSitio, resolverTrabajo, desdeContratoDelSitio } from '../core/compat.js';
export { calcularPose } from '../nesting/pose.js';
export { calcularPoseDobleFaz } from '../nesting/dobleFaz.js';
export { generarSVG } from '../nesting/svg.js';
