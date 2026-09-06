import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { crearApp } from '../../src/api/server.js';

/**
 * Smoke test del widget contra el servicio real, en un navegador real.
 *
 * El widget es una capa fina, pero es la que ve el operador: si cambia la
 * forma del response o se rompe el render, acá salta. Corre aparte de la
 * suite principal (`npm run test:web`) porque necesita Chromium.
 */

const raiz = join(dirname(fileURLToPath(import.meta.url)), '../../web');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

let api;
let estaticos;
let navegador;
let pagina;
let base;

beforeAll(async () => {
  api = crearApp().listen(0);
  await new Promise((r) => api.once('listening', r));
  const puertoApi = api.address().port;

  estaticos = createServer(async (req, res) => {
    const pedido = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
    const archivo = join(raiz, pedido === '/' ? 'demo.html' : pedido);
    if (!archivo.startsWith(raiz)) return res.writeHead(403).end();
    try {
      let cuerpo = await readFile(archivo, 'utf8');
      const ext = archivo.slice(archivo.lastIndexOf('.'));
      // La demo apunta a un puerto fijo; se reescribe al de este test.
      if (ext === '.html') cuerpo = cuerpo.replace(/data-api="[^"]*"/, `data-api="http://127.0.0.1:${puertoApi}"`);
      return res.writeHead(200, { 'content-type': TIPOS[ext] ?? 'text/plain' }).end(cuerpo);
    } catch {
      return res.writeHead(404).end();
    }
  }).listen(0);
  await new Promise((r) => estaticos.once('listening', r));
  base = `http://127.0.0.1:${estaticos.address().port}`;

  // Sin CHROMIUM_PATH usa el Chromium que instaló Playwright (el caso de CI).
  navegador = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  pagina = await navegador.newPage({ viewport: { width: 1440, height: 1200 } });
}, 60000);

afterAll(async () => {
  await navegador?.close();
  await new Promise((r) => estaticos.close(r));
  await new Promise((r) => api.close(r));
});

/** Carga la demo desde cero, sin estado guardado. */
async function abrir() {
  await pagina.goto(`${base}/demo.html`, { waitUntil: 'domcontentloaded' });
  await pagina.evaluate(() => localStorage.clear());
  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await pagina.waitForSelector('.io-pc-box', { timeout: 15000 });
}

/** Las filas del resultado, como { etiqueta: valor }. */
const filas = () => pagina.evaluate(() => {
  const r = {};
  document.querySelectorAll('.io-pc-kv .row').forEach((fila) => {
    r[fila.querySelector('.k').textContent.trim()] = fila.querySelector('.v').textContent.trim();
  });
  return r;
});

/** Cambia un campo y espera a que el widget termine de recalcular. */
async function escribir(nombre, valor) {
  await pagina.fill(`[name="${nombre}"]`, valor);
  await pagina.waitForTimeout(700);
}

