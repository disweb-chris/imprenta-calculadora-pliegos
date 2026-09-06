/* Generado por `npm run build:web` desde src/. No editar a mano. */
var IOPose = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/web/entrada.js
  var entrada_exports = {};
  __export(entrada_exports, {
    calcularDesdeElSitio: () => calcularDesdeElSitio,
    calcularPose: () => calcularPose,
    calcularPoseDobleFaz: () => calcularPoseDobleFaz,
    desdeContratoDelSitio: () => desdeContratoDelSitio,
    generarSVG: () => generarSVG,
    resolverTrabajo: () => resolverTrabajo
  });

  // src/config/defaults.js
  var PLIEGO_POR_DEFECTO = Object.freeze({ ancho: 320, alto: 470 });
  var PARAMETROS_POR_DEFECTO = Object.freeze({
    sangrado: 3,
    espaciado: 0,
    margenMinimo: 0,
    /**
     * Distancia mínima del borde del pliego a la tinta para que entren las
     * marcas de corte. Es el largo del tick: si no hay al menos esto, la pose
     * no se puede marcar y la guillotina no tiene por dónde cortarla.
     *
     * Poner 0 devuelve la pose de máximo rendimiento teórico, que es lo que
     * calcula hoy el sitio; el 27% de esas poses no se puede marcar.
     */
    margenMarcas: 5,
    permitirRotacion: true,
    estrategia: "shelf"
  });
  var PERFILES_SOPORTE = Object.freeze({
    hoja: Object.freeze({ sangrado: 3, espaciado: 0, margenMinimo: 0, margenMarcas: 5 }),
    rollo: Object.freeze({ sangrado: 3, espaciado: 6, margenMinimo: 0, margenMarcas: 5 })
  });
  var MARCAS = Object.freeze({
    /** Largo del tick, en mm. */
    largo: 5,
    /** Grosor del trazo en puntos tipográficos (0.25 pt ≈ 0.0882 mm). */
    grosorPt: 0.25
  });
  var EJE_VOLTEO_POR_DEFECTO = "vertical";
  var EJES_VOLTEO = Object.freeze(["vertical", "horizontal"]);
  var IVA = 0.21;
  var MERMA_POR_DEFECTO = 2;

  // src/nesting/validacion.js
  var ErrorDePose = class extends Error {
    constructor(mensaje, campo) {
      super(mensaje);
      this.name = "ErrorDePose";
      this.campo = campo;
      this.esErrorDePose = true;
    }
  };
  function exigirNumero(valor, campo, { min = 0, permitirCero = true } = {}) {
    if (typeof valor !== "number" || !Number.isFinite(valor)) {
      throw new ErrorDePose(`"${campo}" tiene que ser un n\xFAmero en mil\xEDmetros.`, campo);
    }
    if (valor < min || !permitirCero && valor === 0) {
      const limite = permitirCero ? `mayor o igual a ${min}` : `mayor que ${min}`;
      throw new ErrorDePose(`"${campo}" tiene que ser ${limite}. Recibido: ${valor}.`, campo);
    }
    return valor;
  }
  function exigirRectangulo(rect, campo) {
    if (!rect || typeof rect !== "object") {
      throw new ErrorDePose(`Falta "${campo}": esperaba { ancho, alto } en mil\xEDmetros.`, campo);
    }
    exigirNumero(rect.ancho, `${campo}.ancho`, { min: 0, permitirCero: false });
    exigirNumero(rect.alto, `${campo}.alto`, { min: 0, permitirCero: false });
    return { ancho: rect.ancho, alto: rect.alto };
  }
  function validarParametros(params = {}, defaults) {
    var _a, _b, _c, _d, _e, _f;
    const pliego = exigirRectangulo((_a = params.pliego) != null ? _a : defaults.pliego, "pliego");
    const pieza = exigirRectangulo(params.pieza, "pieza");
    const sangrado = exigirNumero((_b = params.sangrado) != null ? _b : defaults.sangrado, "sangrado");
    const espaciado = exigirNumero((_c = params.espaciado) != null ? _c : defaults.espaciado, "espaciado");
    const margenMinimo = exigirNumero((_d = params.margenMinimo) != null ? _d : defaults.margenMinimo, "margenMinimo");
    const margenMarcas = exigirNumero((_e = params.margenMarcas) != null ? _e : defaults.margenMarcas, "margenMarcas");
    const margenEfectivo = Math.max(margenMinimo, margenMarcas);
    const permitirRotacion = (_f = params.permitirRotacion) != null ? _f : defaults.permitirRotacion;
    if (typeof permitirRotacion !== "boolean") {
      throw new ErrorDePose('"permitirRotacion" tiene que ser true o false.', "permitirRotacion");
    }
    if (margenEfectivo > 0 && (margenEfectivo * 2 >= pliego.ancho || margenEfectivo * 2 >= pliego.alto)) {
      throw new ErrorDePose(
        `Un margen de ${margenEfectivo} mm no deja \xE1rea \xFAtil en un pliego de ${pliego.ancho}\xD7${pliego.alto} mm.`,
        "margenMinimo"
      );
    }
    return { pliego, pieza, sangrado, espaciado, margenMinimo, margenMarcas, margenEfectivo, permitirRotacion };
  }
  function validarEjeVolteo(eje, porDefecto) {
    const resuelto = eje != null ? eje : porDefecto;
    if (!EJES_VOLTEO.includes(resuelto)) {
      throw new ErrorDePose(
        `"ejeVolteo" tiene que ser uno de: ${EJES_VOLTEO.join(", ")}. Recibido: "${resuelto}".`,
        "ejeVolteo"
      );
    }
    return resuelto;
  }

  // src/nesting/shelf.js
  function contar({ medida, lado, sangrado, espaciado, margenEfectivo }) {
    const pitch = lado + sangrado * 2 + espaciado;
    if (pitch <= 0) return 0;
    const disponible = medida - margenEfectivo * 2 + espaciado;
    if (disponible <= 0) return 0;
    return Math.max(0, Math.floor(disponible / pitch));
  }
  function calcularGrilla({ pliego, pieza, sangrado, espaciado, margenEfectivo }) {
    const columnas = contar({ medida: pliego.ancho, lado: pieza.ancho, sangrado, espaciado, margenEfectivo });
    const filas = contar({ medida: pliego.alto, lado: pieza.alto, sangrado, espaciado, margenEfectivo });
    return { columnas, filas, cantidad: columnas * filas };
  }
  var anchoDeTinta = (n2, lado, sangrado, espaciado) => n2 > 0 ? n2 * (lado + sangrado * 2) + (n2 - 1) * espaciado : 0;
  function resolverShelf({ pliego, pieza, sangrado, espaciado, margenEfectivo, permitirRotacion }) {
    const candidatos = [{ rotada: false, piezaEfectiva: { ancho: pieza.ancho, alto: pieza.alto } }];
    if (permitirRotacion && pieza.ancho !== pieza.alto) {
      candidatos.push({ rotada: true, piezaEfectiva: { ancho: pieza.alto, alto: pieza.ancho } });
    }
    let mejor = null;
    for (const candidato of candidatos) {
      const grilla = calcularGrilla({
        pliego,
        pieza: candidato.piezaEfectiva,
        sangrado,
        espaciado,
        margenEfectivo
      });
      if (!mejor || grilla.cantidad > mejor.cantidad) mejor = { ...grilla, ...candidato };
    }
    const { piezaEfectiva, columnas, filas } = mejor;
    const alternativas = {
      normal: calcularGrilla({ pliego, pieza, sangrado, espaciado, margenEfectivo }),
      rotada: calcularGrilla({
        pliego,
        pieza: { ancho: pieza.alto, alto: pieza.ancho },
        sangrado,
        espaciado,
        margenEfectivo
      })
    };
    return {
      ...mejor,
      alternativas,
      orientacion: piezaEfectiva.alto >= piezaEfectiva.ancho ? "vertical" : "horizontal",
      tinta: {
        ancho: anchoDeTinta(columnas, piezaEfectiva.ancho, sangrado, espaciado),
        alto: anchoDeTinta(filas, piezaEfectiva.alto, sangrado, espaciado)
      }
    };
  }

  // src/nesting/layout.js
  var redondear = (n2) => Math.round(n2 * 1e4) / 1e4;
  function calcularBloque({ pliego, piezaEfectiva, columnas, filas, sangrado, espaciado }) {
    const calle = sangrado * 2 + espaciado;
    const tintaAncho = columnas > 0 ? columnas * (piezaEfectiva.ancho + sangrado * 2) + (columnas - 1) * espaciado : 0;
    const tintaAlto = filas > 0 ? filas * (piezaEfectiva.alto + sangrado * 2) + (filas - 1) * espaciado : 0;
    const trimAncho = columnas > 0 ? columnas * piezaEfectiva.ancho + (columnas - 1) * calle : 0;
    const trimAlto = filas > 0 ? filas * piezaEfectiva.alto + (filas - 1) * calle : 0;
    const margenSangradoX = (pliego.ancho - tintaAncho) / 2;
    const margenSangradoY = (pliego.alto - tintaAlto) / 2;
    return {
      /** Bloque de líneas de corte: de la primera a la última. */
      ancho: redondear(trimAncho),
      alto: redondear(trimAlto),
      /** Bloque de tinta: incluye el sangrado exterior. */
      tinta: { ancho: redondear(tintaAncho), alto: redondear(tintaAlto) },
      margenIzquierdo: redondear(margenSangradoX + sangrado),
      margenDerecho: redondear(margenSangradoX + sangrado),
      margenSuperior: redondear(margenSangradoY + sangrado),
      margenInferior: redondear(margenSangradoY + sangrado),
      margenSangrado: {
        izquierdo: redondear(margenSangradoX),
        derecho: redondear(margenSangradoX),
        superior: redondear(margenSangradoY),
        inferior: redondear(margenSangradoY)
      }
    };
  }
  function generarPosiciones({ bloque, piezaEfectiva, columnas, filas, calle, rotada, sangrado }) {
    const pitchX = piezaEfectiva.ancho + calle;
    const pitchY = piezaEfectiva.alto + calle;
    const posiciones = [];
    for (let fila = 0; fila < filas; fila += 1) {
      for (let columna = 0; columna < columnas; columna += 1) {
        const x = redondear(bloque.margenIzquierdo + columna * pitchX);
        const y = redondear(bloque.margenSuperior + fila * pitchY);
        posiciones.push({
          indice: fila * columnas + columna,
          fila,
          columna,
          x,
          y,
          ancho: piezaEfectiva.ancho,
          alto: piezaEfectiva.alto,
          rotada,
          sangradoCaja: {
            x: redondear(x - sangrado),
            y: redondear(y - sangrado),
            ancho: redondear(piezaEfectiva.ancho + sangrado * 2),
            alto: redondear(piezaEfectiva.alto + sangrado * 2)
          }
        });
      }
    }
    return posiciones;
  }
  function generarMarcasCorte({ bloque, piezaEfectiva, columnas, filas, calle }) {
    const pitchX = piezaEfectiva.ancho + calle;
    const pitchY = piezaEfectiva.alto + calle;
    const verticales = [];
    for (let c = 0; c < columnas; c += 1) {
      const izquierda = bloque.margenIzquierdo + c * pitchX;
      verticales.push(redondear(izquierda), redondear(izquierda + piezaEfectiva.ancho));
    }
    const horizontales = [];
    for (let f = 0; f < filas; f += 1) {
      const arriba = bloque.margenSuperior + f * pitchY;
      horizontales.push(redondear(arriba), redondear(arriba + piezaEfectiva.alto));
    }
    return { verticales, horizontales };
  }
  function generarTicks({ pliego, bloque, marcasCorte, largo = MARCAS.largo }) {
    const ticks = [];
    const m = bloque.margenSangrado;
    for (const x of marcasCorte.verticales) {
      ticks.push({ orientacion: "vertical", borde: "superior", x1: x, y1: redondear(m.superior - largo), x2: x, y2: redondear(m.superior) });
      ticks.push({ orientacion: "vertical", borde: "inferior", x1: x, y1: redondear(pliego.alto - m.inferior), x2: x, y2: redondear(pliego.alto - m.inferior + largo) });
    }
    for (const y of marcasCorte.horizontales) {
      ticks.push({ orientacion: "horizontal", borde: "izquierdo", x1: redondear(m.izquierdo - largo), y1: y, x2: redondear(m.izquierdo), y2: y });
      ticks.push({ orientacion: "horizontal", borde: "derecho", x1: redondear(pliego.ancho - m.derecho), y1: y, x2: redondear(pliego.ancho - m.derecho + largo), y2: y });
    }
    return ticks;
  }
  function revisarEspacioDeMarcas({ bloque, largo = MARCAS.largo }) {
    const m = bloque.margenSangrado;
    const advertencias = [];
    if (m.izquierdo < largo || m.derecho < largo) {
      advertencias.push(
        `Del borde del pliego a la tinta quedan ${m.izquierdo} mm a los costados, menos que los ${largo} mm del tick: las marcas de corte horizontales se recortan contra el borde.`
      );
    }
    if (m.superior < largo || m.inferior < largo) {
      advertencias.push(
        `Del borde del pliego a la tinta quedan ${m.superior} mm arriba y abajo, menos que los ${largo} mm del tick: las marcas de corte verticales se recortan contra el borde.`
      );
    }
    return advertencias;
  }

  // src/nesting/pose.js
  var redondear2 = (n2, d = 4) => Math.round(n2 * 10 ** d) / 10 ** d;
  var ESTRATEGIAS = {
    shelf: resolverShelf
  };
  var estrategiasDisponibles = () => Object.keys(ESTRATEGIAS);
  function calcularPose(params = {}) {
    var _a;
    const estrategia = (_a = params.estrategia) != null ? _a : PARAMETROS_POR_DEFECTO.estrategia;
    const resolver = ESTRATEGIAS[estrategia];
    if (!resolver) {
      throw new ErrorDePose(
        `Estrategia "${estrategia}" desconocida. Disponibles: ${estrategiasDisponibles().join(", ")}.`,
        "estrategia"
      );
    }
    const cfg = validarParametros(params, { ...PARAMETROS_POR_DEFECTO, pliego: PLIEGO_POR_DEFECTO });
    const { pliego, pieza, sangrado, espaciado, margenMinimo, margenMarcas, margenEfectivo, permitirRotacion } = cfg;
    const grilla = resolver({ pliego, pieza, sangrado, espaciado, margenEfectivo, permitirRotacion });
    const { columnas, filas, cantidad, rotada, piezaEfectiva, orientacion, alternativas } = grilla;
    if (cantidad <= 0) {
      throw new ErrorDePose(
        `La pieza de ${pieza.ancho}\xD7${pieza.alto} mm con ${sangrado} mm de demas\xEDa por lado no entra en un pliego de ${pliego.ancho}\xD7${pliego.alto} mm` + (margenEfectivo > 0 ? ` dejando ${margenEfectivo} mm por lado` + (margenEfectivo === margenMarcas && margenMarcas > margenMinimo ? " para las marcas de corte." : " de margen.") : "."),
        "pieza"
      );
    }
    const calle = redondear2(sangrado * 2 + espaciado);
    const bloque = calcularBloque({ pliego, piezaEfectiva, columnas, filas, sangrado, espaciado });
    const posiciones = generarPosiciones({ bloque, piezaEfectiva, columnas, filas, calle, rotada, sangrado });
    const marcasCorte = generarMarcasCorte({ bloque, piezaEfectiva, columnas, filas, calle });
    const ticks = generarTicks({ pliego, bloque, marcasCorte });
    const advertencias = revisarEspacioDeMarcas({ bloque });
    const areaPliego = pliego.ancho * pliego.alto;
    const areaUtil = cantidad * pieza.ancho * pieza.alto;
    return {
      estrategia,
      cantidad,
      orientacion,
      rotada,
      columnas,
      filas,
      alternativas,
      aprovechamiento: redondear2(areaUtil / areaPliego, 4),
      desperdicio_mm2: redondear2(areaPliego - areaUtil, 2),
      pliego,
      pieza,
      piezaEfectiva,
      /** La pieza tal como la ve la máquina: trim + demasía a los cuatro lados. */
      piezaConSangrado: {
        ancho: redondear2(piezaEfectiva.ancho + sangrado * 2),
        alto: redondear2(piezaEfectiva.alto + sangrado * 2)
      },
      parametros: { sangrado, espaciado, margenMinimo, margenMarcas, margenEfectivo, permitirRotacion, calle },
      bloque,
      pitch: { x: redondear2(piezaEfectiva.ancho + calle), y: redondear2(piezaEfectiva.alto + calle) },
      posiciones,
      marcasCorte,
      ticks,
      totalLineasDeMarca: marcasCorte.verticales.length + marcasCorte.horizontales.length,
      totalMarcas: (marcasCorte.verticales.length + marcasCorte.horizontales.length) * 2,
      marcas: { largo: MARCAS.largo, grosorPt: MARCAS.grosorPt },
      advertencias
    };
  }

  // src/nesting/dobleFaz.js
  var redondear3 = (n2, d = 4) => Math.round(n2 * 10 ** d) / 10 ** d;
  var TOLERANCIA_REGISTRO = 0.01;
  function espejarPosicion(pos, { pliego, ejeVolteo, columnas, filas }) {
    if (ejeVolteo === "vertical") {
      return {
        ...pos,
        columna: columnas - 1 - pos.columna,
        x: redondear3(pliego.ancho - (pos.x + pos.ancho)),
        sangradoCaja: {
          ...pos.sangradoCaja,
          x: redondear3(pliego.ancho - (pos.sangradoCaja.x + pos.sangradoCaja.ancho))
        }
      };
    }
    return {
      ...pos,
      fila: filas - 1 - pos.fila,
      y: redondear3(pliego.alto - (pos.y + pos.alto)),
      sangradoCaja: {
        ...pos.sangradoCaja,
        y: redondear3(pliego.alto - (pos.sangradoCaja.y + pos.sangradoCaja.alto))
      }
    };
  }
  function espejarMarcas(marcasCorte, { pliego, ejeVolteo }) {
    if (ejeVolteo === "vertical") {
      return {
        verticales: marcasCorte.verticales.map((x) => redondear3(pliego.ancho - x)).sort((a, b) => a - b),
        horizontales: [...marcasCorte.horizontales]
      };
    }
    return {
      verticales: [...marcasCorte.verticales],
      horizontales: marcasCorte.horizontales.map((y) => redondear3(pliego.alto - y)).sort((a, b) => a - b)
    };
  }
  function espejarBloque(bloque, ejeVolteo) {
    const s = bloque.margenSangrado;
    if (ejeVolteo === "vertical") {
      return {
        ...bloque,
        margenIzquierdo: bloque.margenDerecho,
        margenDerecho: bloque.margenIzquierdo,
        margenSangrado: { ...s, izquierdo: s.derecho, derecho: s.izquierdo }
      };
    }
    return {
      ...bloque,
      margenSuperior: bloque.margenInferior,
      margenInferior: bloque.margenSuperior,
      margenSangrado: { ...s, superior: s.inferior, inferior: s.superior }
    };
  }
  function medirRegistro(frente, dorso) {
    const desvio = (a, b) => Math.max(0, ...a.map((v, i) => Math.abs(v - b[i])));
    const desvioMaximo = redondear3(
      Math.max(
        desvio(frente.verticales, dorso.verticales),
        desvio(frente.horizontales, dorso.horizontales)
      ),
      4
    );
    return { desvioMaximo_mm: desvioMaximo, registra: desvioMaximo <= TOLERANCIA_REGISTRO };
  }
  function calcularPoseDobleFaz(params = {}) {
    const ejeVolteo = validarEjeVolteo(params.ejeVolteo, EJE_VOLTEO_POR_DEFECTO);
    const base = calcularPose(params);
    const { pliego, columnas, filas, bloque, marcasCorte, posiciones } = base;
    const posicionesDorso = posiciones.map((pos) => espejarPosicion(pos, { pliego, ejeVolteo, columnas, filas })).sort((a, b) => a.indice - b.indice);
    const marcasDorso = espejarMarcas(marcasCorte, { pliego, ejeVolteo });
    const bloqueDorso = espejarBloque(bloque, ejeVolteo);
    const ticksDorso = generarTicks({ pliego, bloque: bloqueDorso, marcasCorte: marcasDorso });
    const mapeo = posiciones.map((pos, i) => ({
      indice: pos.indice,
      frente: { fila: pos.fila, columna: pos.columna, x: pos.x, y: pos.y },
      dorso: {
        fila: posicionesDorso[i].fila,
        columna: posicionesDorso[i].columna,
        x: posicionesDorso[i].x,
        y: posicionesDorso[i].y
      }
    }));
    const ordenDorso = [...posicionesDorso].sort((a, b) => a.fila - b.fila || a.columna - b.columna).map((pos) => pos.indice);
    const { advertencias: _omitir, posiciones: _pos, marcasCorte: _marcas, ticks: _ticks, bloque: _bloque, ...comun } = base;
    return {
      ...comun,
      dobleFaz: true,
      ejeVolteo,
      bloque,
      frente: {
        cara: "frente",
        bloque,
        posiciones,
        marcasCorte,
        ticks: base.ticks,
        /** Orden de lectura izquierda→derecha, arriba→abajo. */
        orden: posiciones.map((p) => p.indice)
      },
      dorso: {
        cara: "dorso",
        bloque: bloqueDorso,
        posiciones: posicionesDorso,
        marcasCorte: marcasDorso,
        ticks: ticksDorso,
        orden: ordenDorso
      },
      mapeo,
      registro: medirRegistro(marcasCorte, marcasDorso),
      advertencias: base.advertencias
    };
  }
  function obtenerCara(pose, cara = "frente") {
    if (!pose.dobleFaz) return pose;
    if (cara !== "frente" && cara !== "dorso") {
      throw new Error(`Cara "${cara}" desconocida: esperaba "frente" o "dorso".`);
    }
    return { ...pose, ...pose[cara] };
  }

  // src/core/pliegos.js
  function calcularPliegos({ cantidadPedida, piezasPorPliego, demasia = 0, caras = 1 }) {
    if (!Number.isFinite(cantidadPedida) || cantidadPedida <= 0) {
      throw new Error('"cantidadPedida" tiene que ser un n\xFAmero mayor que cero.');
    }
    if (!Number.isFinite(piezasPorPliego) || piezasPorPliego <= 0) {
      throw new Error('"piezasPorPliego" tiene que ser un n\xFAmero mayor que cero.');
    }
    if (caras !== 1 && caras !== 2) {
      throw new Error('"caras" tiene que ser 1 (simple faz) o 2 (doble faz).');
    }
    const pliegosNetos = Math.ceil(cantidadPedida / piezasPorPliego);
    const pliegosTotales = pliegosNetos + demasia;
    return {
      pliegosNetos,
      demasia,
      pliegosTotales,
      /** Pasadas de máquina: la doble faz se imprime dos veces sobre el mismo pliego. */
      pasadas: pliegosTotales * caras,
      piezasProducidas: pliegosTotales * piezasPorPliego,
      sobrante: pliegosTotales * piezasPorPliego - cantidadPedida
    };
  }

  // src/core/precios.js
  var redondearPesos = (n2) => Math.round(n2 * 100) / 100;
  function cotizar({
    cantidad,
    pliegos,
    impresiones,
    costoPapel = 0,
    costoImpresion = 0,
    costoFijo = 0,
    porcentajeProduccion = 0,
    porcentajeGanancia = 0,
    aplicarIva = false
  }) {
    const numeros = { cantidad, pliegos, impresiones, costoPapel, costoImpresion, costoFijo, porcentajeProduccion, porcentajeGanancia };
    for (const [nombre, valor] of Object.entries(numeros)) {
      if (!Number.isFinite(valor) || valor < 0) {
        throw new Error(`"${nombre}" tiene que ser un n\xFAmero mayor o igual a cero.`);
      }
    }
    if (cantidad <= 0) throw new Error('"cantidad" tiene que ser mayor que cero.');
    const papel = pliegos * costoPapel;
    const impresion = impresiones * costoImpresion;
    const costoTotal = papel + impresion + costoFijo;
    const costoConProduccion = costoTotal * (1 + porcentajeProduccion / 100);
    const precioFinal = costoConProduccion * (1 + porcentajeGanancia / 100);
    const iva = aplicarIva ? precioFinal * IVA : 0;
    const precioFinalConIva = precioFinal + iva;
    return {
      papel: redondearPesos(papel),
      impresion: redondearPesos(impresion),
      costoFijo: redondearPesos(costoFijo),
      costoTotal: redondearPesos(costoTotal),
      costoUnitario: redondearPesos(costoTotal / cantidad),
      porcentajeProduccion,
      porcentajeGanancia,
      precioFinal: redondearPesos(precioFinal),
      precioUnitario: redondearPesos(precioFinal / cantidad),
      aplicarIva,
      iva: redondearPesos(iva),
      precioFinalConIva: redondearPesos(precioFinalConIva),
      precioUnitarioConIva: redondearPesos(precioFinalConIva / cantidad)
    };
  }

  // src/core/trabajo.js
  function calcularTrabajo({
    cantidad,
    merma = MERMA_POR_DEFECTO,
    dobleFaz = false,
    armarPose = false,
    costoPapel = 0,
    costoImpresion = 0,
    costoFijo = 0,
    porcentajeProduccion = 0,
    porcentajeGanancia = 0,
    aplicarIva = false,
    ...parametrosDePose
  }) {
    const pose = dobleFaz && armarPose ? calcularPoseDobleFaz(parametrosDePose) : calcularPose(parametrosDePose);
    const pliegos = calcularPliegos({
      cantidadPedida: cantidad,
      piezasPorPliego: pose.cantidad,
      demasia: merma,
      caras: dobleFaz ? 2 : 1
    });
    const cotizacion = cotizar({
      cantidad,
      pliegos: pliegos.pliegosTotales,
      impresiones: pliegos.pasadas,
      costoPapel,
      costoImpresion,
      costoFijo,
      porcentajeProduccion,
      porcentajeGanancia,
      aplicarIva
    });
    return {
      dobleFaz,
      piezasPorPliego: pose.cantidad,
      pose: armarPose ? pose : resumenDePose(pose),
      pliegos,
      cotizacion
    };
  }
  function resumenDePose(pose) {
    return {
      cantidad: pose.cantidad,
      columnas: pose.columnas,
      filas: pose.filas,
      rotada: pose.rotada,
      orientacion: pose.orientacion,
      piezaConSangrado: pose.piezaConSangrado,
      aprovechamiento: pose.aprovechamiento,
      bloque: pose.bloque,
      alternativas: pose.alternativas,
      advertencias: pose.advertencias
    };
  }

  // src/core/unidades.js
  var cmAmm = (cm) => cm * 10;
  function desdeCalculadora({ sheetW, sheetH, itemW, itemH, bleed = 3, gutter = 0, ...resto }) {
    return {
      pliego: { ancho: cmAmm(sheetW), alto: cmAmm(sheetH) },
      pieza: { ancho: cmAmm(itemW), alto: cmAmm(itemH) },
      sangrado: bleed,
      espaciado: gutter,
      ...resto
    };
  }

  // src/nesting/svg.js
  var AZUL = "#2e509e";
  var NARANJA = "#FF6B00";
  var BLANCO = "#ffffff";
  var NEGRO_REGISTRO = "#000000";
  var PT_A_MM = 25.4 / 72;
  var n = (v) => Number(v.toFixed(4));
  function generarSVG(pose, opciones = {}) {
    var _a;
    const { modo = "preview", cara = "frente", numerarPiezas = false } = opciones;
    if (modo !== "preview" && modo !== "produccion") {
      throw new Error(`Modo "${modo}" desconocido: esperaba "preview" o "produccion".`);
    }
    const capa = obtenerCara(pose, cara);
    const { pliego } = pose;
    const esProduccion = modo === "produccion";
    const grosor = n(esProduccion ? MARCAS.grosorPt * PT_A_MM : Math.max(pliego.ancho, pliego.alto) / 400);
    const colorMarca = esProduccion ? NEGRO_REGISTRO : NARANJA;
    const partes = [];
    partes.push(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${pliego.ancho}mm" height="${pliego.alto}mm" viewBox="0 0 ${pliego.ancho} ${pliego.alto}">`
    );
    partes.push(`<rect x="0" y="0" width="${pliego.ancho}" height="${pliego.alto}" fill="${BLANCO}"/>`);
    if (!esProduccion) {
      partes.push(
        `<rect x="0" y="0" width="${pliego.ancho}" height="${pliego.alto}" fill="none" stroke="${AZUL}" stroke-width="${grosor}"/>`
      );
      const b = capa.bloque;
      partes.push(
        `<rect x="${n(b.margenIzquierdo)}" y="${n(b.margenSuperior)}" width="${n(b.ancho)}" height="${n(b.alto)}" fill="none" stroke="${AZUL}" stroke-width="${grosor}" stroke-dasharray="${n(grosor * 4)} ${n(grosor * 4)}" opacity="0.6"/>`
      );
    }
    partes.push('<g id="piezas">');
    for (const p of capa.posiciones) {
      if (esProduccion) {
        partes.push(
          `<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.ancho)}" height="${n(p.alto)}" fill="none" stroke="${NEGRO_REGISTRO}" stroke-width="${grosor}"/>`
        );
      } else {
        partes.push(
          `<rect x="${n(p.sangradoCaja.x)}" y="${n(p.sangradoCaja.y)}" width="${n(p.sangradoCaja.ancho)}" height="${n(p.sangradoCaja.alto)}" fill="${AZUL}" opacity="0.15"/>`
        );
        partes.push(
          `<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(p.ancho)}" height="${n(p.alto)}" fill="${AZUL}" opacity="0.35" stroke="${AZUL}" stroke-width="${grosor}"/>`
        );
      }
    }
    partes.push("</g>");
    partes.push('<g id="marcas-de-corte">');
    for (const t of capa.ticks) {
      partes.push(
        `<line x1="${n(t.x1)}" y1="${n(t.y1)}" x2="${n(t.x2)}" y2="${n(t.y2)}" stroke="${colorMarca}" stroke-width="${grosor}"/>`
      );
    }
    partes.push("</g>");
    if (numerarPiezas) {
      partes.push('<g id="numeracion" font-family="monospace" text-anchor="middle">');
      for (const p of capa.posiciones) {
        const tamano = n(Math.min(p.ancho, p.alto) * 0.25);
        partes.push(
          `<text x="${n(p.x + p.ancho / 2)}" y="${n(p.y + p.alto / 2 + tamano * 0.35)}" font-size="${tamano}" fill="${esProduccion ? NEGRO_REGISTRO : AZUL}">${p.indice + 1}</text>`
        );
      }
      partes.push("</g>");
    }
    if (!esProduccion) {
      const etiqueta = pose.dobleFaz ? `${(_a = capa.cantidad) != null ? _a : pose.cantidad} \u2014 ${cara}` : `${pose.cantidad}`;
      partes.push(
        `<text x="${n(pliego.ancho / 2)}" y="${n(pliego.alto - 2)}" text-anchor="middle" font-family="monospace" font-size="4" fill="${AZUL}">${etiqueta}</text>`
      );
    }
    partes.push("</svg>");
    return partes.join("\n");
  }

  // src/core/compat.js
  function desdeContratoDelSitio(body = {}) {
    const {
      sheetW,
      sheetH,
      itemW,
      itemH,
      bleed,
      gutter,
      extraSheets,
      qty,
      doubleFace,
      costPaper,
      costPrint,
      costSetup,
      prodPct,
      profitPct,
      applyVat,
      // Etiquetas de la UI: no entran al cálculo.
      paperType: _paperType,
      paperSize: _paperSize,
      currency: _currency,
      ...resto
    } = body;
    return {
      ...desdeCalculadora({ sheetW, sheetH, itemW, itemH, bleed, gutter }),
      cantidad: qty,
      merma: extraSheets,
      dobleFaz: !!doubleFace,
      costoPapel: costPaper,
      costoImpresion: costPrint,
      costoFijo: costSetup,
      porcentajeProduccion: prodPct,
      porcentajeGanancia: profitPct,
      aplicarIva: !!applyVat,
      ...resto
    };
  }
  function resolverTrabajo(entrada) {
    const { incluirSvg = false, modoSvg = "preview", ...resto } = entrada;
    if (!incluirSvg) return calcularTrabajo(resto);
    const trabajo = calcularTrabajo({ ...resto, armarPose: true });
    const opciones = { modo: modoSvg, numerarPiezas: trabajo.pose.dobleFaz && modoSvg === "preview" };
    const svg = trabajo.pose.dobleFaz ? {
      frente: generarSVG(trabajo.pose, { ...opciones, cara: "frente" }),
      dorso: generarSVG(trabajo.pose, { ...opciones, cara: "dorso" })
    } : { unica: generarSVG(trabajo.pose, opciones) };
    return { ...trabajo, svg };
  }
  function calcularDesdeElSitio(body = {}) {
    if (body.sheetW === void 0 || body.itemW === void 0) {
      throw new ErrorDePose("Faltan las medidas: esperaba sheetW/sheetH e itemW/itemH en cent\xEDmetros.", "sheetW");
    }
    return resolverTrabajo(desdeContratoDelSitio(body));
  }
  return __toCommonJS(entrada_exports);
})();
