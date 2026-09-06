import { describe, expect, it } from 'vitest';
import { calcularPose } from '../../src/nesting/pose.js';
import { calcularPoseDobleFaz } from '../../src/nesting/dobleFaz.js';
import { generarSVG, generarSVGDobleFaz } from '../../src/nesting/svg.js';

const TAROT = {
  pliego: { ancho: 320, alto: 470 },
  pieza: { ancho: 70, alto: 120 },
  sangrado: 3,
  espaciado: 0,
  margenMinimo: 10,
};

const contar = (svg, regex) => (svg.match(regex) ?? []).length;

describe('render SVG', () => {
  const pose = calcularPose(TAROT);

  it('sale a escala real en milímetros', () => {
    const svg = generarSVG(pose);
    expect(svg).toContain('width="320mm"');
    expect(svg).toContain('height="470mm"');
    expect(svg).toContain('viewBox="0 0 320 470"');
  });

  it('preview: piezas rellenas, márgenes punteados y sólo el total como texto', () => {
    const svg = generarSVG(pose, { modo: 'preview' });
    expect(svg).toContain('stroke-dasharray');
    expect(svg).toContain('#2e509e');
    expect(svg).toContain('#FF6B00');
    expect(contar(svg, /<text/g)).toBe(1);
    expect(svg).toContain('>12</text>');
  });

  it('producción: sin márgenes punteados, sin texto, marcas en negro de registro', () => {
    const svg = generarSVG(pose, { modo: 'produccion' });
    expect(svg).not.toContain('stroke-dasharray');
    expect(contar(svg, /<text/g)).toBe(0);
    expect(svg).not.toContain('#FF6B00');
    expect(svg).toContain('#000000');
  });

  it('dibuja las 28 marcas de corte', () => {
    const svg = generarSVG(pose, { modo: 'produccion' });
    expect(contar(svg, /<line /g)).toBe(28);
  });

  it('usa trazo fino de 0.25 pt para las marcas', () => {
    const svg = generarSVG(pose, { modo: 'produccion' });
    expect(svg).toContain('stroke-width="0.0882"');
  });

  it('numera las piezas sólo si se lo piden', () => {
    expect(contar(generarSVG(pose, { modo: 'produccion' }), /<text/g)).toBe(0);
    expect(contar(generarSVG(pose, { modo: 'produccion', numerarPiezas: true }), /<text/g)).toBe(12);
  });

  it('rechaza un modo desconocido', () => {
    expect(() => generarSVG(pose, { modo: 'borrador' })).toThrow(/Modo "borrador"/);
  });
});

describe('render SVG de una pose doble faz', () => {
  const pose = calcularPoseDobleFaz(TAROT);

  it('genera las dos caras', () => {
    const { frente, dorso } = generarSVGDobleFaz(pose);
    expect(frente).toContain('viewBox="0 0 320 470"');
    expect(dorso).toContain('viewBox="0 0 320 470"');
    expect(frente).not.toBe(dorso);
  });

  it('etiqueta la cara en el preview', () => {
    const { frente, dorso } = generarSVGDobleFaz(pose, { modo: 'preview' });
    expect(frente).toContain('12 — frente');
    expect(dorso).toContain('12 — dorso');
  });

  it('las dos caras llevan las mismas marcas de corte (registran)', () => {
    const { frente, dorso } = generarSVGDobleFaz(pose, { modo: 'produccion' });
    const lineas = (svg) => (svg.match(/<line [^>]*\/>/g) ?? []).sort();
    expect(lineas(dorso)).toEqual(lineas(frente));
  });

  it('la numeración del dorso arranca por la derecha', () => {
    const { dorso } = generarSVGDobleFaz(pose, { modo: 'produccion', numerarPiezas: true });
    const primerTexto = dorso.match(/<text x="([\d.]+)"[^>]*>1<\/text>/);
    expect(Number(primerTexto[1])).toBeCloseTo(239 + 35, 4);
  });

  it('rechaza generar doble faz sobre una pose simple', () => {
    expect(() => generarSVGDobleFaz(calcularPose(TAROT))).toThrow(/no es doble faz/);
  });
});
