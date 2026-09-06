# Migración de la calculadora del sitio

Estado del port de la calculadora que hoy corre en el navegador
(`.io-pliegos-calc`) a este servicio. Etapa 0 del plan.

---

## 1. Qué es hoy

**No es un microservicio con endpoints**: es un widget de ~200 líneas de JS que
corre íntegramente en el cliente. No hace ninguna request. El "contrato" a no
romper son los campos del formulario, las filas del resultado y la clave de
`localStorage`.

### Entradas

| Campo (`name`) | Unidad | Default | Se usa para |
|---|---|---|---|
| `paperType` | — | `Obra 75g` | Sólo se muestra en el resultado |
| `paperSize` | — | `32x47` | Autocompleta `sheetW`/`sheetH`; se muestra como etiqueta |
| `sheetW`, `sheetH` | **cm** | 32, 47 | Pliego |
| `itemW`, `itemH` | **cm** | 9, 5 | Pieza (trim) |
| `bleed` | **mm** | 3 | Demasía por lado |
| `gutter` | **mm** | 0 | Separación entre piezas |
| `extraSheets` | pliegos | 2 | Merma |
| `qty` | unidades | 100 | Cantidad a producir |
| `doubleFace` | bool | false | Duplica las impresiones |
| `currency` | — | `$` | Sólo formato |
| `applyVat` | bool | false | IVA 21% |
| `costPaper` | $ / pliego | 0 | |
| `costPrint` | $ / pliego / cara | 0 | |
| `costSetup` | $ / trabajo | 0 | |
| `prodPct` | % | 0 | Recargo de producción |
| `profitPct` | % | 0 | Ganancia |

> La mezcla de unidades (cm para medidas, mm para demasía y separación) es la
> fuente del bug de punto flotante de la § 3.

### Salidas

| Fila del resultado | Fórmula |
|---|---|
| Papel | `paperType` |
| Medida pliego | etiqueta de `paperSize` |
| Pieza efectiva (con demasía) | `itemW + 2·bleed/10` × `itemH + 2·bleed/10` |
| Orientación | `Normal` \| `Rotada (90°)` |
| Entran por pliego | `cols × rows` |
| Pliegos base | `ceil(qty / count)` |
| Merma | `extraSheets` |
| Pliegos a imprimir | `base + extraSheets` |
| Impresiones totales | `pliegos × (doubleFace ? 2 : 1)` |
| Costo total (base) | `pliegos·costPaper + impresiones·costPrint + costSetup` |
| Costo / unidad | `costoTotal / qty` |
| Precio final | `costoTotal · (1 + prodPct/100) · (1 + profitPct/100)` |
| Precio final / unidad | `precioFinal / qty` |
| IVA (21%) | `precioFinal · 0.21` |
| Precio final con IVA | `precioFinal + iva` |
| Mini cards Normal / Rotada | cantidad de cada orientación |

Imposición: `floor((pliego + separación) / (piezaEfectiva + separación))` en
cada eje, sin margen.

---

## 2. Qué se portó

| Pieza del widget | Dónde vive ahora |
|---|---|
| `fitCount` / `layout` | `src/nesting/shelf.js` |
| Elección de orientación | `src/nesting/shelf.js` → `resolverShelf` |
| Pliegos, merma, impresiones | `src/core/pliegos.js` |
| Cadena de costos, %, IVA | `src/core/precios.js` |
| Composición completa | `src/core/trabajo.js` |
| Conversión cm ↔ mm | `src/core/unidades.js` |

Dos endpoints nuevos:

- `POST /api/calcular` — contrato nativo, todo en mm y nombres en español.
- `POST /api/calcular/compat` — **mismos nombres y unidades que el formulario**,
  para que el widget pueda pasar a consumir el servicio sin tocar el HTML.

`tests/core/compatibilidadWidget.test.js` transcribe la aritmética original y
compara las dos implementaciones sobre 378 combinaciones de pliego, pieza,
demasía, separación, cantidad, merma, costos y porcentajes. Coinciden en todo
salvo las tres divergencias de abajo, que son deliberadas.

---

## 3. Bugs encontrados en la versión de producción

### 3.1 · El desempate de orientación elige mal — **afecta al mazo de tarot**

Cuando las dos orientaciones dan la misma cantidad, el widget desempata por
`leftoverW + leftoverH` (suma un sobrante horizontal con uno vertical).

Para el tarot (pliego 32×47, carta 7×12, demasía 3 mm) las dos dan 12 cartas:

| | Grilla | Sobrante A+B | Margen de tinta |
|---|---|---|---|
| Normal | 4 × 3 | 10.8 cm | 8 mm lateral / **46 mm** vertical |
| Rotada | 2 × 6 | **8.2 cm** ← gana | 34 mm lateral / **7 mm** vertical |

El widget elige la rotada 2×6. La pose real es la 4×3: la rotada deja 7 mm de
tinta al borde (no entran ni las marcas de corte) y obliga a girar el arte de
las 78 cartas.

**Corregido**: a igualdad de cantidad no se rota. Las dos cantidades se siguen
exponiendo en `pose.alternativas` para las mini-cards de la UI.

### 3.2 · La aritmética en centímetros pierde filas enteras

