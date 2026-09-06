# Imposición

Cómo el arte del cliente se convierte en pliegos listos para la máquina.

`src/imposicion/` toma un PDF con el arte, la pose ya resuelta por
`src/nesting/`, y devuelve un PDF con todos los pliegos y sus marcas de
guillotina.

---

## 1. Por qué PDF y no otra cosa

La consigna es no tocar el archivo del cliente: mismos colores, misma calidad.
Eso descarta casi todo.

| Camino | Colores | Calidad | Veredicto |
|---|---|---|---|
| Rasterizar a PNG/JPG y armar el pliego | RGB (JPEG CMYK es raro y mal soportado) | Se pierde el vector, queda la resolución elegida | ✗ |
| Convertir a imagen y volver a PDF | Conversión de espacio de color | Ídem | ✗ |
| **Embeber la página PDF como Form XObject** | **Intactos** | **Intacta** | ✓ |

Embeber copia el flujo de contenido de la página tal cual, dentro de un
XObject de formulario. Los operadores de color (`k` para CMYK) siguen siendo
los mismos números, las curvas siguen siendo curvas y las imágenes conservan
su resolución y su compresión original. No hay reinterpretación en el medio.

Está verificado, no asumido: `tests/imposicion/imponer.test.js` descomprime los
flujos de contenido del PDF de salida y comprueba que los valores CMYK del
arte aparecen literalmente, que hay curvas Bézier, y que **no** hay ningún
operador RGB (`rg`/`RG`) ni ningún `/Subtype /Image` que no viniera del
original.

**Consecuencia práctica: el arte tiene que entrar en PDF.** Si el cliente
manda un JPG o un PNG, ya viene en RGB y con la resolución que tenga; se puede
imponer igual, pero la promesa de "no cambia los colores" no se sostiene,
porque el color ya se perdió antes de llegar.

### Peso

Cada página del arte se embebe **una sola vez** y se referencia N veces. Un
dorso repetido en 84 lugares pesa como un dorso, no como 84.

---

## 2. Detección de demasía

El arte a veces viene con los 3 mm por lado y a veces al tamaño exacto de
corte. Se distingue en dos niveles.

### Nivel 1 — las cajas del PDF

Un PDF de imprenta declara sus cajas de página:

| Caja | Qué es |
|---|---|
| `MediaBox` | La hoja física del archivo. |
| `TrimBox` | Dónde corta la guillotina: el tamaño final. |
| `BleedBox` | Hasta dónde llega la tinta: trim + demasía. |

Si `TrimBox` y `BleedBox` existen y difieren, la demasía está declarada y se
lee del archivo: cuánta hay y de qué lado. Es el dato autoritativo y no hay
nada que adivinar.

### Nivel 2 — la medida de la página

Cuando el archivo no declara las cajas —lo habitual en exportaciones rápidas—
se compara la medida de la página contra lo que pidió el cliente, con media
décima de milímetro de tolerancia:

```
página ≈ 76 × 126 mm  →  tiene demasía   (70 × 120 + 3 por lado)
página ≈ 70 × 120 mm  →  no tiene demasía
cualquier otra cosa   →  se corta el trabajo y se informa
```

No se adivina: si la página no coincide con ninguna de las dos, el servicio
falla con el detalle de qué midió y contra qué lo comparó. Un archivo con la
medida equivocada es un error del pedido, no algo para resolver por promedio.

El informe dice, por cada cara, cuántas páginas cayeron en cada categoría:

```json
"demasia": { "frente": { "declarada": [1, 2, 3, …] }, "dorso": { "ausente": [1] } }
```

---

## 3. Demasía sintética por espejado

Cuando el arte viene al tamaño de corte no hay tinta para el sangrado, y
cualquier corrimiento de guillotina deja un filo blanco. La técnica del oficio
es **espejar el borde**: se refleja la banda exterior del arte hacia afuera del
corte.

La pieza se dibuja nueve veces: el arte al centro, cuatro bandas espejadas
sobre cada lado, y cuatro esquinas espejadas en los dos ejes. Cada copia va
recortada a su banda, así que dentro del corte se ve sólo el arte original.

```
┌───┬───────────┬───┐
│ ↖ │     ↑     │ ↗ │   esquinas: espejo en X e Y
├───┼───────────┼───┤
│ ← │   arte    │ → │   bandas: espejo en un eje
├───┼───────────┼───┤
│ ↙ │     ↓     │ ↘ │
└───┴───────────┴───┘
```

