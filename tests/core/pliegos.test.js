import { describe, expect, it } from 'vitest';
import { calcularPliegos } from '../../src/core/pliegos.js';

describe('calcularPliegos', () => {
  it('redondea para arriba los pliegos necesarios', () => {
    expect(calcularPliegos({ cantidadPedida: 100, piezasPorPliego: 12 })).toMatchObject({
      pliegosNetos: 9,
      pliegosTotales: 9,
      piezasProducidas: 108,
      sobrante: 8,
    });
  });

  it('suma la demasía de arranque', () => {
    const r = calcularPliegos({ cantidadPedida: 100, piezasPorPliego: 12, demasia: 3 });
    expect(r.pliegosTotales).toBe(12);
    expect(r.sobrante).toBe(44);
  });

  it('duplica las pasadas de máquina en doble faz', () => {
    expect(calcularPliegos({ cantidadPedida: 78, piezasPorPliego: 12, caras: 2 }).pasadas).toBe(14);
    expect(calcularPliegos({ cantidadPedida: 78, piezasPorPliego: 12, caras: 1 }).pasadas).toBe(7);
  });

  it('valida las entradas', () => {
    expect(() => calcularPliegos({ cantidadPedida: 0, piezasPorPliego: 10 })).toThrow(/cantidadPedida/);
    expect(() => calcularPliegos({ cantidadPedida: 10, piezasPorPliego: 0 })).toThrow(/piezasPorPliego/);
    expect(() => calcularPliegos({ cantidadPedida: 10, piezasPorPliego: 5, caras: 3 })).toThrow(/caras/);
  });
});
