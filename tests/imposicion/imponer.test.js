import { describe, expect, it } from 'vitest';
import { PDFDocument, cmyk } from 'pdf-lib';
import { imponer } from '../../src/imposicion/imponer.js';
import { ErrorDePose } from '../../src/nesting/validacion.js';
import { mmApt, enMm } from '../../src/imposicion/unidades.js';
import { arteDePrueba, colocacionesDe, operadoresDe, crudoDe, invocacionesDeXObject } from './ayudas.js';

/** Pliego y pieza de la pose de referencia: mazo de tarot. */
const TAROT = {
  pieza: { ancho: 70, alto: 120 },
  pliego: { ancho: 320, alto: 470 },
  sangrado: 3,
  espaciado: 0,
};

describe('imposición de un mazo completo', () => {
  it('reparte 78 cartas en 7 pliegos de 12, frente y dorso', async () => {
    const { pdf, informe } = await imponer({
      frente: await arteDePrueba({ paginas: 78 }),
      dorso: await arteDePrueba({ paginas: 1 }),
      ...TAROT,
    });

    expect(informe.piezasPorPliego).toBe(12);
    expect(informe.grilla).toEqual({ columnas: 4, filas: 3 });
    expect(informe.pliegos).toBe(7);
    expect(informe.lugaresVacios).toBe(6);
    expect(informe.paginasDelPdf).toBe(14); // 7 frentes + 7 dorsos

    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(14);
  });

  it('las páginas salen al tamaño del pliego', async () => {
    const { pdf } = await imponer({ frente: await arteDePrueba({ paginas: 12 }), ...TAROT });
    const doc = await PDFDocument.load(pdf);
    for (const pagina of doc.getPages()) {
      expect(enMm(pagina.getWidth())).toBeCloseTo(320, 1);
      expect(enMm(pagina.getHeight())).toBeCloseTo(470, 1);
    }
  });

  it('alterna frente y dorso, pliego por pliego', async () => {
    const { informe } = await imponer({
      frente: await arteDePrueba({ paginas: 24 }),
      dorso: await arteDePrueba({ paginas: 1 }),
      ...TAROT,
    });
    expect(informe.caras).toEqual(['frente', 'dorso']);
    expect(informe.paginasDelPdf).toBe(4); // F1 D1 F2 D2
  });

  it('sin dorso arma una sola cara por pliego', async () => {
    const { informe } = await imponer({ frente: await arteDePrueba({ paginas: 24 }), ...TAROT });
    expect(informe.caras).toEqual(['frente']);
    expect(informe.paginasDelPdf).toBe(2);
  });

  it('el último pliego queda incompleto sin romper nada', async () => {
    const { informe } = await imponer({ frente: await arteDePrueba({ paginas: 13 }), ...TAROT });
    expect(informe.pliegos).toBe(2);
    expect(informe.lugaresVacios).toBe(11);
  });

  it('el dorso registra con el frente', async () => {
    const { informe } = await imponer({
      frente: await arteDePrueba({ paginas: 12 }),
      dorso: await arteDePrueba({ paginas: 1 }),
      ...TAROT,
    });
    expect(informe.registro).toEqual({ desvioMaximo_mm: 0, registra: true });
    expect(informe.ejeVolteo).toBe('vertical');
  });
});