En PDF eso es, por banda: `q` → `re W n` (recorte) → `cm` con la reflexión
(`x' = 2·eje − x`) → `Do` → `Q`.

**Funciona muy bien** con fondos, texturas, degradés y bordes ornamentales —el
caso de un naipe—. **Puede quedar mal** si el arte tiene un motivo reconocible
pegado al corte, porque se ve el reflejo.

Por eso:

- El informe marca **siempre** qué páginas necesitaron demasía sintética y
  agrega una advertencia. No es una operación silenciosa.
- `demasiaSintetica: "nunca"` corta el trabajo en vez de espejar, para cuando
  se prefiere pedirle el archivo bien al cliente.

Lo mejor sigue siendo pedir el arte con los 3 mm. El espejado es la red.

---

## 4. Marcas de corte

Van en **negro de registro**: CMYK 100/100/100/100. Sale en las cuatro
planchas, así que la marca se ve negra aunque el registro de la máquina se
corra un pelo. Un negro plano (0/0/0/100) sale sólo en la plancha del negro y
es más difícil de encontrar contra el arte.

La geometría es la misma que calcula `src/nesting/`: dos líneas de trim por
calle, una sola en los bordes exteriores del bloque, ticks de 5 mm confinados
al margen. Ver [NESTING.md](NESTING.md) § 2.

---

## 5. Pliegos incompletos

78 cartas en pliegos de 12 dan 7 pliegos: 84 lugares, 6 vacíos. Los lugares
sobrantes quedan en blanco, y **el dorso tampoco se imprime ahí**.

Las marcas de corte se dibujan igual, completas: la guillotina corta el pliego
entero de una pasada, así que las líneas tienen que estar aunque de ese lado
no haya carta.

---

## 6. Doble faz

El dorso puede ser:

- **Una página** → se repite en todas las piezas.
- **N páginas, igual que el frente** → una por pieza, en el mismo orden.

Cualquier otra cantidad corta el trabajo con un mensaje que dice qué esperaba.

El dorso se espeja sobre el eje de volteo, igual que en la pose: cada frente
cae exactamente sobre su propio dorso cuando se da vuelta el pliego. Ver
[NESTING.md](NESTING.md) § 4.

---

## 7. Uso

### Por línea de comandos

Corre en la máquina, sin el límite de 32 MB que tiene Cloud Run para el cuerpo
de una request:

```bash
node bin/imponer.js \
  --frente cartas.pdf \
  --dorso dorso.pdf \
  --pieza 70x120 \
  --pliego 320x470 \
  --salida pliegos.pdf
```

```
pliegos.pdf
  piezas                   78
  por pliego               12 (4 × 3)
  pliegos                  7 (6 lugares vacíos)
  caras                    frente + dorso
  páginas del PDF          14
  marcas por pliego        28
  registro frente/dorso    coincide
  demasía frente           declarada: 78 pág.
  demasía dorso            declarada: 1 pág.
```

`node bin/imponer.js` sin argumentos lista todas las opciones.

### Desde código

```js
import { imponer } from './src/imposicion/imponer.js';

const { pdf, informe } = await imponer({
  frente: await readFile('cartas.pdf'),
  dorso: await readFile('dorso.pdf'),
  pieza: { ancho: 70, alto: 120 },
  pliego: { ancho: 320, alto: 470 },
  sangrado: 3,
});
```

---

## 8. Lo que falta

- **Subida por el sitio.** Cloud Run corta el cuerpo de una request en 32 MB y
  un mazo en alta lo pasa holgado. La salida es subir a Cloud Storage con URL
  firmada y que el servicio lea de ahí. Hasta entonces, la CLI.
- **Perfil ICC de salida.** El arte conserva su color, pero el PDF armado no
  declara un OutputIntent. Para PDF/X habría que incorporarlo.
- **Arte que no sea PDF.** Un JPG o un PNG se pueden imponer, pero ya vienen en
  RGB: la promesa de no tocar el color no aplica.
- **Rotación de piezas dentro del pliego.** Hoy todas las piezas van en la
  misma orientación que decide la pose. Un trabajo que necesite alternar
  (cabeza con cabeza, para ahorrar papel en piezas trapezoidales) no está
  contemplado.
