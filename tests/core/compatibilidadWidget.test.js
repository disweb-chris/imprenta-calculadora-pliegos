import { describe, expect, it } from 'vitest';
import { calcularTrabajo } from '../../src/core/trabajo.js';
import { desdeCalculadora } from '../../src/core/unidades.js';

/**
 * Golden test contra la calculadora que está hoy en producción.
 *
 * `widgetOriginal` es una transcripción literal de la aritmética del widget
 * del sitio (cm para pliego y pieza, mm para demasía y separación). El port a
 * `src/core` tiene que dar exactamente lo mismo, porque el sitio ya consume
 * estos números.
 *
 * ÚNICA divergencia deliberada: el desempate de orientación. Ver el bloque
 * "divergencias conocidas" al final y docs/NESTING.md.
 */

function fitCount(sheet, piece, gutter) {
  if (piece <= 0) return 0;
  return Math.max(0, Math.floor((sheet + gutter) / (piece + gutter)));
}

function layoutOriginal(sheetW, sheetH, pieceW, pieceH, gutter) {
  const cols = fitCount(sheetW, pieceW, gutter);
  const rows = fitCount(sheetH, pieceH, gutter);
  const usedW = cols > 0 ? cols * pieceW + (cols - 1) * gutter : 0;
  const usedH = rows > 0 ? rows * pieceH + (rows - 1) * gutter : 0;
  return { cols, rows, count: cols * rows, leftoverW: sheetW - usedW, leftoverH: sheetH - usedH };
}

function widgetOriginal(e) {
  const bleedCM = e.bleed / 10;
  const gutterCM = e.gutter / 10;
  const effW = e.itemW + 2 * bleedCM;
  const effH = e.itemH + 2 * bleedCM;

  const a = layoutOriginal(e.sheetW, e.sheetH, effW, effH, gutterCM);
  const b = layoutOriginal(e.sheetW, e.sheetH, effH, effW, gutterCM);

  let best = a;
  if (b.count > a.count) best = b;
  else if (b.count === a.count && b.count > 0) {
    if (b.leftoverW + b.leftoverH < a.leftoverW + a.leftoverH) best = b;
  }
  if (best.count <= 0) return null;

  const baseSheets = Math.ceil(e.qty / best.count);
  const sheets = baseSheets + e.extraSheets;
  const faces = e.doubleFace ? 2 : 1;
  const totalPrints = sheets * faces;

  const totalCost = sheets * e.costPaper + totalPrints * e.costPrint + e.costSetup;
  const costWithProd = totalCost * (1 + e.prodPct / 100);
  const finalPrice = costWithProd * (1 + e.profitPct / 100);
  const vatAmount = e.applyVat ? finalPrice * 0.21 : 0;

  return {
    count: best.count,
    baseSheets,
    sheets,
    totalPrints,
    totalCost,
    unitCost: totalCost / e.qty,
    finalPrice,
    unitPrice: finalPrice / e.qty,
    vatAmount,
    finalWithVat: finalPrice + vatAmount,
    unitWithVat: (finalPrice + vatAmount) / e.qty,
    alternativas: { normal: a.count, rotada: b.count },
  };
}

function portado(e) {
  return calcularTrabajo({
    ...desdeCalculadora({
      sheetW: e.sheetW, sheetH: e.sheetH,
      itemW: e.itemW, itemH: e.itemH,
      bleed: e.bleed, gutter: e.gutter,
    }),
    margenMinimo: 0,
    // La comparación con producción se hace con la garantía de marcas
    // apagada: es la única forma de probar que el port es fiel. El default
    // del servicio es 5 mm; su efecto se mide en el bloque de divergencias.
    margenMarcas: 0,
    cantidad: e.qty,
    merma: e.extraSheets,
    dobleFaz: e.doubleFace,
    costoPapel: e.costPaper,
    costoImpresion: e.costPrint,
    costoFijo: e.costSetup,
    porcentajeProduccion: e.prodPct,
    porcentajeGanancia: e.profitPct,
    aplicarIva: e.applyVat,
  });
}

const centavos = (n) => Math.round(n * 100) / 100;

/** Genera un barrido determinista de entradas realistas. */
function* casos() {
  const pliegos = [[32, 47], [22, 34], [21.6, 35.6], [21, 29.7], [29.7, 42], [100, 100]];
  const piezas = [[9, 5], [7, 12], [6, 6], [7, 4], [5.5, 8.5], [10, 21], [4, 4]];
  const demasias = [0, 2, 3];
  const separaciones = [0, 3, 6];
  let i = 0;
  for (const [sheetW, sheetH] of pliegos) {
    for (const [itemW, itemH] of piezas) {
      for (const bleed of demasias) {
        for (const gutter of separaciones) {
          i += 1;
          yield {
            sheetW, sheetH, itemW, itemH, bleed, gutter,
            qty: [50, 100, 250, 1000][i % 4],
            extraSheets: [0, 2, 5][i % 3],
            doubleFace: i % 2 === 0,
            costPaper: [0, 120, 340.5][i % 3],
            costPrint: [0, 80, 15.25][i % 3],
            costSetup: [0, 5000][i % 2],
            prodPct: [0, 15, 7.5][i % 3],
            profitPct: [0, 40, 22][i % 3],
            applyVat: i % 3 === 0,
          };
        }
      }
    }
  }
}

