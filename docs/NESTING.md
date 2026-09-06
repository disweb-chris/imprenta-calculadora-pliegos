# Armado de pose (nesting 2D)

Cómo funciona el módulo `src/nesting/`, qué decisiones se tomaron y contra qué
se calibró.

---

## 1. El modelo de medidas

### Definiciones

| Término | Qué es |
|---|---|
| **trim** | El tamaño final de corte de la pieza. Lo que el cliente recibe. |
| **sangrado** (demasía) | Arte que se imprime más allá del trim, 3 mm por lado, para que un corrimiento de guillotina no deje filo blanco. |
| **caja de sangrado** | `trim + sangrado × 2`. La mancha de tinta de una pieza. |
| **espaciado** (separación) | Separación extra entre dos cajas de sangrado. |
| **calle** | Separación entre dos líneas de trim contiguas: `sangrado × 2 + espaciado`. Es la tira de descarte que cae de la guillotina. |
| **pitch** | Distancia entre el origen de una pieza y el de la siguiente: `trim + calle`. |

### La fórmula

N piezas ocupan `N · pitch − espaciado` de tinta: son N cajas de sangrado
separadas por N−1 espaciados. De ahí:

```
N = floor((pliego − margen · 2 + espaciado) / pitch)
```

Con `margen = 0` esto es **exactamente** lo que hace la calculadora del sitio,
que suma la demasía a la pieza y calcula
`floor((pliego + separación) / (piezaEfectiva + separación))`. El port no
cambia ningún número de producción: `tests/core/compatibilidadWidget.test.js`
corre las dos implementaciones sobre 378 combinaciones y las compara.

> ⚠️ El spec original proponía `floor((pliego − margen·2) / pitch)`, que cuenta
> una calle de más y da 3 columnas en la pose de tarot en vez de 4.

### Los dos márgenes

`margenMinimo` es una **restricción**, no una posición. Resuelta la grilla, el
sobrante se reparte en partes iguales entre los dos lados. Se reportan dos
márgenes porque el taller usa los dos:

| Margen | Del borde del pliego a… | Tarot |
|---|---|---|
| `bloque.margenSangrado` | el borde de la **tinta** | 8 mm lateral / 46 mm vertical |
| `bloque.margen*` | la primera **línea de corte** | 11 mm lateral / 49 mm vertical |

Siempre `margenTrim = margenSangrado + sangrado`. El de tinta es el que tiene
que respetar la pinza de la máquina y donde entran las marcas de corte.

Que lateral y vertical den distinto (11 ≠ 49) es la prueba de que el bloque va
**centrado** y no anclado a un margen fijo. Además, el centrado es lo que hace
que una pose doble faz registre sola (§ 4).

### El margen por defecto es 0

La calculadora en producción **no tiene concepto de margen**: las piezas se
acomodan contra el borde del pliego. Los 11 mm laterales de la pose de tarot
son sobrante del centrado, no una restricción — de hecho la tinta llega a 8 mm
del borde, que es menos que cualquier margen de pinza razonable.

Por eso `margenMinimo` es **0 por defecto**, para no romper el contrato, y
queda como parámetro opcional para las máquinas que sí necesitan pinza. No es
gratis: pedir 10 mm de margen en la pose de tarot baja el trabajo de 12 a 10
cartas por pliego.

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

Mazo de tarot, pliego 320 × 470 mm, **sin margen**. Reproducida por
`tests/nesting/poseReferencia.test.js` con tolerancia de ±0.5 mm.

| Parámetro | Valor |
|---|---|
| Pieza (trim) | 70 × 120 mm |
| Sangrado | 3 mm por lado |
| Calle | 6 mm |
| Pitch | 76 × 126 mm |
| Grilla | 4 columnas × 3 filas = **12 piezas** |
| Margen lateral (trim / tinta) | 11 / 8 mm |
| Margen sup.-inf. (trim / tinta) | 49 / 46 mm |
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

Los cinco casos reales del negocio salen con **un solo modelo**; lo único que
cambia entre soportes es el espaciado.

| Material | Pliego | Pieza | Esperado | Calculado |
|---|---|---|---|---|
| Papel obra | 32×47 cm | 90×50 mm | 24 | **24** (3×8) |
| Papel obra | 32×47 cm | 70×120 mm | 12 | **12** (4×3) |
| Papel ilustración | A3 297×420 | 60×60 | ~24 | **24** (4×6) |
| Papel ilustración | A3 297×420 | 70×40 | ~30 | **30** (6×5, rotada) |
| Vinilo mate | 1000×1000 | 60×60 | ~169 | **169** (13×13) |
| Vinilo mate | 1000×1000 | 70×40 | ~228 | **228** (12×19) |

