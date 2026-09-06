import express from 'express';
import { rutasNesting } from './routes/nesting.js';
import { rutasMateriales } from './routes/materiales.js';
import { rutasTrabajo } from './routes/trabajo.js';
import { logger } from '../utils/logger.js';

export function crearApp() {
  const app = express();
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
