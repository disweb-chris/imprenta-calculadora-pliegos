# Contrato de la API

Base local: `http://localhost:8080`
Todas las medidas en **milímetros**. Los errores de negocio salen `400` con
`{ "error": "...", "campo": "..." }` y mensaje en español.

---

## `GET /health`

Healthcheck de Cloud Run.

```json
{ "estado": "ok", "servicio": "io-calculadora-pliegos" }
```

---

## `GET /api/materiales`

Catálogo de materiales con su geometría y perfil de pose calibrado.

```json
{
  "materiales": [
    {
      "id": "papel-ilustracion-a3",
      "nombre": "Papel ilustración A3",
      "soporte": "hoja",
      "pliego": { "ancho": 297, "alto": 420 },
      "perfilPose": { "sangrado": 3, "espaciado": 0, "margenMinimo": 10 },
      "precio": null
    }
  ]
}
```

> `precio` es `null` a propósito: la tabla de precios todavía vive en el
> microservicio desplegado. Ver README → *Pendiente de migración*.

## `GET /api/materiales/:id`

Devuelve un material, o `404` si no existe.

---

## `POST /api/nesting/calcular`

Resuelve una pose de una cara.

### Request

```json
{
  "pliego": { "ancho": 320, "alto": 470 },
  "pieza": { "ancho": 70, "alto": 120 },
  "sangrado": 3,
  "espaciado": 0,
  "margenMinimo": 10,
  "permitirRotacion": true,
  "estrategia": "shelf"
}
```

Todos los campos son opcionales salvo `pieza`. Los defaults son A3 con el
perfil de hoja (`sangrado 3`, `espaciado 0`, `margenMinimo 10`).

Alternativa: pasar `material` en vez de la geometría, y el perfil calibrado se
toma del catálogo. Lo que venga explícito en el body lo sobrescribe.

```json
{ "material": "vinilo-mate", "pieza": { "ancho": 60, "alto": 60 } }
```

### Response `200`

```json
{
  "estrategia": "shelf",
  "cantidad": 12,
  "orientacion": "vertical",
  "rotada": false,
  "columnas": 4,
  "filas": 3,
  "aprovechamiento": 0.6702,
  "desperdicio_mm2": 49600,
  "pliego": { "ancho": 320, "alto": 470 },
  "pieza": { "ancho": 70, "alto": 120 },
  "piezaEfectiva": { "ancho": 70, "alto": 120 },
  "parametros": { "sangrado": 3, "espaciado": 0, "margenMinimo": 10, "permitirRotacion": true, "calle": 6 },
  "bloque": {
    "ancho": 298, "alto": 372,
    "margenIzquierdo": 11, "margenDerecho": 11,
    "margenSuperior": 49, "margenInferior": 49
  },
  "pitch": { "x": 76, "y": 126 },
  "posiciones": [
    {
      "indice": 0, "fila": 0, "columna": 0,
      "x": 11, "y": 49, "ancho": 70, "alto": 120, "rotada": false,
      "sangradoCaja": { "x": 8, "y": 46, "ancho": 76, "alto": 126 }
    }
  ],
  "marcasCorte": {
    "verticales": [11, 81, 87, 157, 163, 233, 239, 309],
    "horizontales": [49, 169, 175, 295, 301, 421]
  },
  "ticks": [
    { "orientacion": "vertical", "borde": "superior", "x1": 11, "y1": 41, "x2": 11, "y2": 46 }
  ],
  "totalLineasDeMarca": 14,
  "totalMarcas": 28,
  "marcas": { "largo": 5, "grosorPt": 0.25, "separacion": 3 },
  "advertencias": []
}
```

| Campo | Qué es |
|---|---|
| `posiciones[].x/y` | Esquina superior izquierda del **trim** de la pieza. Origen en la esquina superior izquierda del pliego. |
| `posiciones[].sangradoCaja` | La misma pieza con el sangrado incluido: la caja donde va el arte. |
| `marcasCorte` | Coordenadas de las **líneas de trim**. Dos por calle. |
| `ticks` | Los segmentos dibujables de esas líneas, ya ubicados en el margen. |
| `advertencias` | No bloquean: avisan, por ejemplo, que el margen no alcanza para los ticks. |

