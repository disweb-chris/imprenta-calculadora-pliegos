# Armado de pose (nesting 2D)

Cómo funciona el módulo `src/nesting/`, qué decisiones se tomaron y contra qué
se calibró.

---

## 1. El modelo de márgenes

Este es el punto donde la implementación **se aparta del spec original**, y es
la razón por la que la pose de referencia sale bien.

### Definiciones

| Término | Qué es |
|---|---|
| **trim** | El tamaño final de corte de la pieza. Lo que el cliente recibe. |
| **sangrado** | Arte que se imprime más allá del trim (3 mm por lado) para que un corrimiento de guillotina no deje filo blanco. |
| **espaciado** | Separación extra que se agrega entre calles, por encima del sangrado. |
| **calle** | Separación entre dos líneas de trim contiguas: `sangrado × 2 + espaciado`. Es la tira de descarte que cae de la guillotina. |
| **pitch** | Distancia entre el origen de una pieza y el de la siguiente: `lado + calle`. |
| **bloque** | El rectángulo que va desde la primera línea de trim hasta la última. |

### La corrección

El spec proponía:

```
columnas = floor(anchoUtil / pitchX)         donde anchoUtil = pliego - margen*2
```

Eso está mal, y falla exactamente en el caso de referencia. Con el pliego de
tarot (320 × 470, pieza 70 × 120, sangrado 3, margen 10):

```
pitch  = 70 + 6 = 76
útil   = 320 - 20 = 300
floor(300 / 76) = 3 columnas        ← el spec da 3
```

Pero la pose real tiene **4 columnas**. El error es contar una calle de más:
después de la última pieza no hay calle, porque no hay pieza siguiente. Lo que
tiene que respetar el margen mínimo es el **bloque de trim**, no el bloque de
pitches.

```
n = floor((útil + calle) / pitch)

floor((300 + 6) / 76) = floor(4.026) = 4 columnas   ✅
floor((450 + 6) / 126) = floor(3.619) = 3 filas     ✅
```

Consecuencia práctica: el sangrado exterior del bloque (3 mm) invade el margen.
En la pose de tarot el margen de trim es 11 mm y el sangrado llega hasta los
8 mm del borde del pliego. **Eso es correcto y es lo que pasa en producción**:
el margen mínimo protege el corte, no la mancha de tinta.

### Centrado

`margenMinimo` es una **restricción**, no una posición. Una vez resuelta la
grilla, el sobrante (`pliego − bloque`) se reparte en partes iguales entre los
dos márgenes:

```
margen lateral       = (320 − 298) / 2 = 11 mm
margen sup./inferior = (470 − 372) / 2 = 49 mm
```

Que den distinto (11 ≠ 49) es la prueba de que el bloque va centrado y no
anclado a un margen fijo. Además, el centrado es lo que hace que una pose
**doble faz registre sola** (ver sección 4).

---

## 2. Marcas de corte para guillotina

Cortamos con guillotina, corte recto. No hace falta registro óptico ni marcas
de plotter.

### Reglas

1. **Dos marcas por calle, no una.** Cada pieza tiene su propia línea de trim.
   Entre dos piezas contiguas hay una calle de `sangrado × 2` con una marca en
   cada borde: la guillotina hace doble pasada y cae una tira de descarte.
   En los bordes exteriores del bloque va una sola marca.
   Para `C` columnas salen `2·C` líneas verticales; para `F` filas, `2·F`
   horizontales.
2. **Las marcas van sólo en el margen del pliego**, nunca cruzando el arte.
   El tick arranca donde termina la caja de sangrado del bloque (separación =
   sangrado) y se aleja del arte hacia el borde.
3. Tick de 5 mm, trazo de 0.25 pt.
4. Cada línea de trim vertical dibuja un tick arriba y otro abajo; cada
   horizontal, uno a izquierda y otro a derecha.
   `total marcas = (líneas verticales + líneas horizontales) × 2`.

Si el margen no alcanza para `sangrado + 5 mm`, la pose sale igual pero con una
entrada en `advertencias`.

### Pose de referencia verificada

Mazo de tarot, pliego 320 × 470 mm. Reproducida por
`tests/nesting/poseReferencia.test.js` con tolerancia de ±0.5 mm.

| Parámetro | Valor |
|---|---|
| Pieza (trim) | 70 × 120 mm |
| Sangrado | 3 mm por lado |
| Calle | 6 mm |
| Pitch | 76 × 126 mm |
| Grilla | 4 columnas × 3 filas = **12 piezas** |
| Margen lateral | 11 mm |
| Margen superior/inferior | 49 mm |
| Líneas de marca | 14 (8 verticales + 6 horizontales) |
| Total de marcas | 28 |

