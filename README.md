# io-calculadora-pliegos

Microservicio de **cálculo de pliegos y armado de pose** de
[Imprenta Online](https://imprentaonline.ar) (Villa Devoto, CABA).

Responde dos preguntas del taller:

1. **¿Cuántas piezas entran en un pliego y cómo se acomodan?** — armado de pose
   (nesting 2D) con marcas de corte para guillotina, incluido el caso
   **doble faz** (frente y dorso registrados).
2. **¿Cuántos pliegos hace falta comprar para una tirada?** — cálculo de
   pliegos, demasía y pasadas de máquina.

Corre en Cloud Run y lo consumen el sitio y (a futuro) el bot de WhatsApp.

---

## Arquitectura

```
src/
├── core/            # lógica de negocio pura
│   ├── materiales.js   catálogo: geometría + perfil de pose por material
│   ├── pliegos.js      pliegos necesarios para una tirada
│   └── precios.js      escalas por cantidad y cotización
├── nesting/         # armado de pose
│   ├── shelf.js        estrategia de grilla regular
│   ├── layout.js       posiciones, líneas de trim y ticks de guillotina
│   ├── pose.js         orquestador de una cara + registro de estrategias
│   ├── dobleFaz.js     frente y dorso espejados y registrados
│   ├── svg.js          render del layout a SVG
│   └── validacion.js   validación de entrada, errores en español
├── api/
│   ├── server.js       Express
│   └── routes/
├── config/
│   └── defaults.js     márgenes, sangrado y perfiles calibrados
└── utils/logger.js     logger JSON lines para Cloud Logging
```

**Regla arquitectónica:** `src/core/` y `src/nesting/` son **funciones puras**
— sin `req`/`res`, sin HTTP, sin estado global. Entran objetos planos y salen
objetos planos. Se testean sin levantar el servidor y se reusan tal cual desde
otros clientes.

---

## Correr local

```bash
npm install
npm run dev          # http://localhost:8080, con --watch
npm start            # sin watch
```

```bash
curl -s localhost:8080/api/nesting/calcular \
  -H 'content-type: application/json' \
  -d '{"pliego":{"ancho":320,"alto":470},"pieza":{"ancho":70,"alto":120},"sangrado":3,"margenMinimo":10}' \
  | jq '{cantidad, columnas, filas, marcasCorte}'
```

```json
{
  "cantidad": 12,
  "columnas": 4,
  "filas": 3,
  "marcasCorte": {
    "verticales": [11, 81, 87, 157, 163, 233, 239, 309],
    "horizontales": [49, 169, 175, 295, 301, 421]
  }
}
```

Preview del layout como SVG:

```bash
curl -s localhost:8080/api/nesting/doble-faz/preview.svg?cara=dorso \
  -H 'content-type: application/json' \
  -d '{"pliego":{"ancho":320,"alto":470},"pieza":{"ancho":70,"alto":120},"sangrado":3,"margenMinimo":10}' \
  > dorso.svg
```

---

## Tests

```bash
npm test              # una corrida
npm run test:watch
npm run test:coverage
```

La suite incluye la **pose de referencia de producción** (mazo de tarot,
320 × 470, 12 cartas) verificada coordenada por coordenada contra las marcas
medidas en el pliego real, con tolerancia de ±0.5 mm.

---

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/health` | Healthcheck de Cloud Run |
| `GET` | `/api/materiales` | Catálogo con geometría y perfil de pose |
| `GET` | `/api/materiales/:id` | Un material |
| `POST` | `/api/nesting/calcular` | Pose de una cara: cantidad + layout + marcas |
| `POST` | `/api/nesting/doble-faz` | Pose doble faz: frente, dorso y mapeo |
| `POST` | `/api/nesting/preview.svg` | SVG del layout |
| `POST` | `/api/nesting/doble-faz/preview.svg` | SVG de una cara (`?cara=frente\|dorso`) |

Contrato completo con requests y responses de ejemplo: **[docs/API.md](docs/API.md)**.
Cómo funciona el algoritmo y cómo se calibró: **[docs/NESTING.md](docs/NESTING.md)**.

---

## Doble faz en dos líneas

Cuando el pliego se da vuelta para la segunda pasada, la geometría se espeja:
lo que estaba en la columna 0 aparece en la última. Por eso el dorso se calcula
espejado sobre el eje de volteo, y `frente.posiciones[i]` y `dorso.posiciones[i]`
son siempre la misma carta.

```
frente:  1  2  3  4        dorso:   4  3  2  1
         5  6  7  8                 8  7  6  5
         9 10 11 12                12 11 10  9
```

Como el bloque va centrado, los márgenes son simétricos y las marcas de corte
de las dos caras coinciden (`registro.registra === true`): se corta el mazo
entero con una sola tirada de guillotina.

---

## Deploy

Push a `main` dispara `.github/workflows/deploy.yml`, que corre los tests y
despliega a Cloud Run con `--timeout 3600`.

A mano:

```bash
gcloud run deploy io-calculadora-pliegos \
  --source . --region us-central1 \
  --platform managed --allow-unauthenticated \
  --timeout 3600
```

También está `cloudbuild.yaml` para el trigger de Cloud Build.

Secrets que necesita el workflow: `GCP_WORKLOAD_IDENTITY_PROVIDER` y
`GCP_SERVICE_ACCOUNT`.

---

## Pendiente de migración

El servicio anterior sigue vivo en

```
https://io-calculadora-pliegos-919246442188.us-central1.run.app
```

y **su código todavía no está en este repo**. Falta:

- Portar los endpoints existentes **sin romper el contrato** — producción los
  consume hoy.
- Traer la tabla de precios real. Por eso `materiales.precio` está en `null` y
  `src/core/precios.js` recibe la tabla como argumento en lugar de tenerla
  hardcodeada: no se inventó ningún número de negocio.

---

## Convenciones

- Código, comentarios y nombres de variables en **español**.
- Commits conventional: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`.
- `main` protegida, features en ramas.
- Nada de `console.log` sueltos: usar `src/utils/logger.js`.
- Sin dependencias innecesarias — el servicio tiene que arrancar rápido en
  Cloud Run (hoy: Express en runtime, Vitest en dev).