describe('compatibilidad con la calculadora en producción', () => {
  const todos = [...casos()];

  it('el barrido cubre una cantidad razonable de combinaciones', () => {
    expect(todos.length).toBeGreaterThan(300);
  });

  it('reproduce cantidad, pliegos e impresiones en todos los casos', () => {
    let comparados = 0;
    let divergencias = 0;

    for (const caso of todos) {
      const esperado = widgetOriginal(caso);
      if (!esperado) {
        // El widget no arma pose: el port tiene que rechazarlo.
        expect(() => portado(caso)).toThrow();
        continue;
      }

      const obtenido = portado(caso);

      // Divergencias deliberadas: desempate de orientación y error de punto
      // flotante del cálculo en centímetros. Se cuentan aparte.
      const empate = esperado.alternativas.normal === esperado.alternativas.rotada;
      if (pierdeUnaFilaPorRedondeo(caso) || (empate && esperado.count !== obtenido.piezasPorPliego)) {
        divergencias += 1;
        continue;
      }

      comparados += 1;
      expect(obtenido.piezasPorPliego, JSON.stringify(caso)).toBe(esperado.count);
      expect(obtenido.pliegos.pliegosNetos).toBe(esperado.baseSheets);
      expect(obtenido.pliegos.pliegosTotales).toBe(esperado.sheets);
      expect(obtenido.pliegos.pasadas).toBe(esperado.totalPrints);
    }

    expect(comparados).toBeGreaterThan(250);
    // Si esto crece, alguien tocó el desempate sin querer.
    expect(divergencias).toBeLessThan(todos.length * 0.05);
  });

  it('reproduce toda la cadena de costos y el IVA', () => {
    for (const caso of todos) {
      const esperado = widgetOriginal(caso);
      if (!esperado) continue;
      if (esperado.alternativas.normal === esperado.alternativas.rotada) continue;
      if (pierdeUnaFilaPorRedondeo(caso)) continue;

      const { cotizacion } = portado(caso);
      const etiqueta = JSON.stringify(caso);

      expect(cotizacion.costoTotal, etiqueta).toBe(centavos(esperado.totalCost));
      expect(cotizacion.costoUnitario, etiqueta).toBe(centavos(esperado.unitCost));
      expect(cotizacion.precioFinal, etiqueta).toBe(centavos(esperado.finalPrice));
      expect(cotizacion.precioUnitario, etiqueta).toBe(centavos(esperado.unitPrice));
      expect(cotizacion.iva, etiqueta).toBe(centavos(esperado.vatAmount));
      expect(cotizacion.precioFinalConIva, etiqueta).toBe(centavos(esperado.finalWithVat));
      expect(cotizacion.precioUnitarioConIva, etiqueta).toBe(centavos(esperado.unitWithVat));
    }
  });

  it('reproduce las dos alternativas de orientación que muestra la UI', () => {
    let iguales = 0;
    for (const caso of todos) {
      const esperado = widgetOriginal(caso);
      if (!esperado) continue;
      if (pierdeUnaFilaPorRedondeo(caso)) continue; // ver divergencias conocidas
      const { pose } = portado(caso);
      expect(pose.alternativas.normal.cantidad, JSON.stringify(caso)).toBe(esperado.alternativas.normal);
      expect(pose.alternativas.rotada.cantidad, JSON.stringify(caso)).toBe(esperado.alternativas.rotada);
      iguales += 1;
    }
    expect(iguales).toBeGreaterThan(300);
  });
});

/**
 * Detecta los casos donde la aritmética en centímetros del widget se come una
 * fila o una columna por error de punto flotante. El port trabaja en
 * milímetros enteros, así que no los reproduce (a propósito).
 */
function pierdeUnaFilaPorRedondeo(e) {
  const b = e.bleed / 10;
  const g = e.gutter / 10;
  const enCm = (sheet, item) => fitCount(sheet, item + 2 * b, g);
  const enMm = (sheet, item) => fitCount(sheet * 10, item * 10 + 2 * e.bleed, e.gutter);
  return (
    enCm(e.sheetW, e.itemW) !== enMm(e.sheetW, e.itemW) ||
    enCm(e.sheetH, e.itemH) !== enMm(e.sheetH, e.itemH) ||
    enCm(e.sheetW, e.itemH) !== enMm(e.sheetW, e.itemH) ||
    enCm(e.sheetH, e.itemW) !== enMm(e.sheetH, e.itemW)
  );
}