describe('el arte del cliente llega intacto', () => {
  it('conserva los valores CMYK exactos, sin pasar por RGB', async () => {
    const { pdf } = await imponer({ frente: await arteDePrueba({ paginas: 12 }), ...TAROT });
    const ops = operadoresDe(pdf);

    expect(ops).toMatch(/0\.11 0\.22 0\.33 0\.44 k/);   // el fondo
    expect(ops).toMatch(/0\.91 0\.07 0\.05 0\.03 k/);   // el círculo
    expect(ops).not.toMatch(/\brg\b/);                   // nada convertido a RGB
    expect(ops).not.toMatch(/\bRG\b/);
  });

  it('no rasteriza: los vectores siguen siendo vectores', async () => {
    const { pdf } = await imponer({ frente: await arteDePrueba({ paginas: 12 }), ...TAROT });
    expect(operadoresDe(pdf)).toMatch(/\d c\b/);          // curvas Bézier del círculo
    expect(crudoDe(pdf)).not.toMatch(/\/Subtype\s*\/Image/);
  });

  it('embebe cada página una sola vez y la referencia N veces', async () => {
    const frente = await arteDePrueba({ paginas: 78 });
    const sinDorso = await imponer({ frente, ...TAROT });
    const conDorso = await imponer({ frente, dorso: await arteDePrueba({ paginas: 1 }), ...TAROT });

    // Una forma por página de arte distinta (78 frentes + 1 dorso), no una por
    // lugar del pliego: el dorso se DIBUJA 84 veces pero se EMBEBE una sola.
    const formas = (crudoDe(conDorso.pdf).match(/\/Subtype\s*\/Form/g) ?? []).length;
    expect(formas).toBeLessThanOrEqual(79);
    // 78 frentes + 78 dorsos: en el pliego incompleto tampoco se imprime el
    // dorso de los lugares vacíos.
    expect(invocacionesDeXObject(operadoresDe(conDorso.pdf))).toBe(78 + 78);

    // Y el peso lo confirma: agregar el dorso suma los 7 pliegos nuevos, no 84
    // copias del arte.
    const unaPagina = (await arteDePrueba({ paginas: 1 })).length;
    expect(conDorso.pdf.length - sinDorso.pdf.length).toBeLessThan(unaPagina * 84 / 4);
  });

  it('coloca cada carta en la posición que dice la pose', async () => {
    const { pdf } = await imponer({ frente: await arteDePrueba({ paginas: 12 }), ...TAROT });
    const puestas = colocacionesDe(operadoresDe(pdf)).map((c) => ({ x: enMm(c.x), y: enMm(c.y) }));

    expect(puestas).toHaveLength(12);

    // Caja de sangrado de la carta 1: x = 11 − 3 = 8 mm; y desde abajo =
    // 470 − 49 − 120 − 3 = 298 mm. Pitch de 76 × 126 mm.
    expect(puestas[0].x).toBeCloseTo(8, 1);
    expect(puestas[0].y).toBeCloseTo(298, 1);
    expect(puestas[1].x).toBeCloseTo(8 + 76, 1);
    expect(puestas[1].y).toBeCloseTo(298, 1);
    expect(puestas[4].x).toBeCloseTo(8, 1);       // primera de la segunda fila
    expect(puestas[4].y).toBeCloseTo(298 - 126, 1);

    // Nada se sale del pliego, sangrado incluido.
    for (const p of puestas) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + 76).toBeLessThanOrEqual(320);
      expect(p.y + 126).toBeLessThanOrEqual(470);
    }
  });

  it('el dorso cae espejado respecto del frente', async () => {
    const { pdf } = await imponer({
      frente: await arteDePrueba({ paginas: 4 }),
      dorso: await arteDePrueba({ paginas: 4 }),
      ...TAROT,
    });
    const puestas = colocacionesDe(operadoresDe(pdf)).map((c) => enMm(c.x));
    const frente = puestas.slice(0, 4);
    const dorso = puestas.slice(4, 8);

    // Carta i del frente en x, la misma carta en el dorso en 320 − x − 76.
    for (let i = 0; i < 4; i += 1) {
      expect(dorso[i]).toBeCloseTo(320 - frente[i] - 76, 1);
    }
  });
});

describe('marcas de corte', () => {
  it('dibuja las 28 marcas en negro de registro CMYK', async () => {
    const { pdf, informe } = await imponer({ frente: await arteDePrueba({ paginas: 12 }), ...TAROT });
    expect(informe.marcasPorPliego).toBe(28);

    const ops = operadoresDe(pdf);
    expect(ops).toMatch(/1 1 1 1 K/); // trazo en registro, no en negro plano
    expect((ops.match(/1 1 1 1 K/g) ?? []).length).toBeGreaterThanOrEqual(28);
  });

  it('se pueden apagar', async () => {
    const { pdf, informe } = await imponer({ frente: await arteDePrueba({ paginas: 12 }), marcas: false, ...TAROT });
    expect(informe.marcasPorPliego).toBe(0);
    expect(operadoresDe(pdf)).not.toMatch(/1 1 1 1 K/);
  });
});

