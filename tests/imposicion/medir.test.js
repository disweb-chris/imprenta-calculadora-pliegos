import { describe, expect, it } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { imponer } from '../../src/imposicion/imponer.js';
import { medirPliego, compararMedidas } from '../../src/imposicion/medir.js';
import { arteDePrueba } from './ayudas.js';

/**
 * Ida y vuelta: se impone una pose conocida, se mide el PDF resultante como si
 * viniera de afuera, y tiene que salir la misma pose.
 *
 * Es lo que permite comparar contra un pliego armado por una persona: el
 * medidor no sabe nada de cómo se generó el archivo, sólo lee lo que está
 * dibujado.
 */

const casos = [
  {
    nombre: 'tarot 70×120 en 320×470',
    params: { pieza: { ancho: 70, alto: 120 }, pliego: { ancho: 320, alto: 470 }, sangrado: 3, espaciado: 0 },
    espera: { columnas: 4, filas: 3, pieza: [70, 120], calle: 6, margen: [11, 49] },
  },
  {
    nombre: 'pieza que la pose rota, 85×125',
    params: { pieza: { ancho: 85, alto: 125 }, pliego: { ancho: 320, alto: 470 }, sangrado: 3, espaciado: 0 },
    espera: { columnas: 2, filas: 5, pieza: [125, 85], calle: 6, margen: [32, 10.5] },
  },
  {
    nombre: 'con separación entre piezas',
    params: { pieza: { ancho: 60, alto: 60 }, pliego: { ancho: 320, alto: 470 }, sangrado: 3, espaciado: 6 },
    espera: { calle: 12 },
  },
  {
    nombre: 'sin demasía, con espejado',
    params: { pieza: { ancho: 70, alto: 120 }, pliego: { ancho: 320, alto: 470 }, sangrado: 3, espaciado: 0 },
    arte: { conDemasia: false, declararCajas: false },
    espera: { columnas: 4, filas: 3, pieza: [70, 120], calle: 6, margen: [11, 49] },
  },
];

describe('medir un pliego impuesto', () => {
  for (const caso of casos) {
    it(`reconstruye la pose: ${caso.nombre}`, async () => {
      const { pdf, informe } = await imponer({
        frente: await arteDePrueba({ paginas: 40, pieza: caso.params.pieza, ...(caso.arte ?? {}) }),
        ...caso.params,
      });

      const [medida] = await medirPliego(pdfjs, pdf, [1]);

      expect(medida.pliego.ancho).toBeCloseTo(caso.params.pliego.ancho, 1);
      expect(medida.pliego.alto).toBeCloseTo(caso.params.pliego.alto, 1);

      // Lo medido tiene que coincidir con lo que dijo el generador.
      expect(medida.columnas.cantidad).toBe(informe.grilla.columnas);
      expect(medida.filas.cantidad).toBe(informe.grilla.filas);
      expect(medida.columnas.piezaUniforme).toBe(true);
      expect(medida.filas.piezaUniforme).toBe(true);
      expect(medida.columnas.calleUniforme).toBe(true);

      if (caso.espera.columnas) {
        expect(medida.columnas.cantidad).toBe(caso.espera.columnas);
        expect(medida.filas.cantidad).toBe(caso.espera.filas);
        expect(medida.columnas.pieza).toBeCloseTo(caso.espera.pieza[0], 1);
        expect(medida.filas.pieza).toBeCloseTo(caso.espera.pieza[1], 1);
        expect(medida.columnas.margenInicio).toBeCloseTo(caso.espera.margen[0], 1);
        expect(medida.filas.margenInicio).toBeCloseTo(caso.espera.margen[1], 1);
      }
      if (caso.espera.calle !== undefined) {
        expect(medida.columnas.calle).toBeCloseTo(caso.espera.calle, 1);
      }
    }, 30000);
  }

  it('encuentra exactamente las marcas que dijo haber dibujado', async () => {
    const params = { pieza: { ancho: 70, alto: 120 }, pliego: { ancho: 320, alto: 470 }, sangrado: 3 };
    const { pdf, informe } = await imponer({ frente: await arteDePrueba({ paginas: 12 }), ...params });
    const [m] = await medirPliego(pdfjs, pdf, [1]);

    expect(m.marcasCorte.verticales).toHaveLength(informe.grilla.columnas * 2);
    expect(m.marcasCorte.horizontales).toHaveLength(informe.grilla.filas * 2);
    expect(m.marcasCorte.verticales).toEqual([11, 81, 87, 157, 163, 233, 239, 309]);
    expect(m.marcasCorte.horizontales).toEqual([49, 169, 175, 295, 301, 421]);
  }, 30000);

  it('el arte cargado de filetes decorativos no ensucia la medición', async () => {
    // El arte de prueba trae círculos y marcos; la detección tiene que
    // quedarse sólo con las marcas de guillotina.
    const { pdf } = await imponer({
      frente: await arteDePrueba({ paginas: 12 }),
      pieza: { ancho: 70, alto: 120 }, pliego: { ancho: 320, alto: 470 }, sangrado: 3,
    });
    const [m] = await medirPliego(pdfjs, pdf, [1]);
    expect(m.trazosLeidos).toBeGreaterThan(m.marcasCorte.verticales.length);
    expect(m.columnas.cantidad).toBe(4);
  }, 30000);
});

describe('comparar dos pliegos', () => {
  const params = { pieza: { ancho: 70, alto: 120 }, pliego: { ancho: 320, alto: 470 }, sangrado: 3 };

  it('dos poses iguales coinciden', async () => {
    const a = await imponer({ frente: await arteDePrueba({ paginas: 12 }), ...params });
    const b = await imponer({ frente: await arteDePrueba({ paginas: 12, fondo: undefined }), ...params });

    const [ma] = await medirPliego(pdfjs, a.pdf, [1]);
    const [mb] = await medirPliego(pdfjs, b.pdf, [1]);
    const r = compararMedidas(ma, mb);

    expect(r.pliegoIgual).toBe(true);
    expect(r.coincide).toBe(true);
    expect(r.lineasVerticales.desvioMaximo_mm).toBe(0);
  }, 40000);

  it('detecta una diferencia de demasía, que corre todas las marcas', async () => {
    const a = await imponer({ frente: await arteDePrueba({ paginas: 12 }), ...params });
    const b = await imponer({
      frente: await arteDePrueba({ paginas: 12, sangrado: 2 }),
      ...params, sangrado: 2,
    });

    const [ma] = await medirPliego(pdfjs, a.pdf, [1]);
    const [mb] = await medirPliego(pdfjs, b.pdf, [1]);
    const r = compararMedidas(ma, mb);

    expect(r.coincide).toBe(false);
    expect(r.lineasVerticales.desvioMaximo_mm).toBeGreaterThan(0.5);
  }, 40000);

  it('detecta que una pose tiene otra grilla', async () => {
    const a = await imponer({ frente: await arteDePrueba({ paginas: 12 }), ...params });
    const b = await imponer({
      frente: await arteDePrueba({ paginas: 12, pieza: { ancho: 60, alto: 90 } }),
      ...params, pieza: { ancho: 60, alto: 90 },
    });

    const [ma] = await medirPliego(pdfjs, a.pdf, [1]);
    const [mb] = await medirPliego(pdfjs, b.pdf, [1]);
    const r = compararMedidas(ma, mb);

    expect(r.coincide).toBe(false);
    expect(r.lineasVerticales.a).not.toBe(r.lineasVerticales.b);
    expect(r.lineasVerticales.desvioMaximo_mm).toBeNull();
  }, 40000);
});
