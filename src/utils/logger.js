/**
 * Logger mínimo en JSON lines, pensado para que Cloud Logging lo parsee solo.
 * Sin dependencias: este servicio tiene que arrancar rápido en Cloud Run.
 */

const NIVELES = { debug: 10, info: 20, warn: 30, error: 40 };
const nivelActual = NIVELES[process.env.LOG_LEVEL ?? 'info'] ?? NIVELES.info;

function emitir(nivel, mensaje, datos) {
  if (NIVELES[nivel] < nivelActual) return;
  const linea = JSON.stringify({
    severity: nivel.toUpperCase(),
    time: new Date().toISOString(),
    message: mensaje,
    ...(datos ? { datos } : {}),
  });
  if (nivel === 'error' || nivel === 'warn') process.stderr.write(`${linea}\n`);
  else process.stdout.write(`${linea}\n`);
}

export const logger = {
  debug: (mensaje, datos) => emitir('debug', mensaje, datos),
  info: (mensaje, datos) => emitir('info', mensaje, datos),
  warn: (mensaje, datos) => emitir('warn', mensaje, datos),
  error: (mensaje, datos) => emitir('error', mensaje, datos),
};