describe('demasía del arte del cliente', () => {
  it('detecta la demasía declarada en las cajas del PDF', async () => {
    const { informe } = await imponer({
      frente: await arteDePrueba({ paginas: 12, conDemasia: true, declararCajas: true }),
      ...TAROT,
    });
    expect(Object.keys(informe.demasia.frente)).toEqual(['declarada']);
    expect(informe.demasiaSintetica).toHaveLength(0);
    expect(informe.advertencias).toHaveLength(0);
  });

  it('detecta la demasía por la medida cuando el PDF no declara cajas', async () => {
    const { informe } = await imponer({
      frente: await arteDePrueba({ paginas: 12, conDemasia: true, declararCajas: false }),
      ...TAROT,
    });
    expect(Object.keys(informe.demasia.frente)).toEqual(['por medida']);
    expect(informe.demasiaSintetica).toHaveLength(0);
  });

  it('detecta que falta la demasía y la genera espejando el borde', async () => {
    const { pdf, informe } = await imponer({
      frente: await arteDePrueba({ paginas: 12, conDemasia: false, declararCajas: false }),
      ...TAROT,
    });

    expect(Object.keys(informe.demasia.frente)).toEqual(['ausente']);
    expect(informe.demasiaSintetica).toHaveLength(12);
    expect(informe.advertencias[0]).toMatch(/espejando el borde/);

    // Nueve dibujos por pieza: el arte al centro más ocho bandas espejadas.
    const ops = operadoresDe(pdf);
    expect(invocacionesDeXObject(ops)).toBe(12 * 9);
    expect((ops.match(/-1 0 0 1 /g) ?? []).length).toBeGreaterThan(0);   // espejo en X
    expect((ops.match(/1 0 0 -1 /g) ?? []).length).toBeGreaterThan(0);   // espejo en Y
    expect((ops.match(/-1 0 0 -1 /g) ?? []).length).toBeGreaterThan(0);  // esquinas
  });

  it('con demasía propia dibuja la pieza una sola vez', async () => {
    const { pdf } = await imponer({ frente: await arteDePrueba({ paginas: 12, conDemasia: true }), ...TAROT });
    expect(invocacionesDeXObject(operadoresDe(pdf))).toBe(12);
  });

  it('se puede exigir que el arte venga con demasía', async () => {
    await expect(imponer({
      frente: await arteDePrueba({ paginas: 12, conDemasia: false, declararCajas: false }),
      demasiaSintetica: 'nunca',
      ...TAROT,
    })).rejects.toThrow(/sin demasía/);
  });

  it('corta el trabajo si no puede determinar la demasía', async () => {
    const raro = await PDFDocument.create();
    raro.addPage([200, 300]); // no se parece ni al trim ni al trim + demasía
    await expect(imponer({ frente: await raro.save(), ...TAROT }))
      .rejects.toThrow(/No se pudo determinar la demasía/);
  });
});

