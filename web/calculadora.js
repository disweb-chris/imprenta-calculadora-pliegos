/**
 * Calculadora de pliegos — cliente del servicio io-calculadora-pliegos.
 *
 * Reemplaza al script que calculaba en el navegador. El HTML y el CSS del
 * widget no cambian: mismos `name` de campo, misma clave de localStorage,
 * mismas filas de resultado. Lo único que cambia es de dónde salen los
 * números — ahora del servicio, que es el que tiene los tests.
 *
 * Agrega el preview de la pose con las marcas de corte, que es lo que la
 * versión anterior no podía hacer.
 *
 * Configuración: `data-api="https://…"` en el contenedor `.io-pliegos-calc`,
 * o `window.IO_CALC_API`. Sin nada, usa el default de abajo.
 */
(function () {
  'use strict';

  var API_POR_DEFECTO = 'https://io-calculadora-pliegos-919246442188.us-central1.run.app';
  var DEBOUNCE_MS = 300;
  var CLAVE_ESTADO = 'io_pc_state_inline_v2';

  function q(root, sel) { return root.querySelector(sel); }
  function qa(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
  function valor(root, nombre) { var el = q(root, '[name="' + nombre + '"]'); return el ? el.value : ''; }
  function marcado(root, nombre) { var el = q(root, '[name="' + nombre + '"]'); return !!el && el.checked; }

  function num(v) {
    var n = parseFloat(String(v).trim().replace(/\s/g, '').replace(/,/g, '.'));
    return isFinite(n) ? n : NaN;
  }

  /** Un campo opcional vacío vale 0; uno inválido queda en NaN para que lo rechace el servicio. */
  function numOpcional(v) {
    if (String(v).trim() === '') return 0;
    return num(v);
  }

  function fmt2(n) {
    return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  }

  function escapar(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /** Estilos del panel de pose. Se inyectan una sola vez para no tocar el CSS del sitio. */
  function inyectarEstilos() {
    if (document.getElementById('io-pc-pose-css')) return;
    var st = document.createElement('style');
    st.id = 'io-pc-pose-css';
    st.textContent = [
      '.io-pliegos-calc .io-pc-pose{margin-top:12px;background:#fff;border:1px solid var(--io-border);border-radius:14px;padding:12px}',
      '.io-pliegos-calc .io-pc-pose .t{font-weight:900;font-size:13px;margin:0 0 4px}',
      '.io-pliegos-calc .io-pc-pose .d{margin:0 0 10px;font-size:11px;color:var(--io-muted);line-height:1.5}',
      '.io-pliegos-calc .io-pc-caras{display:grid;grid-template-columns:1fr;gap:10px}',
      '.io-pliegos-calc .io-pc-caras.dos{grid-template-columns:1fr 1fr}',
      '.io-pliegos-calc .io-pc-cara p{margin:0 0 6px;font-size:12px;color:var(--io-muted);font-weight:700}',
      '.io-pliegos-calc .io-pc-cara svg{width:100%;height:auto;display:block;border:1px solid var(--io-border);border-radius:8px}',
      '.io-pliegos-calc .io-pc-out.cargando{opacity:.55;transition:opacity .12s}',
      '.io-pliegos-calc .io-pc-warn{background:#FFF8E6;border:1px solid #F5D77E;color:#6B4E00;border-radius:12px;padding:10px 12px;font-size:12px;margin-top:10px}',
      '@media (max-width:600px){.io-pliegos-calc .io-pc-caras.dos{grid-template-columns:1fr}}',
    ].join('\n');
    document.head.appendChild(st);
  }

  function bind(calc) {
    inyectarEstilos();

    var api = (calc.getAttribute('data-api') || window.IO_CALC_API || API_POR_DEFECTO).replace(/\/+$/, '');
    var out = q(calc, '.io-pc-out');
    var enVuelo = null;
    var temporizador = null;

    function moneda() { return valor(calc, 'currency') || ''; }
    function plata(n) { var s = moneda(); return (s ? s + ' ' : '') + fmt2(n); }
    function error(msg) { out.innerHTML = '<div class="io-pc-err">' + escapar(msg) + '</div>'; }

    /** Arma el payload con los nombres y unidades que espera /api/calcular/compat. */
    function payload() {
      return {
        sheetW: num(valor(calc, 'sheetW')),
        sheetH: num(valor(calc, 'sheetH')),
        itemW: num(valor(calc, 'itemW')),
        itemH: num(valor(calc, 'itemH')),
        bleed: numOpcional(valor(calc, 'bleed')),
        gutter: numOpcional(valor(calc, 'gutter')),
        extraSheets: Math.max(0, Math.floor(numOpcional(valor(calc, 'extraSheets')))),
        qty: Math.ceil(num(valor(calc, 'qty'))),
        doubleFace: marcado(calc, 'doubleFace'),
        costPaper: numOpcional(valor(calc, 'costPaper')),
        costPrint: numOpcional(valor(calc, 'costPrint')),
        costSetup: numOpcional(valor(calc, 'costSetup')),
        prodPct: numOpcional(valor(calc, 'prodPct')),
        profitPct: numOpcional(valor(calc, 'profitPct')),
        applyVat: marcado(calc, 'applyVat'),
        incluirSvg: true,
      };
    }

    function etiquetaPliego() {
      var size = valor(calc, 'paperSize');
      var w = valor(calc, 'sheetW');
      var h = valor(calc, 'sheetH');
      // Siempre desde los campos, nunca desde el select: si el operador edita
      // las medidas a mano, la etiqueta tiene que seguirlas.
      if (!size || size === 'custom') return fmt2(num(w)) + ' × ' + fmt2(num(h)) + ' cm (personalizado)';
      var partes = size.split('x');
      if (partes.length === 2 && num(partes[0]) === num(w) && num(partes[1]) === num(h)) {
        return size.replace('x', ' × ') + ' cm';
      }
      return fmt2(num(w)) + ' × ' + fmt2(num(h)) + ' cm (personalizado)';
    }

    function fila(k, v, clases) {
      return '<div class="row' + (clases ? ' ' + clases : '') + '"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>';
    }

    function pintar(r) {
      var pose = r.pose;
      var pl = r.pliegos;
      var co = r.cotizacion;

      var filasIva = '';
      if (co.aplicarIva) {
        filasIva =
          fila('IVA (21%)', plata(co.iva)) +
          fila('Precio final con IVA', plata(co.precioFinalConIva), 'highlight total') +
          fila('Precio final / unidad con IVA', plata(co.precioUnitarioConIva), 'highlight');
      }

      var orientacion = pose.rotada ? 'Rotada (90°)' : 'Normal';
      var marcas = (pose.columnas + pose.filas) * 4;

      var html =
        '<div class="io-pc-box"><div class="io-pc-kv">' +
        fila('Papel', escapar(valor(calc, 'paperType') || '—')) +
        fila('Medida pliego', etiquetaPliego()) +
        fila('Pieza efectiva (con demasía)', fmt2(pose.piezaConSangrado.ancho / 10) + ' × ' + fmt2(pose.piezaConSangrado.alto / 10) + ' cm') +
        fila('Orientación', '<span class="io-pc-pill">' + orientacion + '</span>') +
        fila('Entran por pliego', pose.cantidad + ' (' + pose.columnas + ' × ' + pose.filas + ')') +
        fila('Marcas de corte', String(marcas)) +
        fila('Margen al borde', fmt2(pose.bloque.margenSangrado.izquierdo) + ' × ' + fmt2(pose.bloque.margenSangrado.superior) + ' mm') +
        fila('Pliegos base', pl.pliegosNetos) +
        fila('Merma (pliegos extra)', pl.demasia) +
        fila('Pliegos a imprimir', pl.pliegosTotales) +
        fila('Impresiones totales', pl.pasadas) +
        fila('Costo total (base)', plata(co.costoTotal)) +
        fila('Costo / unidad', plata(co.costoUnitario)) +
        fila('% Producción', fmt2(co.porcentajeProduccion) + '%') +
        fila('% Ganancia', fmt2(co.porcentajeGanancia) + '%') +
        fila('Precio final', plata(co.precioFinal), 'total') +
        fila('Precio final / unidad', plata(co.precioUnitario)) +
        filasIva +
        '</div>' +
        '<div class="io-pc-two">' +
        '<div class="io-pc-mini"><p class="t">Normal</p><p class="m">Entran: <b>' + pose.alternativas.normal.cantidad + '</b> (' + pose.alternativas.normal.columnas + '×' + pose.alternativas.normal.filas + ')</p></div>' +
        '<div class="io-pc-mini"><p class="t">Rotada (90°)</p><p class="m">Entran: <b>' + pose.alternativas.rotada.cantidad + '</b> (' + pose.alternativas.rotada.columnas + '×' + pose.alternativas.rotada.filas + ')</p></div>' +
        '</div>';

      if (pose.advertencias && pose.advertencias.length) {
        html += '<div class="io-pc-warn">' + pose.advertencias.map(escapar).join('<br>') + '</div>';
      }

      if (r.svg) {
        var caras = r.svg.unica
          ? [['Pose', r.svg.unica]]
          : [['Frente', r.svg.frente], ['Dorso', r.svg.dorso]];
        html +=
          '<div class="io-pc-pose"><p class="t">Pose con marcas de guillotina</p>' +
          '<p class="d">' + pose.columnas * 2 + ' líneas verticales + ' + pose.filas * 2 + ' horizontales, ' +
          'dos ticks por línea. Margen de tinta al borde: ' +
          fmt2(pose.bloque.margenSangrado.izquierdo) + ' mm lateral, ' +
          fmt2(pose.bloque.margenSangrado.superior) + ' mm arriba y abajo.</p>' +
          '<div class="io-pc-caras' + (caras.length > 1 ? ' dos' : '') + '">' +
          caras.map(function (c) {
            return '<div class="io-pc-cara"><p>' + c[0] + '</p>' + c[1] + '</div>';
          }).join('') +
          '</div></div>';
      }

      out.innerHTML = html + '</div>';
    }

    function calcular() {
      var cuerpo = payload();

      var faltantes = ['sheetW', 'sheetH', 'itemW', 'itemH', 'qty'].filter(function (k) {
        return isNaN(cuerpo[k]);
      });
      if (faltantes.length) {
        return error('Revisá las medidas y la cantidad: tienen que ser números válidos (podés usar coma o punto).');
      }

      if (enVuelo) enVuelo.abort();
      enVuelo = new AbortController();
      out.classList.add('cargando');

      fetch(api + '/api/calcular/compat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cuerpo),
        signal: enVuelo.signal,
      })
        .then(function (res) {
          return res.json().then(function (cuerpoRes) {
            if (!res.ok) throw new Error(cuerpoRes.error || 'No se pudo calcular.');
            return cuerpoRes;
          });
        })
        .then(function (r) {
          out.classList.remove('cargando');
          pintar(r);
        })
        .catch(function (e) {
          if (e.name === 'AbortError') return;
          out.classList.remove('cargando');
          error(e.message === 'Failed to fetch'
            ? 'No se pudo conectar con el servicio de cálculo. Revisá la conexión y probá de nuevo.'
            : e.message);
        });
    }

    function calcularConDemora() {
      clearTimeout(temporizador);
      temporizador = setTimeout(calcular, DEBOUNCE_MS);
    }

    function guardar() {
      try {
        var data = {};
        qa(calc, 'input,select').forEach(function (el) {
          if (!el.name) return;
          data[el.name] = el.type === 'checkbox' ? !!el.checked : el.value;
        });
        localStorage.setItem(CLAVE_ESTADO, JSON.stringify(data));
      } catch (e) { /* modo privado, cuota llena: no es crítico */ }
    }

    function cargar() {
      try {
        var raw = localStorage.getItem(CLAVE_ESTADO);
        if (!raw) return;
        var data = JSON.parse(raw);
        qa(calc, 'input,select').forEach(function (el) {
          if (!el.name || !(el.name in data)) return;
          if (el.type === 'checkbox') el.checked = !!data[el.name];
          else el.value = data[el.name];
        });
      } catch (e) { /* estado corrupto: se ignora y quedan los defaults */ }
    }

    q(calc, '[name="paperSize"]').addEventListener('change', function () {
      var partes = (this.value || '').split('x');
      if (partes.length === 2) {
        q(calc, '[name="sheetW"]').value = partes[0];
        q(calc, '[name="sheetH"]').value = partes[1];
      }
      guardar();
      calcular();
    });

    // Editar las medidas a mano pasa el select a "Personalizado", para que la
    // etiqueta del resultado no diga una medida distinta de la que se calcula.
    ['sheetW', 'sheetH'].forEach(function (nombre) {
      q(calc, '[name="' + nombre + '"]').addEventListener('input', function () {
        var select = q(calc, '[name="paperSize"]');
        var esperado = valor(calc, 'sheetW') + 'x' + valor(calc, 'sheetH');
        if (select.value !== 'custom' && select.value !== esperado) select.value = 'custom';
      });
    });

    q(calc, '[data-action="calc"]').addEventListener('click', function () { guardar(); calcular(); });

    q(calc, '[data-action="reset"]').addEventListener('click', function () {
      var defaults = {
        paperType: 'Obra 75g', paperSize: '32x47',
        sheetW: '32', sheetH: '47', itemW: '9', itemH: '5',
        bleed: '3', gutter: '0', extraSheets: '2', qty: '100',
        currency: '$', costPaper: '0', costPrint: '0', costSetup: '0',
        prodPct: '0', profitPct: '0',
      };
      Object.keys(defaults).forEach(function (n) {
        var el = q(calc, '[name="' + n + '"]');
        if (el) el.value = defaults[n];
      });
      ['doubleFace', 'applyVat'].forEach(function (n) {
        var el = q(calc, '[name="' + n + '"]');
        if (el) el.checked = false;
      });
      try { localStorage.removeItem(CLAVE_ESTADO); } catch (e) { /* ídem */ }
      calcular();
    });

    qa(calc, 'input,select').forEach(function (el) {
      el.addEventListener('change', function () { guardar(); calcular(); });
      el.addEventListener('input', function () { guardar(); calcularConDemora(); });
    });

    cargar();
    calcular();
  }

  function init() {
    qa(document, '.io-pliegos-calc[data-io-pliegos]').forEach(bind);
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