describe('widget contra el servicio', () => {
  it('resuelve la pose de tarot doble faz al cargar', async () => {
    await abrir();
    const r = await filas();
    expect(r['Entran por pliego']).toBe('12 (4 × 3)');
    expect(r['Orientación']).toBe('Normal');
    expect(r['Marcas de corte']).toBe('28');
    expect(r['Impresiones totales']).toBe('18');
  });

  it('dibuja las dos caras con las marcas de corte', async () => {
    await abrir();
    const svg = await pagina.evaluate(() => ({
      caras: document.querySelectorAll('.io-pc-cara svg').length,
      lineas: document.querySelectorAll('.io-pc-cara svg line').length,
      titulos: [...document.querySelectorAll('.io-pc-cara p')].map((p) => p.textContent),
    }));
    expect(svg.caras).toBe(2);
    expect(svg.titulos).toEqual(['Frente', 'Dorso']);
    expect(svg.lineas).toBe(56); // 28 marcas por cara
  });

  it('el dorso sale espejado respecto del frente', async () => {
    await abrir();

    // Se leen en orden VISUAL (arriba→abajo, izquierda→derecha), no en orden
    // del DOM: el espejado del dorso está en las coordenadas, no en el orden
    // de los elementos, que siempre va por índice de carta.
    const orden = await pagina.evaluate(() =>
      [...document.querySelectorAll('.io-pc-cara')].map((cara) =>
        [...cara.querySelectorAll('svg #numeracion text')]
          .map((t) => ({ x: +t.getAttribute('x'), y: +t.getAttribute('y'), n: t.textContent }))
          .sort((a, b) => a.y - b.y || a.x - b.x)
          .map((t) => t.n)
          .join(' ')));

    expect(orden[0]).toBe('1 2 3 4 5 6 7 8 9 10 11 12');
    expect(orden[1]).toBe('4 3 2 1 8 7 6 5 12 11 10 9');
  });

  it('la caja de resultados no desborda su columna', async () => {
    await abrir();
    const box = await pagina.evaluate(() => {
      const b = document.querySelector('.io-pc-box');
      return { scroll: b.scrollWidth, visible: b.clientWidth };
    });
    expect(box.scroll).toBeLessThanOrEqual(box.visible + 1);
  });

  it('editar el pliego a mano actualiza la etiqueta y pasa el select a personalizado', async () => {
    await abrir();
    await escribir('sheetW', '40');
    expect((await filas())['Medida pliego']).toMatch(/40,00 × 47,00 cm \(personalizado\)/);
    expect(await pagina.inputValue('[name="paperSize"]')).toBe('custom');
  });

  it('elegir un formato del select completa las medidas', async () => {
    await abrir();
    await pagina.selectOption('[name="paperSize"]', '29.7x42');
    await pagina.waitForTimeout(700);
    expect(await pagina.inputValue('[name="sheetW"]')).toBe('29.7');
    expect((await filas())['Medida pliego']).toBe('29.7 × 42 cm');
  });

  it('muestra el error del servicio cuando la pieza no entra', async () => {
    await abrir();
    await escribir('itemW', '90');
    expect(await pagina.textContent('.io-pc-err')).toMatch(/no entra en un pliego/);
  });

  it('avisa cuando las medidas no son números', async () => {
    await abrir();
    await escribir('sheetW', 'ancho');
    expect(await pagina.textContent('.io-pc-err')).toMatch(/números válidos/);
  });

  it('pasa a una sola cara al desmarcar doble faz', async () => {
    await abrir();
    await pagina.uncheck('[name="doubleFace"]');
    await pagina.waitForTimeout(700);
    const r = await filas();
    expect(r['Impresiones totales']).toBe('9');
    expect(await pagina.evaluate(() => document.querySelectorAll('.io-pc-cara').length)).toBe(1);
  });

  it('guarda el estado y lo recupera al recargar', async () => {
    await abrir();
    await escribir('qty', '250');
    await pagina.reload({ waitUntil: 'domcontentloaded' });
    await pagina.waitForSelector('.io-pc-box', { timeout: 15000 });
    expect(await pagina.inputValue('[name="qty"]')).toBe('250');
  });

  it('los campos opcionales vacíos valen cero, no rompen el cálculo', async () => {
    await abrir();
    await escribir('costPaper', '');
    const r = await filas();
    expect(await pagina.$('.io-pc-err')).toBeNull();
    expect(r['Costo total (base)']).toBeTruthy();
  });

  it('no deja errores en la consola del navegador', async () => {
    const errores = [];
    pagina.on('pageerror', (e) => errores.push(e.message));
    await abrir();
    await escribir('itemH', '10');
    expect(errores).toEqual([]);
  });
});

describe('respaldo local cuando el servicio no responde', () => {
  /** Corta la conexión al servicio interceptando la request en el navegador. */
  async function cortarServicio() {
    await pagina.route('**/api/calcular/compat', (ruta) => ruta.abort('failed'));
  }

  async function restablecerServicio() {
    await pagina.unroute('**/api/calcular/compat');
  }

  afterEach(async () => {
    await restablecerServicio();
  });

  it('sigue cotizando con el bundle local y avisa que fue sin conexión', async () => {
    await abrir();
    const conServicio = await filas();

    await cortarServicio();
    await escribir('qty', '79');
    await escribir('qty', '78');

    expect(await pagina.$('.io-pc-offline')).not.toBeNull();
    expect(await pagina.textContent('.io-pc-offline')).toMatch(/Sin conexión al servicio/);

    const sinServicio = await filas();
    expect(sinServicio).toEqual(conServicio);
  });

  it('el respaldo dibuja la pose igual que el servicio', async () => {
    await abrir();
    const conServicio = await pagina.evaluate(() =>
      [...document.querySelectorAll('.io-pc-cara svg')].map((s) => s.outerHTML));

    await cortarServicio();
    await escribir('qty', '79');

    const sinServicio = await pagina.evaluate(() =>
      [...document.querySelectorAll('.io-pc-cara svg')].map((s) => s.outerHTML));
    expect(sinServicio).toEqual(conServicio);
  });

  it('los errores de negocio del servicio no disparan el respaldo', async () => {
    await abrir();
    await escribir('itemW', '90');
    expect(await pagina.textContent('.io-pc-err')).toMatch(/no entra en un pliego/);
    expect(await pagina.$('.io-pc-offline')).toBeNull();
  });

  it('sin servicio y sin bundle, avisa en vez de mentir un precio', async () => {
    await abrir();
    // `delete` no borra un global declarado con var (el bundle es un IIFE),
    // así que se anula el valor, que es lo que el widget chequea.
    await pagina.evaluate(() => { window.IOPose = undefined; });
    await cortarServicio();
    await escribir('qty', '77');

    expect(await pagina.textContent('.io-pc-err')).toMatch(/No se pudo conectar/);
    expect(await pagina.$('.io-pc-box')).toBeNull();
  });

  it('vuelve al servicio en cuanto responde de nuevo', async () => {
    await abrir();
    await cortarServicio();
    await escribir('qty', '79');
    expect(await pagina.$('.io-pc-offline')).not.toBeNull();

    await restablecerServicio();
    await escribir('qty', '78');
    expect(await pagina.$('.io-pc-offline')).toBeNull();
  });
});
