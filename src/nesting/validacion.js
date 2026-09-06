/**
 * Validación de los parámetros de entrada del armado de pose.
 * Funciones puras: reciben objetos planos y devuelven objetos planos.
 */

import { EJES_VOLTEO } from '../config/defaults.js';

/** Error de negocio con mensaje en español, listo para devolver como 400. */
export class ErrorDePose extends Error {
  constructor(mensaje, campo) {
    super(mensaje);
    this.name = 'ErrorDePose';
    this.campo = campo;
    this.esErrorDePose = true;
  }
}

function exigirNumero(valor, campo, { min = 0, permitirCero = true } = {}) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new ErrorDePose(`"${campo}" tiene que ser un número en milímetros.`, campo);
  }
  if (valor < min || (!permitirCero && valor === 0)) {
    const limite = permitirCero ? `mayor o igual a ${min}` : `mayor que ${min}`;
    throw new ErrorDePose(`"${campo}" tiene que ser ${limite}. Recibido: ${valor}.`, campo);
  }
  return valor;
}

function exigirRectangulo(rect, campo) {
  if (!rect || typeof rect !== 'object') {
    throw new ErrorDePose(`Falta "${campo}": esperaba { ancho, alto } en milímetros.`, campo);
  }
  exigirNumero(rect.ancho, `${campo}.ancho`, { min: 0, permitirCero: false });
  exigirNumero(rect.alto, `${campo}.alto`, { min: 0, permitirCero: false });
  return { ancho: rect.ancho, alto: rect.alto };
}

/**
 * Normaliza y valida los parámetros de una pose.
 * Devuelve una copia con todos los campos resueltos; nunca muta la entrada.
 */
export function validarParametros(params = {}, defaults) {
  const pliego = exigirRectangulo(params.pliego ?? defaults.pliego, 'pliego');
  const pieza = exigirRectangulo(params.pieza, 'pieza');

  const sangrado = exigirNumero(params.sangrado ?? defaults.sangrado, 'sangrado');
  const espaciado = exigirNumero(params.espaciado ?? defaults.espaciado, 'espaciado');
  const margenMinimo = exigirNumero(params.margenMinimo ?? defaults.margenMinimo, 'margenMinimo');
  const margenMarcas = exigirNumero(params.margenMarcas ?? defaults.margenMarcas, 'margenMarcas');

  // Las dos son restricciones sobre la misma distancia (borde del pliego a la
  // tinta), así que manda la más exigente.
  const margenEfectivo = Math.max(margenMinimo, margenMarcas);

  const permitirRotacion = params.permitirRotacion ?? defaults.permitirRotacion;
  if (typeof permitirRotacion !== 'boolean') {
    throw new ErrorDePose('"permitirRotacion" tiene que ser true o false.', 'permitirRotacion');
  }

  if (margenEfectivo > 0 && (margenEfectivo * 2 >= pliego.ancho || margenEfectivo * 2 >= pliego.alto)) {
    throw new ErrorDePose(
      `Un margen de ${margenEfectivo} mm no deja área útil en un pliego de ` +
        `${pliego.ancho}×${pliego.alto} mm.`,
      'margenMinimo',
    );
  }

  return { pliego, pieza, sangrado, espaciado, margenMinimo, margenMarcas, margenEfectivo, permitirRotacion };
}

/** Valida el eje de volteo de una pose doble faz. */
export function validarEjeVolteo(eje, porDefecto) {
  const resuelto = eje ?? porDefecto;
  if (!EJES_VOLTEO.includes(resuelto)) {
    throw new ErrorDePose(
      `"ejeVolteo" tiene que ser uno de: ${EJES_VOLTEO.join(', ')}. Recibido: "${resuelto}".`,
      'ejeVolteo',
    );
  }
  return resuelto;
}
