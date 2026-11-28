/* ==========================================================================
   datos.js — SUE
   Dibuja los gráficos y la calculadora de la página datos.html a partir de
   datos/economia.json (lo actualiza GitHub Actions cada día con
   scripts/datos-economicos.mjs). Gráficos en SVG propio, sin librerías.
   ========================================================================== */
(function () {
  "use strict";

  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  var SVGNS = "http://www.w3.org/2000/svg";

  function $(id) { return document.getElementById(id); }
  function num(x, dec) {
    return x.toLocaleString("es-CL", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function nombreMes(m, corto) {
    var p = m.split("-");
    return (corto ? MESES_CORTOS : MESES)[+p[1] - 1] + " " + p[0];
  }
  function nombreFecha(f) {
    var p = f.split("-");
    return +p[2] + " " + MESES_CORTOS[+p[1] - 1] + " " + p[0];
  }
  function el(tag, attrs, padre) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (padre) padre.appendChild(n);
    return n;
  }

  /* ---------- Series ---------- */
  // Inflación a 12 meses: acumula las 12 variaciones mensuales del IPC
  function inflacionAnual(ipc) {
    var out = [];
    for (var i = 11; i < ipc.length; i++) {
      var f = 1;
      for (var j = i - 11; j <= i; j++) f *= 1 + ipc[j][1] / 100;
      out.push([ipc[i][0], Math.round((f - 1) * 1000) / 10]);
    }
    return out;
  }

  var CONFIG = {
    inflacion: { nombre: "Inflación anual", dec: 1, suf: " %", desde: "1990-01", banda: [2, 4], meta: 3 },
    tpm:       { nombre: "TPM", dec: 2, decFin: 2, suf: " %" },
    dolar:     { nombre: "Dólar observado", dec: 0, pre: "$", decTip: 2 },
    cobre:     { nombre: "Cobre", dec: 2, pre: "US$", suf: "/lb", decEje: 1 },
    imacec:    { nombre: "IMACEC", dec: 1, suf: " %", cero: true, signo: true },
    desempleo: { nombre: "Desempleo", dec: 1, suf: " %" }
  };
  function fmt(cfg, v, dec) {
    var d = dec == null ? cfg.dec : dec;
    var s = num(Math.abs(v), d);
    var signo = v < 0 ? "−" : (cfg.signo && v > 0 ? "+" : "");
    return signo + (cfg.pre || "") + s + (cfg.suf || "");
  }

  /* ---------- Escala "bonita" para el eje Y ---------- */
  function escala(min, max, nTicks) {
    if (min === max) { min -= 1; max += 1; }
    var bruto = (max - min) / nTicks;
    var mag = Math.pow(10, Math.floor(Math.log10(bruto)));
    var paso = [1, 2, 2.5, 5, 10].map(function (f) { return f * mag; }).find(function (p) { return p >= bruto; });
    var lo = Math.floor(min / paso) * paso, hi = Math.ceil(max / paso) * paso;
    var ticks = [];
    for (var t = lo; t <= hi + paso / 2; t += paso) ticks.push(Math.round(t * 1e6) / 1e6);
    return { lo: lo, hi: hi, ticks: ticks, paso: paso };
  }

  /* ---------- Gráfico de línea ---------- */
  // Recorta una serie al período elegido: { anios: n } (0 = todo) o { desde, hasta } ("AAAA-MM")
  function recortar(serie, cfg, rango) {
    if (rango.desde) return serie.filter(function (d) { return d[0] >= rango.desde && d[0] <= rango.hasta; });
    var datos = cfg.desde ? serie.filter(function (d) { return d[0] >= cfg.desde; }) : serie;
    if (rango.anios && datos.length) {
      var ult = datos[datos.length - 1][0].split("-");
      var corte = (+ult[0] - rango.anios) + "-" + ult[1];
      datos = datos.filter(function (d) { return d[0] > corte; });
    }
    return datos;
  }

  function dibujar(cont, serieCompleta, cfg, rango) {
    var datos = recortar(serieCompleta, cfg, rango);
    cont.textContent = "";
    if (datos.length < 2) {
      var aviso = document.createElement("p");
      aviso.className = "dt-sin-datos";
      aviso.textContent = serieCompleta.length
        ? "No hay datos de este indicador en el período elegido (parte en " + nombreMes(serieCompleta[0][0]) + ")."
        : "Sin datos.";
      cont.appendChild(aviso);
      return;
    }
    var W = cont.clientWidth, H = cont.clientHeight || 240;
    var chico = W < 460;   // celular: márgenes más justos para que el gráfico use el ancho
    var m = chico ? { t: 12, r: 48, b: 24, l: 38 } : { t: 14, r: 58, b: 26, l: 46 };
    var w = W - m.l - m.r, h = H - m.t - m.b;
    if (w < 60) return;

    var vals = datos.map(function (d) { return d[1]; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (cfg.banda) { min = Math.min(min, cfg.banda[0]); max = Math.max(max, cfg.banda[1]); }
    if (cfg.cero) { min = Math.min(min, 0); max = Math.max(max, 0); }
    var esc = escala(min, max, h < 200 ? 4 : 5);
    var X = function (i) { return m.l + (datos.length === 1 ? w / 2 : (i / (datos.length - 1)) * w); };
    var Y = function (v) { return m.t + h - ((v - esc.lo) / (esc.hi - esc.lo)) * h; };

    var ultimo = datos[datos.length - 1];
    var svg = el("svg", {
      viewBox: "0 0 " + W + " " + H, role: "img", tabindex: "0",
      "aria-label": cfg.nombre + ": " + fmt(cfg, ultimo[1], cfg.decFin) + " en " + nombreMes(ultimo[0]) +
        ". Mínimo del período " + fmt(cfg, Math.min.apply(null, vals)) + ", máximo " + fmt(cfg, Math.max.apply(null, vals)) + ". Usa las flechas para recorrer los meses."
    }, null);
    cont.appendChild(svg);

    // Grilla y eje Y
    var decEje = cfg.decEje != null ? cfg.decEje : (esc.paso % 1 !== 0 ? 1 : 0);
    esc.ticks.forEach(function (t) {
      el("line", { x1: m.l, x2: m.l + w, y1: Y(t), y2: Y(t), "class": t === 0 && cfg.cero ? "dt-cero" : "dt-grid-line" }, svg);
      var tx = el("text", { x: m.l - 8, y: Y(t) + 4, "text-anchor": "end", "class": "dt-eje-texto" }, svg);
      tx.textContent = (cfg.pre === "$" ? "$" : "") + num(t, decEje);
    });

    // Banda y meta (inflación)
    if (cfg.banda) {
      el("rect", { x: m.l, width: w, y: Y(cfg.banda[1]), height: Y(cfg.banda[0]) - Y(cfg.banda[1]), "class": "dt-banda" }, svg);
      el("line", { x1: m.l, x2: m.l + w, y1: Y(cfg.meta), y2: Y(cfg.meta), "class": "dt-meta" }, svg);
      // Rótulo de la meta dentro del gráfico, a la izquierda, sobre la línea
      var mt = el("text", { x: m.l + 6, y: Y(cfg.meta) - 6, "class": "dt-meta-texto" }, svg);
      mt.textContent = "Meta " + cfg.meta + " %";
    }

    // Eje X: años, espaciados según el ancho disponible
    var años = {};
    datos.forEach(function (d, i) { var a = d[0].slice(0, 4); if (!(a in años)) años[a] = i; });
    var lista = Object.keys(años);
    var cada = Math.max(1, Math.ceil(lista.length / Math.max(2, Math.floor(w / 52))));
    lista.forEach(function (a, k) {
      if (k % cada !== 0 || (años[a] === 0 && datos[0][0].slice(5) !== "01" && lista.length > 2)) return;
      var tx = el("text", { x: X(años[a]), y: m.t + h + 18, "text-anchor": "middle", "class": "dt-eje-texto" }, svg);
      tx.textContent = a;
    });

    // Línea
    var d = datos.map(function (p, i) { return (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(p[1]).toFixed(1); }).join("");
    el("path", { d: d, "class": "dt-linea" }, svg);

    // Punto y valor final (si no choca con la etiqueta de la meta)
    var yf = Y(ultimo[1]);
    el("circle", { cx: X(datos.length - 1), cy: yf, r: 4, "class": "dt-punto" }, svg);
    var yTexto = yf + 4;
    var ft = el("text", { x: X(datos.length - 1) + 8, y: yTexto, "class": "dt-fin-texto" }, svg);
    ft.textContent = fmt(cfg, ultimo[1], cfg.decFin).replace("US$", "").replace("/lb", "");

    // Lectura al pasar el mouse / tocar / usar las flechas
    var cursor = el("line", { y1: m.t, y2: m.t + h, "class": "dt-cursor", visibility: "hidden" }, svg);
    var cursorPunto = el("circle", { r: 4.5, "class": "dt-cursor-punto", visibility: "hidden" }, svg);
    var tip = document.createElement("div");
    tip.className = "dt-tip"; tip.hidden = true;
    var tipValor = document.createElement("strong"), tipMes = document.createElement("span");
    tip.appendChild(tipValor); tip.appendChild(tipMes);
    cont.appendChild(tip);
    var activo = -1;

    function mostrar(i) {
      activo = Math.max(0, Math.min(datos.length - 1, i));
      var p = datos[activo], x = X(activo), y = Y(p[1]);
      cursor.setAttribute("x1", x); cursor.setAttribute("x2", x); cursor.setAttribute("visibility", "visible");
      cursorPunto.setAttribute("cx", x); cursorPunto.setAttribute("cy", y); cursorPunto.setAttribute("visibility", "visible");
      tipValor.textContent = fmt(cfg, p[1], cfg.decTip != null ? cfg.decTip : cfg.dec);
      tipMes.textContent = nombreMes(p[0]);
      tip.hidden = false;
      var tw = tip.offsetWidth;
      tip.style.left = Math.max(tw / 2, Math.min(W - tw / 2, x)) + "px";
      tip.style.top = Math.max(y - 10, 40) + "px";
    }
    function ocultar() {
      activo = -1;
      cursor.setAttribute("visibility", "hidden"); cursorPunto.setAttribute("visibility", "hidden");
      tip.hidden = true;
    }
    function indiceEn(evt) {
      var r = svg.getBoundingClientRect();
      var x = (evt.clientX - r.left) * (W / r.width);
      return Math.round(((x - m.l) / w) * (datos.length - 1));
    }
    var capa = el("rect", { x: m.l - 6, y: 0, width: w + 12, height: H, fill: "transparent" }, svg);
    capa.addEventListener("pointermove", function (e) { mostrar(indiceEn(e)); });
    capa.addEventListener("pointerdown", function (e) { mostrar(indiceEn(e)); });
    capa.addEventListener("pointerleave", ocultar);
    svg.addEventListener("focus", function () { mostrar(datos.length - 1); });
    svg.addEventListener("blur", ocultar);
    svg.addEventListener("keydown", function (e) {
      var salto = { ArrowLeft: -1, ArrowRight: 1, PageUp: -12, PageDown: 12, Home: -1e9, End: 1e9 }[e.key];
      if (salto == null) return;
      e.preventDefault();
      mostrar((activo < 0 ? datos.length - 1 : activo) + salto);
    });
  }

  // Tabla con los últimos 12 meses (bajo cada gráfico)
  function tabla(card, serie, cfg) {
    var det = document.createElement("details");
    det.className = "dt-tabla";
    var sum = document.createElement("summary");
    sum.textContent = "Ver los últimos 12 meses";
    det.appendChild(sum);
    var t = document.createElement("table");
    var cab = t.createTHead().insertRow();
    ["Mes", cfg.nombre].forEach(function (x) { var th = document.createElement("th"); th.textContent = x; cab.appendChild(th); });
    var cuerpo = t.createTBody();
    serie.slice(-12).reverse().forEach(function (p) {
      var f = cuerpo.insertRow();
      f.insertCell().textContent = nombreMes(p[0]);
      f.insertCell().textContent = fmt(cfg, p[1], cfg.decTip != null ? cfg.decTip : cfg.dec);
    });
    det.appendChild(t);
    var exp = card.querySelector(".dt-explica");
    card.insertBefore(det, exp);
  }

  /* ---------- Resumen ---------- */
  function resumen(D, series) {
    var inf = series.inflacion[series.inflacion.length - 1];
    var des = D.desempleo[D.desempleo.length - 1];
    var u = D.ultimo;
    var tiles = [
      ["#inflacion", "Inflación anual", fmt(CONFIG.inflacion, inf[1]), "a " + nombreMes(inf[0], true)],
      ["#tpm", "TPM", fmt(CONFIG.tpm, u.tpm.valor, 2), "Banco Central"],
      ["#dolar", "Dólar observado", "$" + num(u.dolar.valor, 2), nombreFecha(u.dolar.fecha)],
      ["#calculadora", "UF", "$" + num(u.uf.valor, 2), nombreFecha(u.uf.fecha)],
      ["#cobre", "Cobre", "US$" + num(u.cobre.valor, 2) + "/lb", nombreFecha(u.cobre.fecha)],
      ["#desempleo", "Desempleo", fmt(CONFIG.desempleo, des[1]), "trimestre a " + nombreMes(des[0], true)]
    ];
    var ul = $("dt-resumen");
    ul.textContent = "";
    tiles.forEach(function (t) {
      var li = document.createElement("li"); li.className = "dt-tile";
      var a = document.createElement("a"); a.href = t[0];
      [["dt-tile-label", t[1]], ["dt-tile-valor", t[2]], ["dt-tile-nota", t[3]]].forEach(function (x) {
        var s = document.createElement("span"); s.className = x[0]; s.textContent = x[1]; a.appendChild(s);
      });
      a.style.display = "contents";
      li.appendChild(a); ul.appendChild(li);
    });
  }

  /* ---------- Calculadora de inflación ---------- */
  function calculadora(ipc) {
    // Índice de precios mensual (enero 1976 = 1)
    var indice = {}, f = 1, meses = [];
    ipc.forEach(function (p) {
      if (p[0] < "1976-01") return;
      f *= 1 + p[1] / 100;
      indice[p[0]] = f; meses.push(p[0]);
    });
    // El índice de un mes incluye su propia inflación: "pesos de enero" = nivel de precios de enero
    var primero = meses[0], ultimo = meses[meses.length - 1];
    var añoIni = +primero.slice(0, 4), añoFin = +ultimo.slice(0, 4);

    function llenar(selMes, selAño, valor) {
      MESES.forEach(function (n, i) { var o = new Option(n.charAt(0).toUpperCase() + n.slice(1), String(i + 1).padStart(2, "0")); selMes.add(o); });
      for (var a = añoFin; a >= añoIni; a--) selAño.add(new Option(a, a));
      selMes.value = valor.slice(5); selAño.value = valor.slice(0, 4);
    }
    var dm = $("calc-desde-mes"), da = $("calc-desde-anio"), hm = $("calc-hasta-mes"), ha = $("calc-hasta-anio");
    var inicial = (añoFin - 10) + ultimo.slice(4);
    llenar(dm, da, indice[inicial] ? inicial : primero);
    llenar(hm, ha, ultimo);
    var monto = $("calc-monto");

    function leerMonto() { return parseInt(String(monto.value).replace(/[^\d]/g, ""), 10) || 0; }
    function acotar(m) { return m < primero ? primero : (m > ultimo ? ultimo : m); }
    function calcular() {
      var v = leerMonto();
      var desde = acotar(da.value + "-" + dm.value), hasta = acotar(ha.value + "-" + hm.value);
      var factor = indice[hasta] / indice[desde];
      var res = Math.round(v * factor);
      var cambio = (factor - 1) * 100;
      $("calc-resultado").querySelector(".dt-calc-num").textContent = "$" + num(res, 0);
      var txt = "$" + num(v, 0) + " de " + nombreMes(desde) + " equivalen a $" + num(res, 0) + " de " + nombreMes(hasta) + ". ";
      if (desde === hasta) txt = "Elige dos meses distintos para comparar.";
      else if (hasta > desde) txt += "Los precios subieron " + num(cambio, 1) + " % en ese período.";
      else txt += "Los precios eran " + num(Math.abs(cambio), 1) + " % más bajos.";
      var pedidoDesde = da.value + "-" + dm.value, pedidoHasta = ha.value + "-" + hm.value;
      var aviso = (pedidoDesde > ultimo || pedidoHasta > ultimo)
        ? " Como aún no hay datos después de " + nombreMes(ultimo) + ", se usó ese mes."
        : (pedidoDesde < primero || pedidoHasta < primero ? " Los datos parten en " + nombreMes(primero) + "." : "");
      $("calc-resultado").querySelector(".dt-calc-texto").textContent = txt + aviso;
    }
    monto.addEventListener("input", function () {
      var v = leerMonto();
      var pos = monto.value.length - monto.selectionStart;
      monto.value = v ? num(v, 0) : "";
      monto.setSelectionRange(Math.max(0, monto.value.length - pos), Math.max(0, monto.value.length - pos));
      calcular();
    });
    [dm, da, hm, ha].forEach(function (s) { s.addEventListener("change", calcular); });
    $("dt-calc").addEventListener("submit", function (e) { e.preventDefault(); });
    calcular();
  }

  /* ---------- Descargas (CSV y Excel, del período elegido) ---------- */
  var COLUMNAS = [
    ["inflacion", "Inflación anual (%)"],
    ["ipc", "IPC, variación mensual (%)"],
    ["tpm", "TPM (%)"],
    ["dolar", "Dólar observado ($, promedio mensual)"],
    ["cobre", "Cobre (US$/lb, promedio mensual)"],
    ["imacec", "IMACEC (variación % 12 meses)"],
    ["desempleo", "Desempleo (%)"]
  ];

  // Tabla ancha: una fila por mes, una columna por indicador
  function armarTabla(series, claves, rango) {
    var porMes = {}, cols = COLUMNAS.filter(function (c) { return claves.indexOf(c[0]) !== -1; });
    cols.forEach(function (c, j) {
      recortar(series[c[0]], CONFIG[c[0]] || {}, rango).forEach(function (p) {
        (porMes[p[0]] = porMes[p[0]] || [])[j] = p[1];
      });
    });
    var meses = Object.keys(porMes).sort();
    return {
      encabezado: ["Mes"].concat(cols.map(function (c) { return c[1]; })),
      filas: meses.map(function (m) {
        var f = [m];
        for (var j = 0; j < cols.length; j++) f.push(porMes[m][j] == null ? null : porMes[m][j]);
        return f;
      })
    };
  }

  function csv(t) {
    var esc = function (v) { v = v == null ? "" : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return "﻿" + [t.encabezado].concat(t.filas).map(function (f) { return f.map(esc).join(","); }).join("\r\n") + "\r\n";
  }

  /* Excel (.xlsx) armado a mano: un .xlsx es un zip con archivos XML. */
  var CRC = (function () {
    var t = [];
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(b) { var c = 0xffffffff; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function zip(archivos) {
    var enc = new TextEncoder(), partes = [], central = [], offset = 0;
    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    archivos.forEach(function (a) {
      var nombre = enc.encode(a.nombre), datos = enc.encode(a.texto), crc = crc32(datos);
      var local = [].concat([0x50, 0x4b, 3, 4], u16(20), u16(0x0800), u16(0), u16(0), u16(0x21),
        u32(crc), u32(datos.length), u32(datos.length), u16(nombre.length), u16(0));
      partes.push(new Uint8Array(local), nombre, datos);
      central.push(new Uint8Array([].concat([0x50, 0x4b, 1, 2], u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21),
        u32(crc), u32(datos.length), u32(datos.length), u16(nombre.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))), nombre);
      offset += local.length + nombre.length + datos.length;
    });
    var tamCentral = central.reduce(function (s, p) { return s + p.length; }, 0);
    var fin = new Uint8Array([].concat([0x50, 0x4b, 5, 6], u16(0), u16(0), u16(archivos.length), u16(archivos.length),
      u32(tamCentral), u32(offset), u16(0)));
    return new Blob(partes.concat(central, [fin]), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  function xmlEsc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function letra(j) { return String.fromCharCode(65 + j); }
  function hoja(filas, anchos, conFechas) {
    var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>';
    anchos.forEach(function (w, j) { x += '<col min="' + (j + 1) + '" max="' + (j + 1) + '" width="' + w + '" customWidth="1"/>'; });
    x += "</cols><sheetData>";
    filas.forEach(function (f, i) {
      x += '<row r="' + (i + 1) + '">';
      f.forEach(function (v, j) {
        var ref = letra(j) + (i + 1);
        if (v == null || v === "") return;
        if (i === 0) x += '<c r="' + ref + '" t="inlineStr" s="2"><is><t>' + xmlEsc(v) + "</t></is></c>";
        else if (j === 0 && conFechas && /^\d{4}-\d{2}$/.test(v)) {
          var serial = Date.UTC(+v.slice(0, 4), +v.slice(5) - 1, 1) / 864e5 + 25569;
          x += '<c r="' + ref + '" s="1"><v>' + serial + "</v></c>";
        } else if (typeof v === "number") x += '<c r="' + ref + '"><v>' + v + "</v></c>";
        else x += '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + xmlEsc(v) + "</t></is></c>";
      });
      x += "</row>";
    });
    return x + "</sheetData></worksheet>";
  }
  function xlsx(hojas) {
    var ns = 'xmlns="http://schemas.openxmlformats.org/', archivos = [];
    archivos.push({ nombre: "[Content_Types].xml", texto: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types ' + ns + 'package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      hojas.map(function (h, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join("") + "</Types>" });
    archivos.push({ nombre: "_rels/.rels", texto: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships ' + ns + 'package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' });
    archivos.push({ nombre: "xl/workbook.xml", texto: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ' + ns + 'spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      hojas.map(function (h, i) { return '<sheet name="' + xmlEsc(h.nombre) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join("") + "</sheets></workbook>" });
    archivos.push({ nombre: "xl/_rels/workbook.xml.rels", texto: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships ' + ns + 'package/2006/relationships">' +
      hojas.map(function (h, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join("") +
      '<Relationship Id="rId' + (hojas.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' });
    archivos.push({ nombre: "xl/styles.xml", texto: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet ' + ns + 'spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="mmm yyyy"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' });
    hojas.forEach(function (h, i) { archivos.push({ nombre: "xl/worksheets/sheet" + (i + 1) + ".xml", texto: hoja(h.filas, h.anchos, h.fechas) }); });
    return zip(archivos);
  }

  function bajar(blob, nombre) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  function descargar(series, clave, formato, rango, efectivo, D) {
    var claves = clave === "todo" ? COLUMNAS.map(function (c) { return c[0]; }) : [clave];
    var t = armarTabla(series, claves, rango);
    if (!t.filas.length) { alert("No hay datos en el período elegido."); return; }
    var desde = t.filas[0][0], hasta = t.filas[t.filas.length - 1][0];
    var base = "sue-" + (clave === "todo" ? "datos-economicos" : clave) + "_" + desde + "_" + hasta;
    if (formato === "csv") { bajar(new Blob([csv(t)], { type: "text/csv;charset=utf-8" }), base + ".csv"); return; }
    var act = new Date(D.actualizado);
    var notas = [
      ["Datos económicos de Chile — Sociedad Universitaria de Economía (SUE)"],
      ["Página", "https://suecon.cl/datos.html"],
      ["Fuente", "Banco Central de Chile e INE, vía mindicador.cl"],
      ["Actualizado", act.toISOString().slice(0, 10)],
      ["Período", nombreMes(desde) + " a " + nombreMes(hasta)],
      [""],
      ["Notas"],
      ["Inflación anual", "Variación del IPC en 12 meses, calculada acumulando las variaciones mensuales."],
      ["IPC", "Los meses que aún no publica la fuente se calculan desde la UF (se reajusta con el IPC del mes anterior)."],
      ["Dólar y cobre", "Promedio de los valores diarios de cada mes."],
      ["TPM", "Valor al cierre de cada mes."],
      ["Desempleo", "Trimestre móvil terminado en el mes indicado (INE)."]
    ];
    bajar(xlsx([
      { nombre: "Datos", filas: [t.encabezado].concat(t.filas), anchos: [12].concat(t.encabezado.slice(1).map(function () { return 22; })), fechas: true },
      { nombre: "Notas", filas: notas, anchos: [18, 90] }
    ]), base + ".xlsx");
  }

  /* ---------- Inicio ---------- */
  function iniciar(D) {
    var series = {
      inflacion: inflacionAnual(D.ipc), tpm: D.tpm, dolar: D.dolar,
      cobre: D.cobre, imacec: D.imacec, desempleo: D.desempleo
    };
    var act = new Date(D.actualizado);
    $("dt-actualizado").textContent = "Actualizado el " + act.getDate() + " de " + MESES[act.getMonth()] + " de " + act.getFullYear() + " · Fuente: Banco Central e INE";
    resumen(D, series);

    series.ipc = D.ipc.map(function (p) { return [p[0], p[1]]; });   // solo para las descargas
    var rango = { anios: 10 };
    var charts = [].slice.call(document.querySelectorAll(".dt-chart"));
    charts.forEach(function (c) {
      var k = c.getAttribute("data-serie");
      var card = c.closest(".dt-card");
      tabla(card, series[k], CONFIG[k]);
      // Botones de descarga de este indicador
      var caja = document.createElement("div");
      caja.className = "dt-descargas";
      var lab = document.createElement("span"); lab.className = "dt-filtros-label"; lab.textContent = "Descargar";
      caja.appendChild(lab);
      [["xlsx", "Excel"], ["csv", "CSV"]].forEach(function (f) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "dt-bajar"; b.textContent = f[1];
        b.setAttribute("data-formato", f[0]); b.setAttribute("data-serie", k);
        b.setAttribute("aria-label", "Descargar " + CONFIG[k].nombre + " en " + f[1]);
        caja.appendChild(b);
      });
      card.appendChild(caja);
    });

    /* Selector de período: botones rápidos + "desde / hasta" */
    var ultimoMes = Object.keys(series).reduce(function (m, k) {
      var s = series[k]; return s.length && s[s.length - 1][0] > m ? s[s.length - 1][0] : m;
    }, "0000-00");
    var primerMes = "1976-01";
    var sel = { dm: $("rango-desde-mes"), da: $("rango-desde-anio"), hm: $("rango-hasta-mes"), ha: $("rango-hasta-anio") };
    [sel.dm, sel.hm].forEach(function (s) {
      MESES_CORTOS.forEach(function (n, i) { s.add(new Option(n, String(i + 1).padStart(2, "0"))); });
    });
    [sel.da, sel.ha].forEach(function (s) {
      for (var a = +ultimoMes.slice(0, 4); a >= +primerMes.slice(0, 4); a--) s.add(new Option(a, a));
    });
    function mostrarRango(desde, hasta) {
      sel.dm.value = desde.slice(5); sel.da.value = desde.slice(0, 4);
      sel.hm.value = hasta.slice(5); sel.ha.value = hasta.slice(0, 4);
    }
    // Rango que representa cada botón rápido (para mostrarlo en los selectores y en las descargas)
    function rangoEfectivo() {
      if (rango.desde) return { desde: rango.desde, hasta: rango.hasta };
      if (!rango.anios) return { desde: primerMes, hasta: ultimoMes };
      var p = ultimoMes.split("-");
      var d = (+p[0] - rango.anios) + "-" + p[1];
      var dd = d.split("-"), mm = +dd[1] + 1, yy = +dd[0];
      if (mm > 12) { mm = 1; yy++; }
      return { desde: yy + "-" + String(mm).padStart(2, "0"), hasta: ultimoMes };
    }
    function marcarBotones() {
      [].forEach.call(document.querySelectorAll(".dt-rango"), function (o) {
        var on = !rango.desde && +o.getAttribute("data-anios") === rango.anios;
        o.classList.toggle("is-activo", on);
        o.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }
    function todo() {
      charts.forEach(function (c) { var k = c.getAttribute("data-serie"); dibujar(c, series[k], CONFIG[k], rango); });
      var r = rangoEfectivo(); mostrarRango(r.desde, r.hasta);
      marcarBotones();
    }
    todo();
    [].forEach.call(document.querySelectorAll(".dt-rango"), function (b) {
      b.addEventListener("click", function () { rango = { anios: +b.getAttribute("data-anios") }; todo(); });
    });
    [sel.dm, sel.da, sel.hm, sel.ha].forEach(function (s) {
      s.addEventListener("change", function () {
        var desde = sel.da.value + "-" + sel.dm.value, hasta = sel.ha.value + "-" + sel.hm.value;
        if (desde > hasta) { var t = desde; desde = hasta; hasta = t; }   // si quedan al revés, se invierten
        rango = { desde: desde, hasta: hasta };
        todo();
      });
    });

    /* Descargas */
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest(".dt-bajar");
      if (!b) return;
      descargar(series, b.getAttribute("data-serie"), b.getAttribute("data-formato"), rango, rangoEfectivo(), D);
    });
    var ancho = window.innerWidth, t = null;
    window.addEventListener("resize", function () {
      if (window.innerWidth === ancho) return;   // en celular, el scroll cambia el alto: no redibujar
      ancho = window.innerWidth;
      clearTimeout(t); t = setTimeout(todo, 120);
    });

    calculadora(D.ipc);
  }

  fetch("datos/economia.json", { credentials: "same-origin" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(iniciar)
    .catch(function (e) {
      console.warn("No se pudieron cargar los datos:", e);
      $("dt-actualizado").textContent = "No se pudieron cargar los datos. Intenta recargar la página.";
    });
})();
