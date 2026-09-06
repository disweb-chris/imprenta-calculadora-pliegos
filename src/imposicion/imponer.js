/**
 * Imposición: toma el arte del cliente y devuelve los pliegos listos para
 * imprimir, con las marcas de guillotina.
 *
 * El arte se **embebe**, no se re-dibuja: cada página del PDF de origen entra
 * al pliego como un Form XObject, que es una copia literal de su flujo de
 * contenido. Los colores CMYK siguen siendo los mismos números, los vectores
 * siguen siendo vectores y las imágenes conservan su resolución. Es la única
 * forma de imponer sin tocar el archivo del cliente.
 *
 * Un mazo de 78 cartas en pliegos de 12 da 7 pliegos (84 lugares, 6 vacíos).
 * El dorso puede ser una sola página que se repite, o una por carta.
 */

import { PDFDocument } from 'pdf-lib';
import { calcularPose } from '../nesting/pose.js';
import { calcularPoseDobleFaz, obtenerCara } from '../nesting/dobleFaz.js';
import { ErrorDePose } from '../nesting/validacion.js';
import { analizarPagina, resumirAnalisis } from './documento.js';
import { dibujarConDemasiaEspejada, dibujarConDemasiaPropia } from './demasia.js';
import { dibujarMarcas } from './marcas.js';
import { mmApt } from './unidades.js';

/**
 * @param {object} params
 * @param {Uint8Array} params.frente         PDF con el arte de las caras.
 * @param {Uint8Array} [params.dorso]        PDF del dorso. Una página = se repite.
 * @param {{ancho:number,alto:number}} params.pieza   Tamaño de corte, en mm.
 * @param {"vertical"|"horizontal"} [params.ejeVolteo]
 * @param {"auto"|"siempre"|"nunca"} [params.demasiaSintetica="auto"]
 *        Qué hacer con las páginas que vengan sin demasía. "auto" la genera
 *        espejando el borde; "nunca" corta el trabajo y lo informa.
 * @param {boolean} [params.marcas=true]
 *
 * Más los parámetros de `calcularPose`: pliego, sangrado, espaciado, etc.
 *
 * @returns {Promise<{pdf:Uint8Array, informe:object}>}
 */