---

## `POST /api/nesting/doble-faz`

Igual que `/calcular`, más el eje de volteo. Devuelve las dos caras registradas.

### Request

```json
{
  "pliego": { "ancho": 320, "alto": 470 },
  "pieza": { "ancho": 70, "alto": 120 },
  "sangrado": 3,
  "margenMinimo": 10,
  "ejeVolteo": "vertical"
}
```

`ejeVolteo`: `"vertical"` (default, el pliego gira izquierda↔derecha) u
`"horizontal"` (gira arriba↔abajo).

### Response `200`

Todos los campos de `/calcular` (sin `posiciones`/`marcasCorte`/`ticks` en la
raíz, que pasan a estar por cara), más:

```json
{
  "dobleFaz": true,
  "ejeVolteo": "vertical",
  "cantidad": 12,
  "frente": {
    "cara": "frente",
    "bloque": { "...": "..." },
    "posiciones": [ "..." ],
    "marcasCorte": { "...": "..." },
    "ticks": [ "..." ],
    "orden": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  },
  "dorso": {
    "cara": "dorso",
    "orden": [3, 2, 1, 0, 7, 6, 5, 4, 11, 10, 9, 8],
    "...": "..."
  },
  "mapeo": [
    {
      "indice": 0,
      "frente": { "fila": 0, "columna": 0, "x": 11, "y": 49 },
      "dorso":  { "fila": 0, "columna": 3, "x": 239, "y": 49 }
    }
  ],
  "registro": { "desvioMaximo_mm": 0, "registra": true }
}
```

- `frente.posiciones[i]` y `dorso.posiciones[i]` son **siempre la misma pieza**
  (mismo `indice`). Lo que cambia es en qué celda cae.
- `orden` es el orden de lectura de cada cara (izquierda→derecha,
  arriba→abajo). El del dorso viene espejado.
- `registro.registra` en `true` significa que las marcas de corte de las dos
  caras coinciden: se corta con una sola tirada de guillotina.

---

## `POST /api/nesting/preview.svg`

Mismo body que `/calcular`, más:

| Campo | Valores | Default |
|---|---|---|
| `modo` | `"preview"` \| `"produccion"` | `"preview"` |
| `numerarPiezas` | `boolean` | `false` |

Devuelve `image/svg+xml`, a escala real en milímetros (`viewBox` 1:1), listo
para importar en Illustrator.

- **`preview`**: piezas rellenas, márgenes punteados, marcas en naranja, y la
  cantidad total como único texto. Para mostrarle al cliente.
- **`produccion`**: fondo blanco, sólo contornos de trim y marcas de corte en
  negro (convertir a negro de registro al armar el PDF). Sin texto. Para
  superponer al arte.

## `POST /api/nesting/doble-faz/preview.svg?cara=frente|dorso`

Igual, sobre una pose doble faz. La cara se pasa por query string o en el body
(`{ "cara": "dorso" }`); default `frente`.

---

## Errores

| Código | Cuándo |
|---|---|
| `400` | Pieza más grande que el pliego, medidas negativas o cero, margen que no deja área útil, material o estrategia inexistente, cara o eje de volteo inválido, JSON malformado. |
| `404` | Material o ruta inexistente. |
| `500` | Error no controlado (se loguea con stack). |

```json
{
  "error": "La pieza de 400×500 mm no entra en un pliego de 297×420 mm respetando un margen de 10 mm por lado.",
  "campo": "pieza"
}
```

---

## `POST /api/calcular`

Trabajo completo: pose + pliegos + cotización. Contrato nativo, todo en
milímetros y con nombres en español.

### Request