Marcas verticales calculadas vs. medidas en la pose real:

| # | Calculada | Real | Δ |
|---|---|---|---|
| 1 | 11 | 11.2 | 0.2 |
| 2 | 81 | 81.2 | 0.2 |
| 3 | 87 | 87.2 | 0.2 |
| 4 | 157 | 157.2 | 0.2 |
| 5 | 163 | 163.2 | 0.2 |
| 6 | 233 | 233.2 | 0.2 |
| 7 | 239 | 239.2 | 0.2 |
| 8 | 309 | 309.2 | 0.2 |

Marcas horizontales:

| # | Calculada | Real | Δ |
|---|---|---|---|
| 1 | 49 | 48.9 | 0.1 |
| 2 | 169 | 169.1 | 0.1 |
| 3 | 175 | 174.9 | 0.1 |
| 4 | 295 | 295.1 | 0.1 |
| 5 | 301 | 300.9 | 0.1 |
| 6 | 421 | 421.1 | 0.1 |

Los desvíos son artefactos del archivo original, no del modelo: en el eje
vertical son un corrimiento uniforme de +0.2 mm (el bloque quedó 0.2 mm a la
derecha del centro), y en el horizontal son las piezas expandidas 0.1 mm por
lado. Ambos están muy por debajo de la tolerancia de la guillotina.

---

## 3. Calibración por material

Los cuatro casos reales del negocio salen con **un solo modelo**; lo único que
cambia entre soportes es el espaciado.

| Material | Pliego | Pieza | Esperado | Calculado |
|---|---|---|---|---|
| Papel ilustración | A3 297×420 | 60×60 | ~24 | **24** (4×6) |
| Papel ilustración | A3 297×420 | 70×40 | ~30 | **30** (6×5, rotada) |
| Vinilo mate | 1000×1000 | 60×60 | ~169 | **169** (13×13) |
| Vinilo mate | 1000×1000 | 70×40 | ~228 | **228** (12×19) |

### Perfiles (`src/config/defaults.js`)

```js
hoja:  { sangrado: 3, espaciado: 0, margenMinimo: 10 }
rollo: { sangrado: 3, espaciado: 5, margenMinimo: 10 }
```

### Cómo se llegó al perfil de rollo

El spec anticipaba que en material de rollo el cálculo teórico daría más piezas
que las 169/228 reales, y pedía calibrar en vez de forzar el número.

Con `margen 10 / espaciado 0` el metro de vinilo daría 15×15 = 225 stickers de
60×60 y 13×24 = 312 de 70×40 — bastante más que lo que sale en producción. La
diferencia es real: el vinilo se corta sobre material continuo y el avance del
rollo tiene tolerancia mecánica, así que en el taller se deja más aire entre
piezas.

Se barrió el espacio `(margenMinimo, espaciado)` buscando las combinaciones que
den **exactamente 169 y 228 al mismo tiempo**. Existe una región amplia de
soluciones; la línea de combinaciones válidas va desde `(5, 6)` hasta `(30, 2)`
—hay un intercambio entre margen y espaciado, como es de esperar.

Se eligió **`margen 10 / espaciado 5`** por dos motivos:

1. **Mantiene el margen en 10 mm**, igual que en hoja. El margen lo fija la
   guillotina, que es la misma máquina para los dos soportes; no había razón
   física para cambiarlo. Lo que cambia entre soportes es el aire entre piezas,
   así que el único parámetro que se movió es el que corresponde.
2. **Está en el centro de la región válida.** Con `margen 10` el espaciado
   admite 5, 5.5 o 6; con espaciado 5 el margen admite de 9 a 15. Estar lejos de
   los bordes significa que un cambio chico de formato no vuelca el resultado a
   una fila o columna de más.

Verificación con estos valores (calle = 6 + 5 = 11 mm):

```
60×60 → pitch 71 → floor((980 + 11) / 71) = 13 → 13 × 13 = 169  ✅
70×40 → pitch 81 × 51 → floor(991/81) = 12, floor(991/51) = 19 → 228  ✅
```

**No hay ningún número mágico en el código**: los 169 y 228 salen de la fórmula
general con estos dos parámetros.

### Cuándo recalibrar

