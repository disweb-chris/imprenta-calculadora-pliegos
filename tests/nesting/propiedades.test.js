import { describe, expect, it } from 'vitest';
import { calcularPose } from '../../src/nesting/pose.js';
import { calcularPoseDobleFaz } from '../../src/nesting/dobleFaz.js';
import { generarSVG } from '../../src/nesting/svg.js';
import { MARCAS } from '../../src/config/defaults.js';

/**
 * Tests de propiedades sobre medidas arbitrarias.
 *
 * La pose de tarot es una referencia, no el caso general: en producción el
 * pliego y la pieza cambian en cada trabajo. Estos tests no verifican números
 * concretos sino los invariantes que tienen que valer SIEMPRE, sobre un
 * barrido determinista de miles de combinaciones.
 *
 * Los chequeos acumulan fallas y afirman una sola vez al final: llamar a
 * `expect` cientos de miles de veces domina el tiempo de la suite.
 */

/** PRNG determinista, para que un fallo se pueda reproducir. */
function generador(semilla) {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado * 1664525 + 1013904223) >>> 0;
    return estado / 0x100000000;
  };
}

function medidas(cantidad, semilla) {
  const azar = generador(semilla);
  const entre = (min, max) => Math.round(min + azar() * (max - min));
  const casos = [];
  for (let i = 0; i < cantidad; i += 1) {
    casos.push({
      pliego: { ancho: entre(100, 1200), alto: entre(100, 1200) },
      pieza: { ancho: entre(10, 300), alto: entre(10, 300) },
      sangrado: [0, 1, 2, 3, 5][entre(0, 4)],
      espaciado: [0, 1, 2, 3, 6, 10][entre(0, 5)],
      permitirRotacion: azar() > 0.2,
    });
  }
  return casos;
}

const CASOS = medidas(4000, 20260906);

/** Poses armadas una sola vez y compartidas por todos los tests. */
const POSES = [];
const RECHAZOS = [];
for (const params of CASOS) {
  try {
    POSES.push({ params, pose: calcularPose(params) });
  } catch (e) {
    RECHAZOS.push({ params, error: e });
  }
}

/**
 * Recorre las poses acumulando fallas. `revisar` devuelve un mensaje cuando
 * algo no se cumple, o nada cuando está bien.
 */
function revisarTodas(revisar, poses = POSES) {
  const fallas = [];
  for (const { params, pose } of poses) {
    const problema = revisar(pose, params);
    if (problema) fallas.push(`${problema} — ${JSON.stringify(params)}`);
    if (fallas.length >= 5) break;
  }
  return fallas;
}

const CERCA = 1e-9;

