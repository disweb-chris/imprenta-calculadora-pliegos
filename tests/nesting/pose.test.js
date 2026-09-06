import { describe, expect, it } from 'vitest';
import { calcularPose } from '../../src/nesting/pose.js';
import { ErrorDePose } from '../../src/nesting/validacion.js';
import { PERFILES_SOPORTE } from '../../src/config/defaults.js';

const A3 = { ancho: 297, alto: 420 };
const METRO = { ancho: 1000, alto: 1000 };

describe('casos reales del negocio', () => {
  it('papel ilustración A3 con pieza de 60×60 → 24 piezas', () => {
    const pose = calcularPose({ pliego: A3, pieza: { ancho: 60, alto: 60 }, ...PERFILES_SOPORTE.hoja });
    expect(pose.cantidad).toBe(24);
    expect(pose.columnas).toBe(4);
    expect(pose.filas).toBe(6);
  });

  it('papel ilustración A3 con pieza de 70×40 → 30 piezas (rotando)', () => {
    const pose = calcularPose({ pliego: A3, pieza: { ancho: 70, alto: 40 }, ...PERFILES_SOPORTE.hoja });
    expect(pose.cantidad).toBe(30);
    expect(pose.rotada).toBe(true);
    expect(pose.columnas).toBe(6);
    expect(pose.filas).toBe(5);
  });

  it('vinilo mate 1000×1000 con pieza de 60×60 → 169 piezas', () => {
    const pose = calcularPose({ pliego: METRO, pieza: { ancho: 60, alto: 60 }, ...PERFILES_SOPORTE.rollo });
    expect(pose.cantidad).toBe(169);
    expect(pose.columnas).toBe(13);
    expect(pose.filas).toBe(13);
  });

  it('vinilo mate 1000×1000 con pieza de 70×40 → 228 piezas', () => {
    const pose = calcularPose({ pliego: METRO, pieza: { ancho: 70, alto: 40 }, ...PERFILES_SOPORTE.rollo });
    expect(pose.cantidad).toBe(228);
    expect(pose.columnas * pose.filas).toBe(228);
  });
});

describe('modelo de márgenes', () => {
  it('el margen mínimo se mide sobre la tinta, no sobre el trim', () => {
    // 4 columnas de 70 mm con calles de 6 mm ocupan 298 mm de trim y 304 mm
    // de tinta. Sin margen entran en un pliego de 320; con 10 mm de pinza
    // (304 + 20 = 324 > 320) ya no.
    const base = { pliego: { ancho: 320, alto: 470 }, pieza: { ancho: 70, alto: 120 }, sangrado: 3 };
    const sinPinza = calcularPose({ ...base, margenMinimo: 0 });
    expect(sinPinza.columnas).toBe(4);
    expect(sinPinza.bloque.ancho).toBe(298);
    expect(sinPinza.bloque.tinta.ancho).toBe(304);

    const conPinza = calcularPose({ ...base, margenMinimo: 10, permitirRotacion: false });
    expect(conPinza.columnas).toBe(3);
  });

  it('replica la fórmula de la calculadora del sitio cuando no hay margen', () => {
    // floor((pliego + separación) / (pieza + demasía*2 + separación))
    const casos = [
      [320, 470, 90, 50, 3, 0],
      [297, 420, 60, 60, 3, 0],
      [1000, 1000, 60, 60, 3, 6],
      [216, 356, 45, 25, 2, 1],
    ];
    for (const [pw, ph, iw, ih, sangrado, espaciado] of casos) {
      const pose = calcularPose({
        pliego: { ancho: pw, alto: ph },
        pieza: { ancho: iw, alto: ih },
        sangrado,
        espaciado,
        margenMinimo: 0,
        permitirRotacion: false,
      });
      const esperadoCols = Math.floor((pw + espaciado) / (iw + sangrado * 2 + espaciado));
      const esperadoFilas = Math.floor((ph + espaciado) / (ih + sangrado * 2 + espaciado));
      expect(pose.columnas).toBe(esperadoCols);
      expect(pose.filas).toBe(esperadoFilas);
    }
  });

  it('nunca deja la tinta más cerca del borde que el margen pedido', () => {
    for (const margenMinimo of [0, 5, 10, 15, 20]) {
      const pose = calcularPose({ pliego: A3, pieza: { ancho: 55, alto: 33 }, sangrado: 3, margenMinimo });
      expect(pose.bloque.margenSangrado.izquierdo).toBeGreaterThanOrEqual(margenMinimo - 1e-9);
      expect(pose.bloque.margenSangrado.superior).toBeGreaterThanOrEqual(margenMinimo - 1e-9);
    }
  });

  it('el margen de trim siempre supera al de tinta por el sangrado', () => {
    const pose = calcularPose({ pliego: A3, pieza: { ancho: 55, alto: 33 }, sangrado: 3 });
    expect(pose.bloque.margenIzquierdo - pose.bloque.margenSangrado.izquierdo).toBeCloseTo(3, 6);
    expect(pose.bloque.margenSuperior - pose.bloque.margenSangrado.superior).toBeCloseTo(3, 6);
  });

  it('centra el bloque repartiendo el sobrante en partes iguales', () => {
    const pose = calcularPose({ pliego: A3, pieza: { ancho: 60, alto: 60 }, sangrado: 3, margenMinimo: 10 });
    expect(pose.bloque.margenIzquierdo).toBeCloseTo(pose.bloque.margenDerecho, 6);
    expect(pose.bloque.margenSuperior).toBeCloseTo(pose.bloque.margenInferior, 6);
    expect(pose.bloque.margenSangrado.izquierdo * 2 + pose.bloque.tinta.ancho).toBeCloseTo(A3.ancho, 6);
  });
});

