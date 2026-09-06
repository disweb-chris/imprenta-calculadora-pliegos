import { Router } from 'express';
import { calcularDesdeElSitio, resolverTrabajo } from '../../core/compat.js';

export const rutasTrabajo = Router();

/** Contrato nativo: todo en milímetros, nombres en español. */
rutasTrabajo.post('/calcular', (req, res) => {
  res.json(resolverTrabajo(req.body ?? {}));
});

/**
 * Contrato compatible con la calculadora que está hoy en el sitio: mismos
 * nombres de campo y mismas unidades que el formulario.
 */
rutasTrabajo.post('/calcular/compat', (req, res) => {
  res.json(calcularDesdeElSitio(req.body ?? {}));
});