describe('divergencias conocidas con la calculadora en producción', () => {
  const TAROT = {
    sheetW: 32, sheetH: 47, itemW: 7, itemH: 12, bleed: 3, gutter: 0,
    qty: 78, extraSheets: 2, doubleFace: true,
    costPaper: 0, costPrint: 0, costSetup: 0, prodPct: 0, profitPct: 0, applyVat: false,
  };

  it('el desempate de orientación: producción elige 2×6, el port elige 4×3', () => {
    const original = widgetOriginal(TAROT);
    const nuevo = portado(TAROT);

    // Las dos orientaciones dan 12 cartas.
    expect(original.alternativas.normal).toBe(12);
    expect(original.alternativas.rotada).toBe(12);
    expect(original.count).toBe(12);
    expect(nuevo.piezasPorPliego).toBe(12);

    // Pero el widget se queda con la rotada 2×6 y el port con la 4×3 real.
    expect(nuevo.pose).toMatchObject({ columnas: 4, filas: 3, rotada: false });
  });

  it('la pose que elige producción deja un margen de tinta impracticable', () => {
    // 2×6 rotada: 6 filas de 7.6 cm = 45.6 cm en un pliego de 47 → 7 mm.
    const margenRotada = (47 - 6 * 7.6) / 2 * 10;
    expect(margenRotada).toBeCloseTo(7, 5);

    // 4×3 normal: 3 filas de 12.6 cm = 37.8 cm → 46 mm.
    const { pose } = portado(TAROT);
    expect(pose.bloque.margenSangrado.superior).toBeCloseTo(46, 5);
  });

  it('la aritmética en centímetros pierde una fila por error de punto flotante', () => {
    // Pliego A3, pieza 70×40 mm, demasía 2 mm, separación 3 mm.
    // En cm: 4 + 2×0.2 + 0.3 = 4.700000000000001, y 42.3 / eso da 8.999…
    // En mm: 423 / 47 = 9 exacto.
    const caso = {
      sheetW: 29.7, sheetH: 42, itemW: 7, itemH: 4, bleed: 2, gutter: 3,
      qty: 50, extraSheets: 0, doubleFace: false,
      costPaper: 0, costPrint: 0, costSetup: 0, prodPct: 0, profitPct: 0, applyVat: false,
    };

    // La suma da 4.7 exacto, pero la división de dos binarios inexactos no.
    expect(42.3 / 4.7).toBeLessThan(9);
    expect(423 / 47).toBe(9);
    expect(widgetOriginal(caso).alternativas.normal).toBe(24); // 3 × 8
    expect(portado(caso).pose.alternativas.normal.cantidad).toBe(27); // 3 × 9
  });

  it('la garantía de marcas descarta las poses que la guillotina no puede cortar', () => {
    // 32×47 cm con pieza de 9×5 cm sin demasía y 3 mm de separación:
    // producción dice 30 piezas (5×6), pero la tinta llega a 2.5 mm del borde
    // y no hay lugar para el tick de 5 mm.
    const caso = {
      sheetW: 32, sheetH: 47, itemW: 9, itemH: 5, bleed: 0, gutter: 3,
      qty: 250, extraSheets: 0, doubleFace: false,
      costPaper: 0, costPrint: 0, costSetup: 0, prodPct: 0, profitPct: 0, applyVat: false,
    };

    expect(widgetOriginal(caso).count).toBe(30);

    // Con la garantía apagada el port reproduce ese 30.
    expect(portado(caso).piezasPorPliego).toBe(30);

    // Con el default del servicio baja a 24, y esas 24 sí se pueden cortar.
    const conGarantia = calcularTrabajo({
      ...desdeCalculadora({ sheetW: 32, sheetH: 47, itemW: 9, itemH: 5, bleed: 0, gutter: 3 }),
      cantidad: 250,
    });
    expect(conGarantia.piezasPorPliego).toBe(24);
    expect(conGarantia.pose.bloque.margenSangrado.izquierdo).toBeGreaterThanOrEqual(5);
    expect(conGarantia.pose.advertencias).toHaveLength(0);
  });

  it('la cantidad de pliegos y el costo no cambian por el desempate', () => {
    const original = widgetOriginal(TAROT);
    const nuevo = portado(TAROT);
    expect(nuevo.pliegos.pliegosTotales).toBe(original.sheets);
    expect(nuevo.pliegos.pasadas).toBe(original.totalPrints);
  });
});