describe('rotación', () => {
  it('con permitirRotacion en false se queda con la orientación original', () => {
    const pose = calcularPose({
      pliego: A3,
      pieza: { ancho: 70, alto: 40 },
      sangrado: 3,
      espaciado: 0,
      margenMinimo: 10,
      permitirRotacion: false,
    });
    expect(pose.rotada).toBe(false);
    expect(pose.cantidad).toBe(24);
  });

  it('una pieza cuadrada nunca se marca como rotada', () => {
    const pose = calcularPose({ pliego: A3, pieza: { ancho: 60, alto: 60 }, sangrado: 3, margenMinimo: 10 });
    expect(pose.rotada).toBe(false);
  });

  it('rota si es la única forma de que la pieza entre', () => {
    const pose = calcularPose({
      pliego: { ancho: 200, alto: 400 },
      pieza: { ancho: 350, alto: 100 },
      sangrado: 0,
      margenMinimo: 10,
    });
    expect(pose.rotada).toBe(true);
    expect(pose.cantidad).toBe(1);
  });
});

describe('parámetros y edge cases', () => {
  it('con espaciado 0 la calle es sólo el doble del sangrado', () => {
    const pose = calcularPose({ pliego: A3, pieza: { ancho: 50, alto: 50 }, sangrado: 3, espaciado: 0, margenMinimo: 10 });
    expect(pose.parametros.calle).toBe(6);
  });

  it('el espaciado se suma a la calle y baja la cantidad', () => {
    const base = { pliego: A3, pieza: { ancho: 50, alto: 50 }, sangrado: 3, margenMinimo: 10 };
    const sinEspaciado = calcularPose({ ...base, espaciado: 0 });
    const conEspaciado = calcularPose({ ...base, espaciado: 10 });
    expect(conEspaciado.parametros.calle).toBe(16);
    expect(conEspaciado.cantidad).toBeLessThan(sinEspaciado.cantidad);
  });

  it('con sangrado 0 y espaciado 0 las piezas quedan pegadas', () => {
    const pose = calcularPose({ pliego: { ancho: 300, alto: 300 }, pieza: { ancho: 100, alto: 100 }, sangrado: 0, espaciado: 0, margenMinimo: 0 });
    expect(pose.cantidad).toBe(9);
    expect(pose.aprovechamiento).toBe(1);
    expect(pose.desperdicio_mm2).toBe(0);
    // Con calle 0 las líneas de trim contiguas coinciden.
    expect(pose.marcasCorte.verticales).toEqual([0, 100, 100, 200, 200, 300]);
  });

  it('rechaza una pieza más grande que el pliego', () => {
    expect(() => calcularPose({ pliego: A3, pieza: { ancho: 400, alto: 500 } })).toThrow(ErrorDePose);
    expect(() => calcularPose({ pliego: A3, pieza: { ancho: 400, alto: 500 } })).toThrow(/no entra en un pliego/);
  });

  it('rechaza una pieza que sólo no entra por la demasía', () => {
    // 99 + 3×2 = 105 > 100: entra el trim pero no la tinta.
    expect(() => calcularPose({ pliego: { ancho: 100, alto: 100 }, pieza: { ancho: 99, alto: 99 }, sangrado: 3 })).toThrow(/demasía/);
  });

  it('rechaza una pieza que sólo no entra por el margen de pinza', () => {
    expect(() => calcularPose({ pliego: { ancho: 100, alto: 100 }, pieza: { ancho: 85, alto: 85 }, sangrado: 3, margenMinimo: 10 })).toThrow(/margen de 10 mm/);
  });

  it('rechaza medidas negativas o cero', () => {
    expect(() => calcularPose({ pliego: A3, pieza: { ancho: -10, alto: 20 } })).toThrow(/pieza.ancho/);
    expect(() => calcularPose({ pliego: A3, pieza: { ancho: 0, alto: 20 } })).toThrow(/pieza.ancho/);
    expect(() => calcularPose({ pliego: A3, pieza: { ancho: 20, alto: 20 }, sangrado: -1 })).toThrow(/sangrado/);
    expect(() => calcularPose({ pliego: A3, pieza: { ancho: 20, alto: 20 }, espaciado: -1 })).toThrow(/espaciado/);
  });

  it('rechaza un margen que se come todo el pliego', () => {
    expect(() => calcularPose({ pliego: A3, pieza: { ancho: 20, alto: 20 }, margenMinimo: 200 })).toThrow(/no deja área útil/);
  });

  it('exige la pieza y valida tipos', () => {
    expect(() => calcularPose({ pliego: A3 })).toThrow(/Falta "pieza"/);
    expect(() => calcularPose({ pliego: A3, pieza: { ancho: '60', alto: 60 } })).toThrow(/número/);
    expect(() => calcularPose({ pliego: A3, pieza: { ancho: 60, alto: 60 }, permitirRotacion: 'si' })).toThrow(/true o false/);
  });

  it('rechaza una estrategia desconocida', () => {
    expect(() => calcularPose({ pliego: A3, pieza: { ancho: 60, alto: 60 }, estrategia: 'genetico' })).toThrow(/Estrategia "genetico"/);
  });

  it('usa el pliego 32×47 y el perfil de hoja como valores por defecto', () => {
    const pose = calcularPose({ pieza: { ancho: 60, alto: 60 } });
    expect(pose.pliego).toEqual({ ancho: 320, alto: 470 });
    expect(pose.parametros).toMatchObject({ sangrado: 3, espaciado: 0, margenMinimo: 0 });
    expect(pose.cantidad).toBe(28);
  });

  it('expone las dos orientaciones para que la UI las compare', () => {
    const pose = calcularPose({ pliego: A3, pieza: { ancho: 70, alto: 40 }, sangrado: 3 });
    expect(pose.alternativas.normal).toMatchObject({ cantidad: 27 });
    expect(pose.alternativas.rotada).toMatchObject({ cantidad: 30 });
    expect(pose.cantidad).toBe(30);
  });

  it('a igualdad de cantidad se queda con la orientación sin rotar', () => {
    // Caso del mazo de tarot: 4×3 normal y 2×6 rotada dan 12 piezas. La
    // calculadora del sitio desempata por sobrante y elige la rotada, que
    // deja 7 mm de margen vertical y obliga a girar el arte.
    const pose = calcularPose({
      pliego: { ancho: 320, alto: 470 },
      pieza: { ancho: 70, alto: 120 },
      sangrado: 3,
    });
    expect(pose.alternativas.normal.cantidad).toBe(12);
    expect(pose.alternativas.rotada.cantidad).toBe(12);
    expect(pose.rotada).toBe(false);
    expect(pose.columnas).toBe(4);
  });

  it('no muta el objeto de entrada', () => {
    const entrada = { pliego: { ...A3 }, pieza: { ancho: 60, alto: 60 } };
    const copia = structuredClone(entrada);
    calcularPose(entrada);
    expect(entrada).toEqual(copia);
  });

  it('avisa cuando el margen no alcanza para las marcas de corte', () => {
    const pose = calcularPose({ pliego: { ancho: 300, alto: 300 }, pieza: { ancho: 100, alto: 100 }, sangrado: 0, espaciado: 0, margenMinimo: 0 });
    expect(pose.advertencias.length).toBeGreaterThan(0);
    expect(pose.advertencias[0]).toMatch(/marcas de corte/);
  });
});