describe('dorso', () => {
  it('una sola página se repite en todas las piezas', async () => {
    const { informe } = await imponer({
      frente: await arteDePrueba({ paginas: 78 }),
      dorso: await arteDePrueba({ paginas: 1 }),
      ...TAROT,
    });
    expect(informe.demasia.dorso).toEqual({ declarada: [1] });
    expect(informe.pliegos).toBe(7);
  });

  it('acepta un dorso distinto por pieza', async () => {
    const { informe } = await imponer({
      frente: await arteDePrueba({ paginas: 78 }),
      dorso: await arteDePrueba({ paginas: 78 }),
      ...TAROT,
    });
    expect(informe.demasia.dorso.declarada).toHaveLength(78);
    expect(informe.paginasDelPdf).toBe(14);
  });

  it('rechaza una cantidad de dorsos que no cierra', async () => {
    await expect(imponer({
      frente: await arteDePrueba({ paginas: 78 }),
      dorso: await arteDePrueba({ paginas: 5 }),
      ...TAROT,
    })).rejects.toThrow(/esperaba 1 .* o 78/);
  });

  it('espeja el dorso sobre el eje que se le pida', async () => {
    const vertical = await imponer({
      frente: await arteDePrueba({ paginas: 12 }), dorso: await arteDePrueba({ paginas: 1 }),
      ejeVolteo: 'vertical', ...TAROT,
    });
    const horizontal = await imponer({
      frente: await arteDePrueba({ paginas: 12 }), dorso: await arteDePrueba({ paginas: 1 }),
      ejeVolteo: 'horizontal', ...TAROT,
    });
    expect(vertical.informe.ejeVolteo).toBe('vertical');
    expect(horizontal.informe.ejeVolteo).toBe('horizontal');
    expect(horizontal.informe.registro.registra).toBe(true);
  });
});

describe('validación de entrada', () => {
  it('exige el PDF del frente', async () => {
    await expect(imponer({ ...TAROT })).rejects.toThrow(/Falta el PDF del frente/);
  });

  it('rechaza algo que no es un PDF', async () => {
    await expect(imponer({ frente: new Uint8Array([1, 2, 3, 4]), ...TAROT }))
      .rejects.toThrow(/No se pudo leer el PDF del frente/);
  });

  it('propaga los errores de pose con su mensaje', async () => {
    await expect(imponer({
      frente: await arteDePrueba({ paginas: 1, pieza: { ancho: 400, alto: 500 } }),
      pieza: { ancho: 400, alto: 500 },
      pliego: { ancho: 320, alto: 470 },
      sangrado: 3,
    })).rejects.toThrow(ErrorDePose);
  });
});

describe('selección y orden de páginas', () => {
  it('impone sólo las páginas elegidas, en el orden pedido', async () => {
    const { informe } = await imponer({
      frente: await arteDePrueba({ paginas: 27 }),
      paginasFrente: [3, 2, 4, 5],
      ...TAROT,
    });
    expect(informe.piezas).toBe(4);
    expect(informe.paginasUsadas.frente).toEqual([3, 2, 4, 5]);
  });

  it('saca el dorso del mismo PDF del frente', async () => {
    const { informe } = await imponer({
      frente: await arteDePrueba({ paginas: 27 }),
      paginasFrente: [3, 2, ...Array.from({ length: 24 }, (_, i) => i + 4)],
      paginasDorso: [1],
      ...TAROT,
    });
    expect(informe.piezas).toBe(26);
    expect(informe.caras).toEqual(['frente', 'dorso']);
    expect(informe.paginasUsadas.dorso).toEqual([1]);
  });

  it('un dorso del mismo PDF sigue siendo doble faz y registra', async () => {
    // Con el dorso tomado del mismo archivo, la pose tiene que espejarse igual:
    // si no, el dorso no cae sobre su frente al dar vuelta el pliego.
    const { informe } = await imponer({
      frente: await arteDePrueba({ paginas: 13 }),
      paginasFrente: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
      paginasDorso: [1],
      ...TAROT,
    });
    expect(informe.ejeVolteo).toBe('vertical');
    expect(informe.registro).toEqual({ desvioMaximo_mm: 0, registra: true });
  });

  it('el informe habla de la página del archivo, no de la posición en la selección', async () => {
    const { informe } = await imponer({
      frente: await arteDePrueba({ paginas: 10, conDemasia: false, declararCajas: false }),
      paginasFrente: [7, 8],
      ...TAROT,
    });
    expect(informe.demasia.frente.ausente).toEqual([7, 8]);
    expect(informe.demasiaSintetica.map((d) => d.pagina)).toEqual([7, 8]);
  });

  it('rechaza una página que no existe', async () => {
    await expect(imponer({
      frente: await arteDePrueba({ paginas: 5 }),
      paginasFrente: [1, 99],
      ...TAROT,
    })).rejects.toThrow(/pide la página 99, y el documento tiene 5/);
  });
});

