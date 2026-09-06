import express from 'express';
import { rutasNesting } from './routes/nesting.js';
import { rutasMateriales } from './routes/materiales.js';
import { rutasTrabajo } from './routes/trabajo.js';
import { logger } from '../utils/logger.js';

/**
 * CORS. El widget del sitio corre en imprentaonline.ar y consume este
 * servicio desde el navegador, así que necesita el preflight resuelto.
 * `CORS_ORIGENES` es una lista separada por comas; sin configurar, permite
 * cualquier origen (el servicio no expone datos privados ni usa cookies).
 */
function cors(req, res, next) {
  const permitidos = (process.env.CORS_ORIGENES ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  const origen = req.headers.origin;

  if (permitidos.length === 0) res.setHeader('Access-Control-Allow-Origin', '*');
  else if (origen && permitidos.includes(origen)) {
    res.setHeader('Access-Control-Allow-Origin', origen);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') return res.status(204).end();
  return next();
}

export function crearApp() {
  const app = express();
  app.use(cors);
  app.use(express.json({ limit: '256kb' }));

  app.get('/health', (_req, res) => res.json({ estado: 'ok', servicio: 'io-calculadora-pliegos' }));

  app.use('/api', rutasTrabajo);
  app.use('/api/nesting', rutasNesting);
  app.use('/api/materiales', rutasMateriales);

  app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

  // Manejador de errores: los de negocio salen 400 con mensaje en español.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err?.esErrorDePose) {
      return res.status(400).json({ error: err.message, campo: err.campo });
    }
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'El body no es JSON válido.' });
    }
    logger.error('Error no controlado', { mensaje: err?.message, stack: err?.stack });
    return res.status(500).json({ error: 'Error interno del servicio.' });
  });

  return app;
}

// Arranque sólo cuando se ejecuta directamente (no al importarlo desde tests).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const puerto = Number(process.env.PORT) || 8080;
  crearApp().listen(puerto, () => logger.info('Servicio escuchando', { puerto }));
}
