import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { crearApp } from '../src/api/server.js';

let servidor;
let base;

beforeAll(async () => {
  servidor = crearApp().listen(0);
  await new Promise((resolve) => servidor.once('listening', resolve));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

afterAll(() => new Promise((resolve) => servidor.close(resolve)));

const postJSON = (ruta, body) =>
  fetch(`${base}${ruta}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const TAROT = {
  pliego: { ancho: 320, alto: 470 },
  pieza: { ancho: 70, alto: 120 },
  sangrado: 3,
  espaciado: 0,
  margenMinimo: 10,
};

describe('API', () => {
  it('GET /health responde ok', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ estado: 'ok' });
  });

  it('GET /api/materiales devuelve el catálogo', async () => {
    const res = await fetch(`${base}/api/materiales`);
    const cuerpo = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(cuerpo.materiales)).toBe(true);
  });

  it('GET /api/materiales/:id devuelve 404 si no existe', async () => {
    expect((await fetch(`${base}/api/materiales/nada`)).status).toBe(404);
  });

  it('POST /api/nesting/calcular resuelve la pose de referencia', async () => {
    const res = await postJSON('/api/nesting/calcular', TAROT);
    const pose = await res.json();
    expect(res.status).toBe(200);
    expect(pose.cantidad).toBe(12);
    expect(pose.totalMarcas).toBe(28);
  });

  it('POST /api/nesting/calcular acepta un material del catálogo', async () => {
    const res = await postJSON('/api/nesting/calcular', {
      material: 'vinilo-mate',
      pieza: { ancho: 60, alto: 60 },
    });
    expect((await res.json()).cantidad).toBe(169);
  });

  it('POST /api/nesting/doble-faz devuelve las dos caras y el mapeo', async () => {
    const pose = await (await postJSON('/api/nesting/doble-faz', TAROT)).json();
    expect(pose.dobleFaz).toBe(true);
    expect(pose.frente.posiciones).toHaveLength(12);
    expect(pose.dorso.posiciones).toHaveLength(12);
    expect(pose.mapeo).toHaveLength(12);
    expect(pose.registro.registra).toBe(true);
  });

  it('POST /api/nesting/preview.svg devuelve SVG', async () => {
    const res = await postJSON('/api/nesting/preview.svg', TAROT);
    expect(res.headers.get('content-type')).toContain('image/svg+xml');
    expect(await res.text()).toContain('<svg');
  });

  it('POST /api/nesting/doble-faz/preview.svg devuelve la cara pedida', async () => {
    const frente = await (await postJSON('/api/nesting/doble-faz/preview.svg?cara=frente', TAROT)).text();
    const dorso = await (await postJSON('/api/nesting/doble-faz/preview.svg?cara=dorso', TAROT)).text();
    expect(frente).toContain('12 — frente');
    expect(dorso).toContain('12 — dorso');
  });

  it('devuelve 400 con mensaje en español ante una pieza más grande que el pliego', async () => {
    const res = await postJSON('/api/nesting/calcular', { pliego: { ancho: 100, alto: 100 }, pieza: { ancho: 500, alto: 500 } });
    expect(res.status).toBe(400);
    const cuerpo = await res.json();
    expect(cuerpo.error).toMatch(/no entra en un pliego/);
    expect(cuerpo.campo).toBe('pieza');
  });

  it('devuelve 400 ante un material inexistente y ante una cara inválida', async () => {
    expect((await postJSON('/api/nesting/calcular', { material: 'nada', pieza: { ancho: 10, alto: 10 } })).status).toBe(400);
    expect((await postJSON('/api/nesting/doble-faz/preview.svg?cara=canto', TAROT)).status).toBe(400);
  });

  it('devuelve 404 en una ruta desconocida', async () => {
    expect((await fetch(`${base}/api/nada`)).status).toBe(404);
  });
});
