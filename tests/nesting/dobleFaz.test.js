import { describe, expect, it } from 'vitest';
import { calcularPoseDobleFaz, obtenerCara } from '../../src/nesting/dobleFaz.js';
import { ErrorDePose } from '../../src/nesting/validacion.js';

/** Mismo pliego que la pose de referencia del mazo de tarot. */
const TAROT = {
  pliego: { ancho: 320, alto: 470 },
  pieza: { ancho: 70, alto: 120 },
  sangrado: 3,
  espaciado: 0,
  margenMinimo: 10,
};

describe('pose doble faz — mazo de tarot', () => {
  const pose = calcularPoseDobleFaz(TAROT);

  it('conserva la geometría de la pose simple', () => {
    expect(pose.cantidad).toBe(12);
    expect(pose.columnas).toBe(4);
    expect(pose.filas).toBe(3);
    expect(pose.dobleFaz).toBe(true);
    expect(pose.ejeVolteo).toBe('vertical');
  });

  it('espeja las columnas en el dorso y deja las filas quietas', () => {
    for (const { indice, frente, dorso } of pose.mapeo) {
      const enFrente = pose.frente.posiciones.find((p) => p.indice === indice);
      expect(dorso.fila).toBe(frente.fila);
      expect(dorso.columna).toBe(pose.columnas - 1 - frente.columna);
      expect(enFrente.fila).toBe(frente.fila);
    }
  });

  it('la carta 1 del frente cae en la última columna del dorso', () => {
    const primera = pose.mapeo[0];
    expect(primera.frente.columna).toBe(0);
    expect(primera.dorso.columna).toBe(3);
    expect(primera.frente.x).toBeCloseTo(11, 5);
    expect(primera.dorso.x).toBeCloseTo(320 - 11 - 70, 5); // 239
  });

  it('cada pieza cae en la posición espejada exacta', () => {
    for (let i = 0; i < pose.frente.posiciones.length; i += 1) {
      const f = pose.frente.posiciones[i];
      const d = pose.dorso.posiciones[i];
      expect(d.indice).toBe(f.indice);
      expect(f.x + d.x + f.ancho).toBeCloseTo(pose.pliego.ancho, 5);
      expect(d.y).toBeCloseTo(f.y, 5);
    }
  });

  it('el orden de lectura del dorso es el del frente invertido por filas', () => {
    // Frente: 0 1 2 3 / 4 5 6 7 / 8 9 10 11
    // Dorso:  3 2 1 0 / 7 6 5 4 / 11 10 9 8
    expect(pose.frente.orden).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(pose.dorso.orden).toEqual([3, 2, 1, 0, 7, 6, 5, 4, 11, 10, 9, 8]);
  });

  it('las marcas de corte del dorso registran con las del frente', () => {
    expect(pose.registro.registra).toBe(true);
    expect(pose.registro.desvioMaximo_mm).toBeCloseTo(0, 5);
    expect(pose.dorso.marcasCorte.verticales).toEqual(pose.frente.marcasCorte.verticales);
    expect(pose.dorso.marcasCorte.horizontales).toEqual(pose.frente.marcasCorte.horizontales);
  });

  it('genera 28 marcas en cada cara', () => {
    expect(pose.frente.ticks).toHaveLength(28);
    expect(pose.dorso.ticks).toHaveLength(28);
  });

  it('el mapeo es una biyección: ninguna celda del dorso se usa dos veces', () => {
    const celdas = pose.mapeo.map((m) => `${m.dorso.fila},${m.dorso.columna}`);
    expect(new Set(celdas).size).toBe(pose.cantidad);
  });
});

describe('pose doble faz — eje de volteo horizontal', () => {
  const pose = calcularPoseDobleFaz({ ...TAROT, ejeVolteo: 'horizontal' });

  it('espeja las filas y deja las columnas quietas', () => {
    for (const { frente, dorso } of pose.mapeo) {
      expect(dorso.columna).toBe(frente.columna);
      expect(dorso.fila).toBe(pose.filas - 1 - frente.fila);
    }
  });

  it('espeja las coordenadas en y', () => {
    for (let i = 0; i < pose.frente.posiciones.length; i += 1) {
      const f = pose.frente.posiciones[i];
      const d = pose.dorso.posiciones[i];
      expect(f.y + d.y + f.alto).toBeCloseTo(pose.pliego.alto, 5);
      expect(d.x).toBeCloseTo(f.x, 5);
    }
  });

  it('sigue registrando', () => {
    expect(pose.registro.registra).toBe(true);
  });

  it('el orden del dorso invierte las filas', () => {
    expect(pose.dorso.orden).toEqual([8, 9, 10, 11, 4, 5, 6, 7, 0, 1, 2, 3]);
  });
});

describe('pose doble faz — validaciones y utilidades', () => {
  it('rechaza un eje de volteo desconocido', () => {
    expect(() => calcularPoseDobleFaz({ ...TAROT, ejeVolteo: 'diagonal' })).toThrow(ErrorDePose);
    expect(() => calcularPoseDobleFaz({ ...TAROT, ejeVolteo: 'diagonal' })).toThrow(/ejeVolteo/);
  });

  it('obtenerCara devuelve la capa pedida', () => {
    const pose = calcularPoseDobleFaz(TAROT);
    expect(obtenerCara(pose, 'frente').posiciones).toEqual(pose.frente.posiciones);
    expect(obtenerCara(pose, 'dorso').posiciones).toEqual(pose.dorso.posiciones);
    expect(() => obtenerCara(pose, 'costado')).toThrow(/Cara "costado"/);
  });

  it('una grilla impar en columnas sigue registrando y mapea la del medio consigo misma', () => {
    const pose = calcularPoseDobleFaz({
      pliego: { ancho: 300, alto: 200 },
      pieza: { ancho: 80, alto: 80 },
      sangrado: 3,
      espaciado: 0,
      margenMinimo: 10,
      permitirRotacion: false,
    });
    expect(pose.columnas).toBe(3);
    const central = pose.mapeo.find((m) => m.frente.columna === 1);
    expect(central.dorso.columna).toBe(1);
    expect(central.dorso.x).toBeCloseTo(central.frente.x, 5);
    expect(pose.registro.registra).toBe(true);
  });
});
