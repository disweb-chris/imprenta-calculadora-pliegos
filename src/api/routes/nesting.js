import { Router } from 'express';
import { calcularPose } from '../../nesting/pose.js';
import { calcularPoseDobleFaz } from '../../nesting/dobleFaz.js';
import { generarSVG } from '../../nesting/svg.js';
import { parametrosDePose } from '../../core/materiales.js';
import { ErrorDePose } from '../../nesting/validacion.js';

export const rutasNesting = Router();

/**
 * Si el body trae `material`, se usa su perfil calibrado como base y lo que
 * venga explícito en el body lo sobrescribe.
 */
function resolverEntrada(body = {}) {
  const { material, ...resto } = body;
  if (!material) return resto;

  const base = parametrosDePose(material);
  if (!base) {
    throw new ErrorDePose(`No existe el material "${material}" en el catálogo.`, 'material');
  }
  return { ...base, ...resto };
}

rutasNesting.post('/calcular', (req, res) => {
  res.json(calcularPose(resolverEntrada(req.body)));
});

rutasNesting.post('/doble-faz', (req, res) => {
  res.json(calcularPoseDobleFaz(resolverEntrada(req.body)));
});

rutasNesting.post('/preview.svg', (req, res) => {
  const { modo = 'preview', numerarPiezas = false, ...entrada } = resolverEntrada(req.body);
  const pose = calcularPose(entrada);
  res.type('image/svg+xml').send(generarSVG(pose, { modo, numerarPiezas }));
});

rutasNesting.post('/doble-faz/preview.svg', (req, res) => {
  const { modo = 'preview', numerarPiezas = false, cara, ...entrada } = resolverEntrada(req.body);
  const caraPedida = cara ?? req.query.cara ?? 'frente';
  if (caraPedida !== 'frente' && caraPedida !== 'dorso') {
    throw new ErrorDePose(`"cara" tiene que ser "frente" o "dorso". Recibido: "${caraPedida}".`, 'cara');
  }
  const pose = calcularPoseDobleFaz(entrada);
  res.type('image/svg+xml').send(generarSVG(pose, { modo, cara: caraPedida, numerarPiezas }));
});