### Perfiles (`src/config/defaults.js`)

```js
hoja:  { sangrado: 3, espaciado: 0, margenMinimo: 0 }
rollo: { sangrado: 3, espaciado: 6, margenMinimo: 0 }
```

### Cómo se llegó al perfil de rollo

El spec anticipaba que en material de rollo el cálculo teórico daría más piezas
que las 169/228 reales, y pedía calibrar en vez de forzar el número.

Con el perfil de hoja (`espaciado 0`) el metro de vinilo da **225** stickers de
60×60 y **273** de 70×40 — bastante más que lo que sale en producción. La
diferencia es real: el vinilo se corta sobre material continuo y el avance del
rollo tiene tolerancia mecánica, así que en el taller se deja más aire entre
piezas.

Se barrió el espacio `(margenMinimo, espaciado)` buscando las combinaciones que
den **exactamente 169 y 228 al mismo tiempo**. Con `margenMinimo 0` —el valor
de producción— el espaciado que cumple las dos condiciones es **6 o 7 mm**:

```
60×60 → 13 columnas exige   espaciado > 5.85  y  espaciado ≤ 11.83
70×40 → 12 columnas exige   espaciado > 1     y  espaciado ≤ 8
70×40 → 19 filas    exige   espaciado > 4.21  y  espaciado ≤ 7
                            ────────────────────────────────────
                            espaciado ∈ (5.85, 7]
```

Se eligió **6 mm** por ser el extremo redondo del intervalo y porque es un
valor que el operador puede tipear hoy mismo en el campo "Separación (mm entre
piezas)" de la calculadora del sitio y obtener el mismo resultado.

Verificación (calle = 3×2 + 6 = 12 mm):

```
60×60 → pitch 72 → floor((1000 + 6) / 72) = 13 → 13 × 13 = 169  ✅
70×40 → pitch 82 × 52 → floor(1006/82) = 12, floor(1006/52) = 19 → 228  ✅
```

**No hay ningún número mágico en el código**: 169 y 228 salen de la fórmula
general con estos dos parámetros.

### Cuándo recalibrar

Si el taller cambia de guillotina, de plotter de corte o de proveedor de
vinilo, hay que rehacer este barrido con poses reales medidas. El procedimiento
está en `tests/nesting/pose.test.js`: se agregan los casos nuevos y se ajusta el
perfil hasta que pasen.

---

## 3b. Desempate de orientación

Cuando las dos orientaciones dan la **misma cantidad**, hay que elegir una.

La calculadora del sitio desempata por `sobranteAncho + sobranteAlto` y se
queda con el menor. Eso suma un sobrante horizontal con uno vertical, que no
son magnitudes comparables, y por eso **elige mal el mazo de tarot**:

| Orientación | Grilla | Piezas | Sobrante A+B | Margen de tinta |
|---|---|---|---|---|
| Normal | 4 × 3 | 12 | 10.8 cm | 8 mm lateral / **46 mm** vertical |
| Rotada | 2 × 6 | 12 | 8.2 cm | 34 mm lateral / **7 mm** vertical |

El widget elige la rotada porque 8.2 < 10.8. Pero la pose real es la normal
4×3: la rotada deja 7 mm de tinta al borde —donde no entran ni las marcas de
corte— y obliga a girar el arte de las 78 cartas.

Este módulo **prefiere no rotar a igualdad de cantidad**, que es la convención
habitual y la que reproduce la pose de referencia. Ambas cantidades se exponen
igual en `pose.alternativas` para que la UI las siga mostrando lado a lado.

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
- **Margen de pinza simétrico.** `margenMinimo` se aplica igual a los cuatro
  lados y el bloque se centra. Una máquina que necesite un margen asimétrico
  (pinza sólo de un lado) requiere una estrategia de anclado nueva — y ahí
  `registro` va a empezar a dar distinto de cero, a propósito.
- **Rotación sólo a 90°.** No se prueban ángulos intermedios.
- **El rollo se modela como un pliego fijo.** `1000 × 1000` es una convención
  para cotizar por m²; no se optimiza el largo de tirada continua.
- **Un solo trabajo por pliego.** No hay ganging de pedidos distintos.
