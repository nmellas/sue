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
  function dibujar(cont, serieCompleta, cfg, anios) {
    var datos = serieCompleta;
    if (cfg.desde) datos = datos.filter(function (d) { return d[0] >= cfg.desde; });
    if (anios) {
      var ult = datos[datos.length - 1][0].split("-");
      var corte = (+ult[0] - anios) + "-" + ult[1];
      datos = datos.filter(function (d) { return d[0] > corte; });
    }
    cont.textContent = "";
    var W = cont.clientWidth, H = cont.clientHeight || 240;
    var m = { t: 14, r: 64, b: 26, l: 46 };
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
    var decEje = cfg.decEje != null ? cfg.decEje : (esc.paso < 1 ? 1 : 0);
    esc.ticks.forEach(function (t) {
      el("line", { x1: m.l, x2: m.l + w, y1: Y(t), y2: Y(t), "class": t === 0 && cfg.cero ? "dt-cero" : "dt-grid-line" }, svg);
      var tx = el("text", { x: m.l - 8, y: Y(t) + 4, "text-anchor": "end", "class": "dt-eje-texto" }, svg);
      tx.textContent = (cfg.pre === "$" ? "$" : "") + num(t, decEje);
    });

    // Banda y meta (inflación)
    if (cfg.banda) {
      el("rect", { x: m.l, width: w, y: Y(cfg.banda[1]), height: Y(cfg.banda[0]) - Y(cfg.banda[1]), "class": "dt-banda" }, svg);
      el("line", { x1: m.l, x2: m.l + w, y1: Y(cfg.meta), y2: Y(cfg.meta), "class": "dt-meta" }, svg);
      var mt = el("text", { x: m.l + w + 6, y: Y(cfg.meta) + 4, "class": "dt-meta-texto" }, svg);
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
    if (cfg.banda && Math.abs(yTexto - (Y(cfg.meta) + 4)) < 14) yTexto = yf > Y(cfg.meta) ? Y(cfg.meta) + 18 : Y(cfg.meta) - 10;
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
      ["#tpm", "Tasa de Política Monetaria", fmt(CONFIG.tpm, u.tpm.valor, 2), "Banco Central"],
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

  /* ---------- Inicio ---------- */
  function iniciar(D) {
    var series = {
      inflacion: inflacionAnual(D.ipc), tpm: D.tpm, dolar: D.dolar,
      cobre: D.cobre, imacec: D.imacec, desempleo: D.desempleo
    };
    var act = new Date(D.actualizado);
    $("dt-actualizado").textContent = "Actualizado el " + act.getDate() + " de " + MESES[act.getMonth()] + " de " + act.getFullYear() + " · Fuente: Banco Central e INE";
    resumen(D, series);

    var anios = 10;
    var charts = [].slice.call(document.querySelectorAll(".dt-chart"));
    charts.forEach(function (c) {
      var k = c.getAttribute("data-serie");
      tabla(c.closest(".dt-card"), series[k], CONFIG[k]);
    });
    function todo() {
      charts.forEach(function (c) { var k = c.getAttribute("data-serie"); dibujar(c, series[k], CONFIG[k], anios); });
    }
    todo();
    [].forEach.call(document.querySelectorAll(".dt-rango"), function (b) {
      b.addEventListener("click", function () {
        anios = +b.getAttribute("data-anios");
        [].forEach.call(document.querySelectorAll(".dt-rango"), function (o) {
          o.classList.toggle("is-activo", o === b);
          o.setAttribute("aria-pressed", o === b ? "true" : "false");
        });
        todo();
      });
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