Trabajar en cm con fracciones decimales rompe el `Math.floor`:

```js
// A3, pieza 70×40 mm, demasía 2 mm, separación 3 mm
42.3 / 4.7  === 8.999999999999998   → floor = 8    ← pierde una fila
423  / 47   === 9                   → floor = 9
```

Sobre un barrido de 153.090 combinaciones realistas, **376 (0.2%) dan un
resultado menor al correcto**, perdiendo 1.647 piezas en total. Es poco
frecuente, pero cuando pega se come una fila o una columna completa y el
presupuesto sale caro.

**Corregido**: el core trabaja íntegramente en milímetros enteros. La
conversión pasa una sola vez por `src/core/unidades.js`, en el borde.

### 3.3 · La etiqueta "Medida pliego" puede mentir

`sizeLabel` se arma desde el `<select>` `paperSize`, no desde `sheetW`/`sheetH`.
Si el operador elige "32 × 47 cm" y después edita a mano el ancho a 40, el
cálculo usa 40 pero el resultado sigue diciendo "32 × 47 cm".

**No corregido** — es un bug de la UI, no del cálculo. Se arregla poniendo el
`<select>` en `custom` cuando cambian `sheetW`/`sheetH`:

```js
['sheetW','sheetH'].forEach(function(n){
  q(calc,'[name="'+n+'"]').addEventListener('input', function(){
    q(calc,'[name="paperSize"]').value = 'custom';
  });
});
```

### 3.4 · Menores

- **Un campo de costo vacío bloquea todo el cálculo.** `parseNum('')` da `NaN` y
  cae en el guard general, que muestra "Revisá los valores" en vez de tratar el
  opcional como 0.
- **`replace(',', '.')` reemplaza sólo la primera coma.** `"1,234,56"` se
  interpreta como `1.234`.
- **Los costos negativos se aceptan.** El guard valida `sheetW`, `itemW`, `qty`,
  pero no `costPaper`, `costPrint` ni `costSetup`.
- **Código muerto**: los `isFinite(costPaper) ? … : 0` son inalcanzables, porque
  el guard anterior ya rechazó cualquier `NaN`.

En el port: las tres primeras están cubiertas por la validación de
`src/nesting/validacion.js` y `src/core/precios.js`, con mensajes en español.

---

## 4. Decisión: el widget pasa a consumir el servicio

De los tres caminos posibles (dejarlo calculando local, que llame al servicio,
o reescribirlo entero) se tomó **el segundo**, por tres razones:

1. **Es el único que arregla los bugs de la § 3 en el sitio.** Dejarlo local
   los deja vivos; reescribirlo entero cuesta mucho más para el mismo efecto.
2. **No toca el HTML ni el CSS.** Mismos `name` de campo, misma clave de
   `localStorage`, mismas filas de resultado. Se reemplaza sólo el `<script>`.
3. **Es lo único que puede mostrar la pose.** Armar el layout, las marcas de
   guillotina y el SVG en el navegador significaría duplicar todo el módulo de
   nesting en el cliente.

### Qué se hizo

- `web/calculadora.js` — reemplazo del script del sitio. Llama a
  `POST /api/calcular/compat` con debounce de 300 ms, cancela la request
  anterior con `AbortController`, y pinta el mismo resultado de siempre más el
  preview de la pose. En doble faz numera las piezas, que es la forma de ver de
  un vistazo que el dorso está espejado.
- `web/demo.html` — el widget completo (HTML y CSS del sitio, sin modificar)
  apuntando a un servicio local, para probar sin tocar producción.
- `tests/web/widget.test.js` — 12 tests de navegador contra el servicio real:
  se corren con `npm run test:web` y en un job aparte de CI.
- CORS en el servicio, configurable con `CORS_ORIGENES`.

### Cómo se instala

1. Reemplazar el contenido del `<script>` del widget por `web/calculadora.js`.
2. Apuntar al servicio con `data-api="https://…"` en el div
   `.io-pliegos-calc`, o dejando el default que ya trae el archivo.
3. Restringir CORS en Cloud Run:
   `--set-env-vars CORS_ORIGENES=https://imprentaonline.ar,https://www.imprentaonline.ar`

### Lo que hay que tener en cuenta

- **Arranque en frío.** Con `min-instances 0` la primera request después de un
  rato tarda alrededor de un segundo. El widget muestra el resultado anterior
  atenuado mientras espera, así que se nota poco; si molesta, se resuelve con
  `--min-instances 1`.
- **Si el servicio no responde**, el widget muestra un error y no cotiza. Es
  deliberado: es preferible a que el sitio dé un precio con la aritmética
  vieja, que es la que tiene los bugs. La alternativa —dejar el cálculo local
  como respaldo— reintroduce la duplicación que esta migración vino a sacar.

---

## 5. Lo que sigue pendiente

- **La tabla de precios real.** `materiales.precio` está en `null` y
  `src/core/precios.js` recibe todos los importes como argumento en lugar de
  tenerlos hardcodeados: no se inventó ningún número de negocio. Hoy los
  precios los tipea el operador en el formulario.
- **El bug 3.3 en el sitio viejo**, si el widget nuevo no se instala: el parche
  de la § 3.3 lo arregla en el lugar.