```json
{
  "pliego": { "ancho": 320, "alto": 470 },
  "pieza": { "ancho": 90, "alto": 50 },
  "sangrado": 3,
  "espaciado": 0,
  "margenMinimo": 0,
  "cantidad": 100,
  "merma": 2,
  "dobleFaz": false,
  "armarPose": false,
  "costoPapel": 120,
  "costoImpresion": 80,
  "costoFijo": 5000,
  "porcentajeProduccion": 15,
  "porcentajeGanancia": 40,
  "aplicarIva": true
}
```

Con `armarPose: true` se devuelve además el layout completo (posiciones,
marcas y ticks); si además `dobleFaz` es `true`, se devuelve la pose de las dos
caras.

### Response `200`

```json
{
  "dobleFaz": false,
  "piezasPorPliego": 24,
  "pose": {
    "cantidad": 24, "columnas": 3, "filas": 8,
    "rotada": false, "orientacion": "vertical",
    "piezaConSangrado": { "ancho": 96, "alto": 56 },
    "aprovechamiento": 0.7181,
    "bloque": { "...": "..." },
    "alternativas": {
      "normal": { "columnas": 3, "filas": 8, "cantidad": 24 },
      "rotada": { "columnas": 5, "filas": 4, "cantidad": 20 }
    },
    "advertencias": []
  },
  "pliegos": {
    "pliegosNetos": 5, "demasia": 2, "pliegosTotales": 7,
    "pasadas": 7, "piezasProducidas": 168, "sobrante": 68
  },
  "cotizacion": {
    "papel": 840, "impresion": 560, "costoFijo": 5000,
    "costoTotal": 6400, "costoUnitario": 64,
    "porcentajeProduccion": 15, "porcentajeGanancia": 40,
    "precioFinal": 10304, "precioUnitario": 103.04,
    "aplicarIva": true, "iva": 2163.84,
    "precioFinalConIva": 12467.84, "precioUnitarioConIva": 124.68
  }
}
```

El orden de la cadena de costos importa y es el de producción: la ganancia se
aplica sobre el costo **ya recargado** por producción.

```
costoTotal   = pliegos·costoPapel + impresiones·costoImpresion + costoFijo
precioFinal  = costoTotal · (1 + %producción/100) · (1 + %ganancia/100)
IVA          = precioFinal · 0.21
```

---

## `POST /api/calcular/compat`

Lo mismo, pero con **los nombres de campo y las unidades del formulario del
sitio**: `sheetW`/`sheetH` e `itemW`/`itemH` en centímetros, `bleed` y `gutter`
en milímetros.

```json
{
  "sheetW": 32, "sheetH": 47, "itemW": 9, "itemH": 5,
  "bleed": 3, "gutter": 0,
  "qty": 100, "extraSheets": 2, "doubleFace": false,
  "costPaper": 120, "costPrint": 80, "costSetup": 5000,
  "prodPct": 15, "profitPct": 40, "applyVat": true
}
```

La respuesta es idéntica a la de `/api/calcular`. Existe para que el widget
pueda pasar a consumir el servicio sin tocar el HTML del formulario; ver
[MIGRACION.md](MIGRACION.md).

### Parámetros de pose que acepta cualquier endpoint de cálculo

| Campo | Default | Qué hace |
|---|---|---|
| `sangrado` | 3 | Demasía por lado, en mm. |
| `espaciado` | 0 | Separación extra entre cajas de sangrado, en mm. |
| `margenMinimo` | 0 | Margen de pinza: distancia mínima del borde a la tinta. |
| `margenMarcas` | 5 | Lugar reservado para las marcas de corte. Ponerlo en 0 devuelve la pose de máximo rendimiento, sin garantía de que se pueda guillotinar. |
| `permitirRotacion` | true | Probar la pieza girada 90°. |
| `estrategia` | `"shelf"` | Algoritmo de imposición. |
| `incluirSvg` | false | Adjunta el preview en el mismo response. |
| `modoSvg` | `"preview"` | `"preview"` o `"produccion"`. |

`margenMinimo` y `margenMarcas` son restricciones sobre la misma distancia
(borde del pliego a la tinta), así que se resuelven tomando el más exigente. El
efectivo se devuelve en `parametros.margenEfectivo`.