export async function imponer({
  frente,
  dorso,
  demasiaSintetica = 'auto',
  marcas = true,
  ejeVolteo,
  ...parametrosDePose
}) {
  if (!frente) throw new ErrorDePose('Falta el PDF del frente.', 'frente');

  const origenFrente = await cargar(frente, 'frente');
  const origenDorso = dorso ? await cargar(dorso, 'dorso') : null;

  const pose = dorso
    ? calcularPoseDobleFaz({ ...parametrosDePose, ejeVolteo })
    : calcularPose(parametrosDePose);

  const porPliego = pose.cantidad;
  const totalPiezas = origenFrente.getPageCount();
  const pliegos = Math.ceil(totalPiezas / porPliego);

  if (origenDorso) {
    const nDorso = origenDorso.getPageCount();
    if (nDorso !== 1 && nDorso !== totalPiezas) {
      throw new ErrorDePose(
        `El dorso tiene ${nDorso} páginas: esperaba 1 (el mismo dorso para todas) ` +
          `o ${totalPiezas} (uno por pieza, igual que el frente).`,
        'dorso',
      );
    }
  }

  const salida = await PDFDocument.create();
  const sangradoPt = mmApt(pose.parametros.sangrado);

  const caras = [
    { nombre: 'frente', origen: origenFrente, indicePagina: (i) => i },
    origenDorso && {
      nombre: 'dorso',
      origen: origenDorso,
      indicePagina: (i) => (origenDorso.getPageCount() === 1 ? 0 : i),
    },
  ].filter(Boolean);

  // Análisis del arte, una vez por página y por cara.
  const analisis = {};
  for (const cara of caras) {
    analisis[cara.nombre] = cara.origen.getPages().map((p) =>
      analizarPagina(p, { pieza: pose.pieza, sangrado: pose.parametros.sangrado }));
  }

  const indeterminadas = Object.entries(analisis).flatMap(([cara, as]) =>
    as.map((a, i) => ({ cara, pagina: i + 1, ...a })).filter((a) => a.demasia === 'indeterminada'));
  if (indeterminadas.length) {
    const primera = indeterminadas[0];
    throw new ErrorDePose(
      `No se pudo determinar la demasía del ${primera.cara}, página ${primera.pagina}. ${primera.motivo}`,
      primera.cara,
    );
  }

  const sinDemasia = Object.entries(analisis).flatMap(([cara, as]) =>
    as.map((a, i) => ({ cara, pagina: i + 1, ...a })).filter((a) => !a.tieneDemasia));
  if (sinDemasia.length && demasiaSintetica === 'nunca') {
    throw new ErrorDePose(
      `Hay ${sinDemasia.length} página(s) sin demasía y está deshabilitada la demasía sintética. ` +
        `Pedí el arte con ${pose.parametros.sangrado} mm por lado, o permití la demasía espejada.`,
      'demasiaSintetica',
    );
  }

  // Cada página del arte se embebe UNA sola vez y se referencia N veces: un
  // dorso repetido 84 veces no multiplica el peso del archivo.
  const embebidas = {};
  for (const cara of caras) {
    embebidas[cara.nombre] = await Promise.all(
      cara.origen.getPages().map((p, i) => salida.embedPage(p, analisis[cara.nombre][i].recorte)));
  }

  const usadas = { frente: 0, dorso: 0 };

  for (let pliego = 0; pliego < pliegos; pliego += 1) {
    const desde = pliego * porPliego;
    const enEstePliego = Math.min(porPliego, totalPiezas - desde);

    for (const cara of caras) {
      const capa = obtenerCara(pose, cara.nombre);
      const hoja = salida.addPage([mmApt(pose.pliego.ancho), mmApt(pose.pliego.alto)]);
      hoja.setTrimBox(0, 0, mmApt(pose.pliego.ancho), mmApt(pose.pliego.alto));

      for (const posicion of capa.posiciones) {
        if (posicion.indice >= enEstePliego) continue; // pliego incompleto: se deja vacío

        const iArte = cara.indicePagina(desde + posicion.indice);
        const arte = embebidas[cara.nombre][iArte];
        const info = analisis[cara.nombre][iArte];
        const destino = aPuntos(posicion, pose.pliego.alto);

        if (info.tieneDemasia) dibujarConDemasiaPropia(hoja, arte, destino, sangradoPt);
        else dibujarConDemasiaEspejada(hoja, arte, destino, sangradoPt);

        usadas[cara.nombre] += 1;
      }

      if (marcas) dibujarMarcas(hoja, { ...pose, ...capa }, pose.marcas);
    }
  }

  return {
    pdf: await salida.save(),
    informe: {
      piezas: totalPiezas,
      piezasPorPliego: porPliego,
      pliegos,
      caras: caras.map((c) => c.nombre),
      paginasDelPdf: salida.getPageCount(),
      lugaresVacios: pliegos * porPliego - totalPiezas,
      grilla: { columnas: pose.columnas, filas: pose.filas },
      pliego: pose.pliego,
      pieza: pose.pieza,
      ejeVolteo: pose.ejeVolteo ?? null,
      registro: pose.registro ?? null,
      marcasPorPliego: marcas ? pose.totalMarcas : 0,
      demasia: Object.fromEntries(Object.entries(analisis).map(([cara, as]) => [cara, resumirAnalisis(as)])),
      demasiaSintetica: sinDemasia.map((s) => ({ cara: s.cara, pagina: s.pagina })),
      advertencias: [
        ...pose.advertencias,
        ...(sinDemasia.length
          ? [`${sinDemasia.length} página(s) vinieron sin demasía y se generó espejando el borde. ` +
             'Revisá esas piezas antes de mandar a imprimir.']
          : []),
      ],
    },
  };
}

/** Pasa una posición de la pose (origen arriba-izquierda, mm) a puntos PDF. */
function aPuntos(posicion, altoPliegoMm) {
  return {
    x: mmApt(posicion.x),
    y: mmApt(altoPliegoMm - posicion.y - posicion.alto),
    ancho: mmApt(posicion.ancho),
    alto: mmApt(posicion.alto),
  };
}

async function cargar(bytes, campo) {
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
    if (doc.getPageCount() === 0) throw new Error('vacío');
    return doc;
  } catch (e) {
    throw new ErrorDePose(
      `No se pudo leer el PDF del ${campo}: ${e.message}. ` +
        'Tiene que ser un PDF sin contraseña.',
      campo,
    );
  }
}