describe('posiciones', () => {
  const pose = calcularPose({ pliego: A3, pieza: { ancho: 60, alto: 60 }, sangrado: 3, margenMinimo: 10 });

  it('devuelve una posición por pieza, en orden de lectura', () => {
    expect(pose.posiciones).toHaveLength(pose.cantidad);
    expect(pose.posiciones.map((p) => p.indice)).toEqual([...Array(pose.cantidad).keys()]);
    expect(pose.posiciones[0]).toMatchObject({ fila: 0, columna: 0 });
    expect(pose.posiciones.at(-1)).toMatchObject({ fila: pose.filas - 1, columna: pose.columnas - 1 });
  });

  it('las piezas entran enteras en el pliego, sangrado incluido', () => {
    for (const p of pose.posiciones) {
      expect(p.sangradoCaja.x).toBeGreaterThanOrEqual(0);
      expect(p.sangradoCaja.y).toBeGreaterThanOrEqual(0);
      expect(p.sangradoCaja.x + p.sangradoCaja.ancho).toBeLessThanOrEqual(pose.pliego.ancho);
      expect(p.sangradoCaja.y + p.sangradoCaja.alto).toBeLessThanOrEqual(pose.pliego.alto);
    }
  });

  it('las cajas de sangrado de piezas contiguas no se superponen', () => {
    const a = pose.posiciones.find((p) => p.fila === 0 && p.columna === 0);
    const b = pose.posiciones.find((p) => p.fila === 0 && p.columna === 1);
    expect(a.sangradoCaja.x + a.sangradoCaja.ancho).toBeLessThanOrEqual(b.sangradoCaja.x + 1e-9);
  });
});
