import { describe, expect, it } from 'vitest';
import { cotizar, precioUnitarioPorEscala } from '../../src/core/precios.js';

const ESCALAS = [
  { desde: 1, precioUnitario: 100 },
  { desde: 50, precioUnitario: 80 },
  { desde: 200, precioUnitario: 60 },
];

describe('precioUnitarioPorEscala', () => {
  it('toma el tramo de mayor "desde" que no supere la cantidad', () => {
    expect(precioUnitarioPorEscala(1, ESCALAS)).toBe(100);
    expect(precioUnitarioPorEscala(49, ESCALAS)).toBe(100);
    expect(precioUnitarioPorEscala(50, ESCALAS)).toBe(80);
    expect(precioUnitarioPorEscala(1000, ESCALAS)).toBe(60);
  });

  it('no depende del orden de las escalas', () => {
    expect(precioUnitarioPorEscala(100, [...ESCALAS].reverse())).toBe(80);
  });

  it('falla si no hay escalas o la cantidad está por debajo del mínimo', () => {
    expect(() => precioUnitarioPorEscala(10, [])).toThrow(/escalas de precio/);
    expect(() => precioUnitarioPorEscala(5, [{ desde: 10, precioUnitario: 1 }])).toThrow(/escala mínima/);
  });
});

describe('cotizar', () => {
  it('suma materiales, impresión y costo fijo', () => {
    expect(cotizar({ pliegosTotales: 10, precioPorPliego: 150, costoFijo: 500, pasadas: 2, precioPorPasada: 1000 })).toEqual({
      materiales: 1500,
      impresion: 2000,
      costoFijo: 500,
      total: 4000,
    });
  });

  it('valida que no entren números negativos', () => {
    expect(() => cotizar({ pliegosTotales: -1, precioPorPliego: 10 })).toThrow(/pliegosTotales/);
  });
});