Si el taller cambia de guillotina, de plotter de corte o de proveedor de
vinilo, hay que rehacer este barrido con poses reales medidas. El procedimiento
está en `tests/nesting/pose.test.js`: se agregan los casos nuevos y se ajusta el
perfil hasta que pasen.

---

## 4. Doble faz

Una pose doble faz imprime frente y dorso sobre el mismo pliego. Es el caso del
mazo de tarot: una cara con los frentes de las cartas, la otra con el dorso.

### El problema

Cuando el pliego se da vuelta para la segunda pasada, la geometría se espeja:
lo que estaba en la columna 0 aparece en la última columna. Si el dorso se
imprime en el mismo orden que el frente, cada carta queda con el dorso de otra.

### La solución

El dorso se calcula **espejando el frente sobre el eje de volteo**:

| `ejeVolteo` | Qué gira | Transformación |
|---|---|---|
| `"vertical"` (por defecto) | El pliego gira sobre su eje vertical, izquierda ↔ derecha. Es el volteo estándar de imprenta plana. | `x' = anchoPliego − (x + ancho)`, `columna' = columnas − 1 − columna`. Las filas no se mueven. |
| `"horizontal"` | El pliego gira sobre su eje horizontal, arriba ↔ abajo. | `y' = altoPliego − (y + alto)`, `fila' = filas − 1 − fila`. Las columnas no se mueven. |

Para la pose de tarot con volteo vertical:

```
frente:  1  2  3  4        dorso:   4  3  2  1
         5  6  7  8                 8  7  6  5
         9 10 11 12                12 11 10  9
```

Que es exactamente lo que se ve en el pliego de referencia: los frentes
numerados 78 77 76 75 de izquierda a derecha, en orden descendente.

### Contrato de la salida

`calcularPoseDobleFaz()` devuelve la geometría común (cantidad, grilla,
aprovechamiento) más:

- `frente` y `dorso`, cada uno con sus `posiciones`, `marcasCorte`, `ticks` y
  el `orden` de lectura de la cara.
- `mapeo`: por cada pieza, en qué celda cae en el frente y en cuál en el dorso.
- `registro`: el desvío máximo entre las marcas de una cara y las de la otra.

**Garantía clave del contrato:** `frente.posiciones[i]` y `dorso.posiciones[i]`
son siempre la misma pieza lógica (mismo `indice`). Lo que cambia entre caras es
en qué celda de la grilla cae.

### Por qué el registro da 0

Como el bloque va **centrado**, los márgenes son simétricos, y el espejo de un
conjunto simétrico de líneas es el mismo conjunto. Las marcas de corte del dorso
caen exactamente sobre las del frente: se corta el mazo entero con una sola
tirada de guillotina, sin importar de qué lado se apoye el pliego.

El módulo igual **calcula** el espejo de las marcas y mide la coincidencia en
vez de asumirla, para que un cambio futuro en el modelo de márgenes que rompa la
simetría (por ejemplo, anclar el bloque a un margen de pinza) se detecte solo
en `registro.registra === false`.

---

## 5. Estrategias

Hoy hay una sola: `shelf`, empaquetado en grilla regular. Cubre el 95% de los
trabajos (stickers, etiquetas, tarjetas, cartas — todos rectángulos del mismo
tamaño) y es la única que la guillotina puede cortar de una pasada, así que
para nuestro flujo de trabajo también es la óptima.

El registro de estrategias en `src/nesting/pose.js` está abierto:

```js
const ESTRATEGIAS = { shelf: resolverShelf };
```

Una estrategia nueva (`guillotine`, nesting irregular, mezcla de tamaños) sólo
tiene que devolver `{ columnas, filas, cantidad, rotada, piezaEfectiva }` y se
selecciona con `estrategia: "..."` sin tocar a los consumidores.

---

## 6. Limitaciones conocidas

- **Sólo rectángulos, todos del mismo tamaño.** No hay nesting irregular ni
  mezcla de piezas distintas en un mismo pliego.
- **Sin margen de pinza.** El modelo centra el bloque; una máquina que necesite
  un margen asimétrico para la pinza requiere una estrategia de anclado nueva
  (y ahí `registro` va a empezar a dar distinto de cero, a propósito).
- **Rotación sólo a 90°.** No se prueban ángulos intermedios.
- **El rollo se modela como un pliego fijo.** `1000 × 1000` es una convención
  para cotizar por m²; no se optimiza el largo de tirada continua.
- **Un solo trabajo por pliego.** No hay ganging de pedidos distintos.
