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
  const BASE = {
    cantidad: 100,
    pliegos: 7,
    impresiones: 7,
    costoPapel: 120,
    costoImpresion: 80,
    costoFijo: 5000,
  };

  it('suma papel, impresión y costo fijo', () => {
    expect(cotizar(BASE)).toMatchObject({
      papel: 840,
      impresion: 560,
      costoFijo: 5000,
      costoTotal: 6400,
      costoUnitario: 64,
    });
  });

  it('aplica ganancia sobre el costo ya recargado por producción', () => {
    // 6400 × 1.15 = 7360 ; 7360 × 1.40 = 10304
    // Si se aplicaran los dos porcentajes sobre el costo base daría 9920.
    const r = cotizar({ ...BASE, porcentajeProduccion: 15, porcentajeGanancia: 40 });
    expect(r.precioFinal).toBe(10304);
    expect(r.precioUnitario).toBe(103.04);
  });

  it('calcula el IVA sobre el precio final', () => {
    const r = cotizar({ ...BASE, porcentajeProduccion: 15, porcentajeGanancia: 40, aplicarIva: true });
    expect(r.iva).toBe(2163.84);
    expect(r.precioFinalConIva).toBe(12467.84);
    expect(r.precioUnitarioConIva).toBe(124.68);
  });

  it('sin IVA no lo suma', () => {
    const r = cotizar({ ...BASE, aplicarIva: false });
    expect(r.iva).toBe(0);
    expect(r.precioFinalConIva).toBe(r.precioFinal);
  });

  it('con todos los costos en cero devuelve cero', () => {
    const r = cotizar({ cantidad: 100, pliegos: 7, impresiones: 7 });
    expect(r.costoTotal).toBe(0);
    expect(r.precioFinal).toBe(0);
  });

  it('valida que no entren números negativos', () => {
    expect(() => cotizar({ ...BASE, pliegos: -1 })).toThrow(/pliegos/);
    expect(() => cotizar({ ...BASE, costoPapel: -5 })).toThrow(/costoPapel/);
    expect(() => cotizar({ ...BASE, cantidad: 0 })).toThrow(/mayor que cero/);
  });
});