describe('interpretación de rangos de páginas', () => {
  it('entiende números sueltos, rangos y el orden que se escribe', async () => {
    const { interpretarRango } = await import('../../src/imposicion/seleccion.js');
    expect(interpretarRango('1,3,5')).toEqual([1, 3, 5]);
    expect(interpretarRango('4-7')).toEqual([4, 5, 6, 7]);
    expect(interpretarRango('3,2,4-6')).toEqual([3, 2, 4, 5, 6]);
    expect(interpretarRango('7-4')).toEqual([7, 6, 5, 4]);   // descendente
    expect(interpretarRango(' 2 , 1 ')).toEqual([2, 1]);
  });

  it('rechaza lo que no entiende', async () => {
    const { interpretarRango } = await import('../../src/imposicion/seleccion.js');
    expect(() => interpretarRango('1,x,3')).toThrow(/No entiendo "x"/);
    expect(() => interpretarRango('')).toThrow(/quedó vacío/);
  });
});

describe('piezas rotadas en el pliego', () => {
  /** Pieza parada en un pliego donde conviene ponerla de costado. */
  const ROTA = {
    pieza: { ancho: 85, alto: 125 },
    pliego: { ancho: 320, alto: 470 },
    sangrado: 3,
    espaciado: 0,
  };

  it('la pose decide rotar cuando entran más piezas', async () => {
    const { informe } = await imponer({ frente: await arteDePrueba({ paginas: 10, pieza: ROTA.pieza }), ...ROTA });
    expect(informe.rotada).toBe(true);
    expect(informe.grilla).toEqual({ columnas: 2, filas: 5 });
    expect(informe.piezasPorPliego).toBe(10);
  });

  it('gira el arte 90° en vez de estirarlo dentro de la celda apaisada', async () => {
    const { pdf } = await imponer({ frente: await arteDePrueba({ paginas: 10, pieza: ROTA.pieza }), ...ROTA });
    const ops = operadoresDe(pdf);

    // Una matriz de rotación por pieza: [0 1 −1 0 tx ty].
    const rotaciones = ops.match(/0 1 -1 0 [\d.]+ [\d.]+ cm/g) ?? [];
    expect(rotaciones).toHaveLength(10);

    // Y ninguna matriz de escala que deforme: el arte se dibuja en su
    // proporción natural, no achatado contra la celda.
    const escalas = ops.match(/([\d.]+) 0 0 ([\d.]+) [\d.-]+ [\d.-]+ cm/g) ?? [];
    for (const e of escalas) {
      const [, sx, sy] = /([\d.]+) 0 0 ([\d.]+)/.exec(e);
      if (Number(sx) === 1 && Number(sy) === 1) continue;      // traslaciones puras
      expect(Number(sx)).toBeCloseTo(Number(sy), 3);            // escala uniforme
    }
  });

  it('sin rotación no emite ninguna matriz de giro', async () => {
    const { pdf, informe } = await imponer({
      frente: await arteDePrueba({ paginas: 12 }),
      ...TAROT,
    });
    expect(informe.rotada).toBe(false);
    expect(operadoresDe(pdf).match(/0 1 -1 0 /g)).toBeNull();
  });

  it('gira igual el arte que vino sin demasía, con su espejado', async () => {
    const { pdf, informe } = await imponer({
      frente: await arteDePrueba({ paginas: 10, pieza: ROTA.pieza, conDemasia: false, declararCajas: false }),
      ...ROTA,
    });
    expect(informe.rotada).toBe(true);
    expect(informe.demasiaSintetica).toHaveLength(10);
    // 9 dibujos por pieza (centro + 8 bandas) y una rotación por pieza.
    expect(invocacionesDeXObject(operadoresDe(pdf))).toBe(10 * 9);
    expect(operadoresDe(pdf).match(/0 1 -1 0 [\d.]+ [\d.]+ cm/g)).toHaveLength(10);
  });
});
