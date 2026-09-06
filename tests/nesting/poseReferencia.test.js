import { describe, expect, it } from 'vitest';
import { calcularPose } from '../../src/nesting/pose.js';

/**
 * Pose de referencia: mazo de tarot, medida de una pose real en producción.
 * Si el algoritmo no reproduce estos números, el modelo de márgenes o de
 * pitch está mal. Tolerancia ±0.5 mm.
 */
const TOLERANCIA = 0.5;

const PARAMETROS = {
  pliego: { ancho: 320, alto: 470 },
  pieza: { ancho: 70, alto: 120 },
  sangrado: 3,
  espaciado: 0,
  // La pose real no tiene margen: los 11 mm laterales son sobrante del
  // centrado, no una restricción. Ver el test de más abajo.
  margenMinimo: 0,
  permitirRotacion: true,
};

const MARCAS_V = [11.2, 81.2, 87.2, 157.2, 163.2, 233.2, 239.2, 309.2];
const MARCAS_H = [48.9, 169.1, 174.9, 295.1, 300.9, 421.1];

describe('pose de referencia — mazo de tarot 320×470', () => {
  const pose = calcularPose(PARAMETROS);

  it('arma una grilla de 4 columnas × 3 filas = 12 piezas', () => {
    expect(pose.columnas).toBe(4);
    expect(pose.filas).toBe(3);
    expect(pose.cantidad).toBe(12);
  });

  it('no rota la pieza', () => {
    expect(pose.rotada).toBe(false);
    expect(pose.orientacion).toBe('vertical');
  });

  it('usa una calle de 6 mm y un pitch de 76 × 126 mm', () => {
    expect(pose.parametros.calle).toBe(6);
    expect(pose.pitch).toEqual({ x: 76, y: 126 });
  });

  it('centra el bloque: 11 mm de margen de trim lateral y 49 mm arriba/abajo', () => {
    expect(pose.bloque.margenIzquierdo).toBeCloseTo(11, 5);
    expect(pose.bloque.margenDerecho).toBeCloseTo(11, 5);
    expect(pose.bloque.margenSuperior).toBeCloseTo(49, 5);
    expect(pose.bloque.margenInferior).toBeCloseTo(49, 5);
  });

  it('deja 8 mm de margen de tinta a los costados y 46 mm arriba/abajo', () => {
    // El sangrado exterior invade el margen: el trim está a 11 mm del borde
    // pero la mancha de tinta llega hasta los 8 mm.
    expect(pose.bloque.margenSangrado.izquierdo).toBeCloseTo(8, 5);
    expect(pose.bloque.margenSangrado.superior).toBeCloseTo(46, 5);
  });

  it('con un margen de pinza de 10 mm la pose ya NO entra en 4 columnas', () => {
    // Deja constancia de que la pose de referencia se arma sin margen. Pedir
    // 10 mm de pinza obliga a bajar a 3 columnas y cambia el trabajo.
    const conPinza = calcularPose({ ...PARAMETROS, margenMinimo: 10 });
    expect(conPinza.alternativas.normal).toMatchObject({ columnas: 3, filas: 3, cantidad: 9 });
    expect(conPinza.cantidad).toBeLessThan(pose.cantidad);
  });

  it('los márgenes lateral y vertical son distintos (bloque centrado, no anclado)', () => {
    expect(pose.bloque.margenIzquierdo).not.toBeCloseTo(pose.bloque.margenSuperior, 1);
  });

  it('reproduce las marcas verticales de la pose real', () => {
    expect(pose.marcasCorte.verticales).toHaveLength(MARCAS_V.length);
    pose.marcasCorte.verticales.forEach((x, i) => {
      expect(Math.abs(x - MARCAS_V[i])).toBeLessThanOrEqual(TOLERANCIA);
    });
  });

  it('reproduce las marcas horizontales de la pose real', () => {
    expect(pose.marcasCorte.horizontales).toHaveLength(MARCAS_H.length);
    pose.marcasCorte.horizontales.forEach((y, i) => {
      expect(Math.abs(y - MARCAS_H[i])).toBeLessThanOrEqual(TOLERANCIA);
    });
  });

  it('genera 28 marcas en total (14 líneas × 2 ticks)', () => {
    expect(pose.totalLineasDeMarca).toBe(14);
    expect(pose.totalMarcas).toBe(28);
    expect(pose.ticks).toHaveLength(28);
  });

  it('pone dos marcas por calle y una sola en los bordes exteriores', () => {
    const v = pose.marcasCorte.verticales;
    // Bordes exteriores del bloque: sin par contiguo a distancia de calle.
    expect(v[0]).toBeCloseTo(11, 5);
    expect(v.at(-1)).toBeCloseTo(309, 5);
    // Calles internas: pares separados por 6 mm.
    expect(v[2] - v[1]).toBeCloseTo(6, 5);
    expect(v[4] - v[3]).toBeCloseTo(6, 5);
    expect(v[6] - v[5]).toBeCloseTo(6, 5);
  });

  it('mantiene las marcas fuera del arte, dentro del margen', () => {
    const m = pose.bloque.margenSangrado;
    for (const tick of pose.ticks) {
      const dentroDelPliego =
        Math.min(tick.x1, tick.x2) >= 0 &&
        Math.min(tick.y1, tick.y2) >= 0 &&
        Math.max(tick.x1, tick.x2) <= pose.pliego.ancho &&
        Math.max(tick.y1, tick.y2) <= pose.pliego.alto;
      expect(dentroDelPliego).toBe(true);
    }
    // Ningún tick pisa la caja de sangrado del bloque.
    for (const tick of pose.ticks.filter((t) => t.orientacion === 'vertical')) {
      const fueraDelArte =
        Math.max(tick.y1, tick.y2) <= m.superior ||
        Math.min(tick.y1, tick.y2) >= pose.pliego.alto - m.inferior;
      expect(fueraDelArte).toBe(true);
    }
    expect(pose.advertencias).toHaveLength(0);
  });

  it('calcula el aprovechamiento del pliego', () => {
    expect(pose.aprovechamiento).toBeCloseTo((12 * 70 * 120) / (320 * 470), 4);
    expect(pose.desperdicio_mm2).toBeCloseTo(320 * 470 - 12 * 70 * 120, 2);
  });
});
