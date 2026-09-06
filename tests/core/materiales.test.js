import { describe, expect, it } from 'vitest';
import { listarMateriales, obtenerMaterial, parametrosDePose } from '../../src/core/materiales.js';
import { calcularPose } from '../../src/nesting/pose.js';

describe('catálogo de materiales', () => {
  it('lista los materiales con su geometría y perfil de pose', () => {
    const materiales = listarMateriales();
    expect(materiales.length).toBeGreaterThan(0);
    for (const m of materiales) {
      expect(m).toHaveProperty('id');
      expect(m.pliego.ancho).toBeGreaterThan(0);
      expect(m.perfilPose).toHaveProperty('margenMinimo');
      // Los precios todavía viven en el servicio legacy: ver Etapa 0.
      expect(m.precio).toBeNull();
    }
  });

  it('busca por id', () => {
    expect(obtenerMaterial('vinilo-mate').soporte).toBe('rollo');
    expect(obtenerMaterial('inexistente')).toBeUndefined();
  });

  it('arma los parámetros de pose de un material, con overrides', () => {
    const params = parametrosDePose('vinilo-mate', { margenMinimo: 25 });
    expect(params.pliego).toEqual({ ancho: 1000, alto: 1000 });
    expect(params.espaciado).toBe(6);
    expect(params.margenMinimo).toBe(25);
  });

  it('el perfil de vinilo reproduce los números reales de producción', () => {
    expect(calcularPose({ ...parametrosDePose('vinilo-mate'), pieza: { ancho: 60, alto: 60 } }).cantidad).toBe(169);
    expect(calcularPose({ ...parametrosDePose('vinilo-mate'), pieza: { ancho: 70, alto: 40 } }).cantidad).toBe(228);
  });
});
