# io-calculadora-pliegos

Microservicio de **cálculo de pliegos y armado de pose** de
[Imprenta Online](https://imprentaonline.ar) (Villa Devoto, CABA).

Responde dos preguntas del taller:

1. **¿Cuántas piezas entran en un pliego y cómo se acomodan?** — armado de pose
   (nesting 2D) con marcas de corte para guillotina, incluido el caso
   **doble faz** (frente y dorso registrados).
2. **¿Cuántos pliegos hace falta comprar para una tirada?** — cálculo de
   pliegos, demasía y pasadas de máquina.
3. **¿Cómo queda el pliego armado?** — imposición: se le da el PDF del arte y
   devuelve los pliegos listos para imprimir, con las marcas encima y el color
   del cliente intacto.

Corre en Cloud Run y lo consumen el sitio y (a futuro) el bot de WhatsApp.

---

## Arquitectura

```
src/
├── core/            # lógica de negocio pura
│   ├── materiales.js   catálogo: geometría + perfil de pose por material
│   ├── pliegos.js      pliegos necesarios para una tirada
│   ├── precios.js      escalas por cantidad, costos, % y IVA
│   ├── trabajo.js      composición: pose + pliegos + cotización
│   └── unidades.js     conversión cm ↔ mm
├── imposicion/      # el arte del cliente sobre el pliego
│   ├── documento.js    lectura de cajas del PDF y detección de demasía
│   ├── medir.js        reconstruye la pose de un pliego ya impuesto
│   ├── seleccion.js    qué páginas entran y en qué orden
│   ├── demasia.js      demasía sintética por espejado de bordes
│   ├── marcas.js       marcas de guillotina en negro de registro
│   ├── imponer.js      arma los pliegos
│   └── unidades.js     milímetros ↔ puntos tipográficos
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
│   └── defaults.js     demasía, espaciado y perfiles calibrados
└── utils/logger.js     logger JSON lines para Cloud Logging

src/web/entrada.js      punto de entrada del bundle para el navegador

web/
├── calculadora.js      widget del sitio, ahora cliente del servicio
├── pose.bundle.js      el mismo core empaquetado: respaldo si Cloud Run cae
└── demo.html           el widget completo para probar local
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
npm test              # suite unitaria, ~2 s
npm run test:web      # widget en un navegador real (necesita Chromium)
npm run test:watch
npm run test:coverage
```

Qué cubre:

- La **pose de referencia de producción** (mazo de tarot, 320 × 470, 12 cartas)
  verificada coordenada por coordenada contra las marcas medidas en el pliego
  real, con tolerancia de ±0.5 mm.
- **Tests de propiedades** sobre 4.000 combinaciones de pliego y pieza al azar
  (semilla fija): toda pose que se arma tiene lugar para sus marcas, los ticks
  nunca pisan el arte, las piezas no se superponen y el dorso siempre registra.
  La pose de tarot es una referencia, no el caso general.
- Un **golden test** contra la calculadora que está hoy en el sitio: corre las
  dos implementaciones sobre 378 combinaciones y compara campo por campo.
- **17 tests de navegador** del widget contra el servicio real, incluido el
  respaldo offline: con el servicio caído tiene que dar las mismas filas y el
  mismo SVG.

---

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/health` | Healthcheck de Cloud Run |
| `POST` | `/api/calcular` | Trabajo completo: pose + pliegos + cotización |
| `POST` | `/api/calcular/compat` | Igual, con los nombres y unidades del formulario del sitio |
| `GET` | `/api/materiales` | Catálogo con geometría y perfil de pose |
| `GET` | `/api/materiales/:id` | Un material |
| `POST` | `/api/nesting/calcular` | Pose de una cara: cantidad + layout + marcas |
| `POST` | `/api/nesting/doble-faz` | Pose doble faz: frente, dorso y mapeo |
| `POST` | `/api/nesting/preview.svg` | SVG del layout |
| `POST` | `/api/nesting/doble-faz/preview.svg` | SVG de una cara (`?cara=frente\|dorso`) |

## Imponer un trabajo

```bash
node bin/imponer.js --frente cartas.pdf --dorso dorso.pdf \
  --pieza 70x120 --pliego 320x470 --salida pliegos.pdf
```

Un mazo de 78 cartas sale en 7 pliegos de 12, frente y dorso registrados, con
las 28 marcas de guillotina por cara. El arte se embebe: los colores CMYK
llegan intactos y los vectores siguen siendo vectores.

Si el arte viene sin demasía, se genera espejando el borde y el informe lo
marca. Cómo funciona todo eso: **[docs/IMPOSICION.md](docs/IMPOSICION.md)**.

Para contrastar una pose generada contra una armada a mano:

```bash
node bin/comparar.js --a generada.pdf --b hecha-a-mano.pdf
```

Mide las dos leyendo las marcas de corte que están realmente dibujadas, sin
importar cómo se construyó cada archivo, y reporta el desvío en milímetros.

---

Contrato completo con requests y responses de ejemplo: **[docs/API.md](docs/API.md)**.
Cómo funciona el algoritmo y cómo se calibró: **[docs/NESTING.md](docs/NESTING.md)**.
Estado del port de la calculadora del sitio: **[docs/MIGRACION.md](docs/MIGRACION.md)**.

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

## El widget del sitio

`web/calculadora.js` reemplaza al script que calculaba en el navegador: mismo
HTML, mismo CSS, mismos nombres de campo y misma clave de `localStorage`, pero
los números salen del servicio y además muestra el preview de la pose con las
marcas de guillotina.

Si el servicio no responde, cae a `web/pose.bundle.js` y sigue cotizando, con
un aviso. Ese bundle es el mismo `src/` empaquetado con esbuild, no una segunda
implementación: `npm run build:web` lo regenera y `tests/bundle.test.js` falla
si queda desactualizado.

Para probarlo sin tocar producción:

```bash
npm run build:web              # regenera el bundle de respaldo
npm start                      # el servicio en :8080
npx http-server web -p 8096    # o cualquier estático
# abrir http://localhost:8096/demo.html
```

Cómo instalarlo en el sitio y qué tener en cuenta: **[docs/MIGRACION.md](docs/MIGRACION.md)**.

---

## Estado de la migración

La calculadora que está hoy en el sitio **no es un servicio**: es un widget que
calcula todo en el navegador. Su aritmética está portada completa a
`src/core/`, y `tests/core/compatibilidadWidget.test.js` corre las dos
implementaciones sobre 378 combinaciones para probar que dan lo mismo.

`POST /api/calcular/compat` habla el mismo contrato que el formulario (mismos
nombres de campo, cm para las medidas y mm para demasía y separación), así que
el widget puede pasar a consumir el servicio sin tocar el HTML.

En el camino aparecieron tres bugs de producción; dos están corregidos en el
port y uno es de la UI. El detalle, con el impacto medido de cada uno, está en
**[docs/MIGRACION.md](docs/MIGRACION.md)**.

Lo que sigue pendiente:

- **Decidir si el widget pasa a llamar al servicio** o sigue calculando local.
- **La tabla de precios real.** `materiales.precio` está en `null` y
  `src/core/precios.js` recibe todos los importes como argumento en lugar de
  tenerlos hardcodeados: no se inventó ningún número de negocio.

---

## Convenciones

- Código, comentarios y nombres de variables en **español**.
- Commits conventional: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`.
- `main` protegida, features en ramas.
- Nada de `console.log` sueltos: usar `src/utils/logger.js`.
- Sin dependencias innecesarias — el servicio tiene que arrancar rápido en
  Cloud Run (hoy: Express en runtime, Vitest en dev).
