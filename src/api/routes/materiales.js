import { Router } from 'express';
import { listarMateriales, obtenerMaterial } from '../../core/materiales.js';

export const rutasMateriales = Router();

rutasMateriales.get('/', (_req, res) => {
  res.json({ materiales: listarMateriales() });
});

rutasMateriales.get('/:id', (req, res) => {
  const material = obtenerMaterial(req.params.id);
  if (!material) {
    return res.status(404).json({ error: `No existe el material "${req.params.id}".` });
  }
  return res.json(material);
});