describe('invariantes de la pose sobre medidas arbitrarias', () => {
  it('el barrido arma una cantidad significativa de poses', () => {
    expect(POSES.length).toBeGreaterThan(3000);
    // Todo rechazo tiene que ser un error de negocio, nunca un crash.
    expect(RECHAZOS.every((r) => r.error.esErrorDePose)).toBe(true);
  });

  it('toda pose que se arma es cortable: las marcas siempre entran', () => {
    expect(revisarTodas((pose) => {
      const m = pose.bloque.margenSangrado;
      for (const lado of ['izquierdo', 'derecho', 'superior', 'inferior']) {
        if (m[lado] < MARCAS.largo) return `margen ${lado} de ${m[lado]} mm < ${MARCAS.largo} mm`;
      }
      if (pose.advertencias.length) return `advertencia: ${pose.advertencias[0]}`;
      return null;
    })).toEqual([]);
  });

  it('los ticks caen dentro del pliego y nunca pisan el arte', () => {
    expect(revisarTodas((pose) => {
      const m = pose.bloque.margenSangrado;
      for (const t of pose.ticks) {
        if (Math.min(t.x1, t.x2) < 0 || Math.min(t.y1, t.y2) < 0) return 'tick fuera del pliego (negativo)';
        if (Math.max(t.x1, t.x2) > pose.pliego.ancho || Math.max(t.y1, t.y2) > pose.pliego.alto) {
          return 'tick fuera del pliego (excede)';
        }
        const fuera = t.orientacion === 'vertical'
          ? Math.max(t.y1, t.y2) <= m.superior + CERCA || Math.min(t.y1, t.y2) >= pose.pliego.alto - m.inferior - CERCA
          : Math.max(t.x1, t.x2) <= m.izquierdo + CERCA || Math.min(t.x1, t.x2) >= pose.pliego.ancho - m.derecho - CERCA;
        if (!fuera) return `tick ${t.orientacion}/${t.borde} pisa el arte`;
      }
      return null;
    })).toEqual([]);
  });

  it('hay exactamente dos líneas de trim por columna y por fila', () => {
    expect(revisarTodas((pose) => {
      if (pose.marcasCorte.verticales.length !== pose.columnas * 2) return 'faltan líneas verticales';
      if (pose.marcasCorte.horizontales.length !== pose.filas * 2) return 'faltan líneas horizontales';
      if (pose.totalMarcas !== (pose.columnas + pose.filas) * 4) return 'total de marcas inconsistente';
      if (pose.ticks.length !== pose.totalMarcas) return 'ticks ≠ total de marcas';
      return null;
    })).toEqual([]);
  });

  it('las líneas de trim salen ordenadas y alternan ancho de pieza y calle', () => {
    expect(revisarTodas((pose) => {
      const calle = pose.parametros.calle;
      for (const eje of ['verticales', 'horizontales']) {
        const lineas = pose.marcasCorte[eje];
        const lado = eje === 'verticales' ? pose.piezaEfectiva.ancho : pose.piezaEfectiva.alto;
        for (let i = 0; i + 1 < lineas.length; i += 1) {
          const salto = lineas[i + 1] - lineas[i];
          const esperado = i % 2 === 0 ? lado : calle;
          if (Math.abs(salto - esperado) > 1e-6) return `salto ${salto} ≠ ${esperado} en ${eje}[${i}]`;
        }
      }
      return null;
    })).toEqual([]);
  });

  it('las piezas entran enteras en el pliego con su sangrado', () => {
    expect(revisarTodas((pose) => {
      if (pose.posiciones.length !== pose.cantidad) return 'posiciones ≠ cantidad';
      for (const p of pose.posiciones) {
        const c = p.sangradoCaja;
        if (c.x < -CERCA || c.y < -CERCA) return 'pieza fuera del pliego (negativo)';
        if (c.x + c.ancho > pose.pliego.ancho + CERCA) return 'pieza excede el ancho';
        if (c.y + c.alto > pose.pliego.alto + CERCA) return 'pieza excede el alto';
      }
      return null;
    })).toEqual([]);
  });

  it('ninguna caja de sangrado se superpone con la de al lado', () => {
    // Basta comparar con el vecino de la derecha y el de abajo: la grilla es
    // regular, así que si esos dos no se pisan, ningún par se pisa.
    expect(revisarTodas((pose) => {
      const { columnas } = pose;
      for (const p of pose.posiciones) {
        const a = p.sangradoCaja;
        if (p.columna + 1 < columnas) {
          const b = pose.posiciones[p.indice + 1].sangradoCaja;
          if (a.x + a.ancho > b.x + CERCA) return 'se pisan en horizontal';
        }
        if (p.fila + 1 < pose.filas) {
          const b = pose.posiciones[p.indice + columnas].sangradoCaja;
          if (a.y + a.alto > b.y + CERCA) return 'se pisan en vertical';
        }
      }
      return null;
    })).toEqual([]);
  });

  it('el bloque queda centrado y el aprovechamiento entre 0 y 1', () => {
    expect(revisarTodas((pose) => {
      const m = pose.bloque.margenSangrado;
      if (Math.abs(m.izquierdo - m.derecho) > 1e-6) return 'no está centrado en horizontal';
      if (Math.abs(m.superior - m.inferior) > 1e-6) return 'no está centrado en vertical';
      if (Math.abs(m.izquierdo * 2 + pose.bloque.tinta.ancho - pose.pliego.ancho) > 1e-6) return 'la tinta no cierra con el pliego';
      if (!(pose.aprovechamiento > 0 && pose.aprovechamiento <= 1)) return `aprovechamiento ${pose.aprovechamiento}`;
      return null;
    })).toEqual([]);
  });

  it('el margen de trim siempre supera al de tinta exactamente por el sangrado', () => {
    expect(revisarTodas((pose) => {
      const s = pose.parametros.sangrado;
      const b = pose.bloque;
      if (Math.abs(b.margenIzquierdo - b.margenSangrado.izquierdo - s) > 1e-6) return 'margen de trim inconsistente';
      return null;
    })).toEqual([]);
  });

  it('la rotación nunca empeora el resultado', () => {
    expect(revisarTodas((pose, params) => {
      if (!params.permitirRotacion) return null;
      let sinRotar;
      try {
        sinRotar = calcularPose({ ...params, permitirRotacion: false });
      } catch {
        return null; // la pieza sólo entra girada: rotar la salvó
      }
      return pose.cantidad >= sinRotar.cantidad ? null : `rotando entran menos: ${pose.cantidad} < ${sinRotar.cantidad}`;
    })).toEqual([]);
  });
});

describe('invariantes de la pose doble faz sobre medidas arbitrarias', () => {
  it('el dorso siempre registra con el frente, en los dos ejes de volteo', () => {
    const fallas = [];
    let armadas = 0;

    for (const { params } of POSES.slice(0, 1500)) {
      for (const ejeVolteo of ['vertical', 'horizontal']) {
        const pose = calcularPoseDobleFaz({ ...params, ejeVolteo });
        armadas += 1;
        if (!pose.registro.registra || Math.abs(pose.registro.desvioMaximo_mm) > 1e-6) {
          fallas.push(`desvío ${pose.registro.desvioMaximo_mm} — ${JSON.stringify({ ...params, ejeVolteo })}`);
        }
        if (fallas.length >= 5) break;
      }
    }

    expect(fallas).toEqual([]);
    expect(armadas).toBe(3000);
  });

  it('el mapeo frente↔dorso es siempre una biyección sobre la grilla', () => {
    const fallas = [];

    for (const { params } of POSES.slice(0, 800)) {
      const pose = calcularPoseDobleFaz(params);
      const etiqueta = JSON.stringify(params);

      const celdas = new Set(pose.mapeo.map((m) => `${m.dorso.fila},${m.dorso.columna}`));
      if (celdas.size !== pose.cantidad) fallas.push(`celdas repetidas en el dorso — ${etiqueta}`);
      if (new Set(pose.dorso.orden).size !== pose.cantidad) fallas.push(`orden del dorso repetido — ${etiqueta}`);

      const desalineada = pose.frente.posiciones.some((p, i) => pose.dorso.posiciones[i].indice !== p.indice);
      if (desalineada) fallas.push(`frente y dorso no comparten índice — ${etiqueta}`);

      if (fallas.length >= 5) break;
    }

    expect(fallas).toEqual([]);
  });
});

describe('el SVG sale bien formado sobre medidas arbitrarias', () => {
  it('siempre abre y cierra, sin NaN, con un tick por marca', () => {
    expect(revisarTodas((pose) => {
      for (const modo of ['preview', 'produccion']) {
        const svg = generarSVG(pose, { modo });
        if (!svg.startsWith('<svg')) return `${modo}: no abre con <svg`;
        if (!svg.trimEnd().endsWith('</svg>')) return `${modo}: no cierra`;
        if (svg.includes('NaN') || svg.includes('undefined')) return `${modo}: tiene NaN o undefined`;
        const lineas = (svg.match(/<line /g) ?? []).length;
        if (lineas !== pose.totalMarcas) return `${modo}: ${lineas} líneas ≠ ${pose.totalMarcas} marcas`;
      }
      return null;
    }, POSES.slice(0, 400))).toEqual([]);
  });
});
