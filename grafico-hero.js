/* ==========================================================================
   grafico-hero.js — Gráfico económico del inicio (cambia en cada visita)
   --------------------------------------------------------------------------
   El HTML ya trae el gráfico de oferta y demanda. Este script lo reemplaza,
   al cargar la página, por otro gráfico con esta probabilidad:

       Oferta y demanda ............ 80 %
       Curva de Phillips ........... 5 %
       Frontera de producción ...... 5 %
       Curva de Lorenz ............. 5 %
       Elección del consumidor ..... 5 %

   Para ver uno en particular: index.html?grafico=phillips
   (oferta · phillips · fpp · lorenz · consumidor)

   Para cambiar las probabilidades, edita la lista PESOS (deben sumar 1).
   ========================================================================== */
(function () {
  "use strict";

  var PESOS = [["oferta", 0.90], ["phillips", 0.025], ["fpp", 0.025], ["lorenz", 0.025], ["consumidor", 0.025]];

  function elegirId(r) {
    var acum = 0;
    for (var i = 0; i < PESOS.length; i++) { acum += PESOS[i][1]; if (r < acum) return PESOS[i][0]; }
    return "oferta";
  }
  if (typeof document === "undefined") { if (typeof module !== "undefined") module.exports = { elegirId: elegirId, PESOS: PESOS }; return; }

  /* ---------- Piezas comunes (mismo estilo del gráfico de oferta y demanda) ---------- */
  var AZUL = "#172340", ROJO = "#a83b2c", ORO = "#b98a1f", TEXTO = "#3d4a63", GRIS = "#8a8f9c";
  var FUENTE = 'font-family="Montserrat"';
  function txt(x, y, t, color, extra) { return '<text x="' + x + '" y="' + y + '" ' + FUENTE + ' font-size="11" fill="' + (color || TEXTO) + '"' + (extra || "") + ">" + t + "</text>"; }
  function letra(x, y, t) { return '<text x="' + x + '" y="' + y + '" font-family="Fraunces" font-style="italic" font-size="16" fill="' + AZUL + '">' + t + "</text>"; }
  function punto(x, y, relleno) { return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="5" fill="' + (relleno === false ? "#fbfbf6" : AZUL) + '" stroke="' + AZUL + '" stroke-width="1.5"/>'; }
  function guia(x1, y1, x2, y2) { return '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="' + AZUL + '" stroke-width="1" stroke-dasharray="3 4"/>'; }
  function curva(d, color, extra) { // pathLength=420 hace que la animación de trazado funcione con cualquier largo
    return '<path class="curve" pathLength="420" d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round"' + (extra || "") + "/>";
  }
  function trazo(d, color, relleno) { return '<path d="' + d + '" fill="' + (relleno || "none") + '" stroke="' + color + '" stroke-width="1.5" stroke-dasharray="6 5"/>'; }
  function poli(pts) { return pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" "); }
  function marco(titulo, ejeY, ejeX, xEjeX, cuerpo) {
    return '<svg viewBox="0 0 380 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="chartTitle"><title id="chartTitle">' + titulo + "</title>" +
      '<line x1="40" y1="20" x2="40" y2="260" stroke="' + AZUL + '" stroke-width="1.5"/>' +
      '<line x1="40" y1="260" x2="360" y2="260" stroke="' + AZUL + '" stroke-width="1.5"/>' +
      txt(2, 14, ejeY) + txt(xEjeX, 278, ejeX) + cuerpo + "</svg>";
  }

  /* ---------- 1) Curva de Phillips ---------- */
  function phillips() {
    var v = function (u) { return 0.05 + 0.062 / (u - 0.08); };           // inflación (0–1) según desempleo (0–1)
    var X = function (u) { return 40 + 320 * u; }, Y = function (vv) { return 260 - 240 * vv; };
    var pts = []; for (var u = 0.15; u <= 0.951; u += 0.02) pts.push([X(u), Y(v(u))]);
    var ex = X(0.5), ey = Y(v(0.5));
    return marco("Curva de Phillips: relación entre inflación y desempleo, con el desempleo natural de largo plazo", "Inflación", "Desempleo", 290,
      '<line x1="' + ex + '" y1="20" x2="' + ex + '" y2="260" stroke="' + ORO + '" stroke-width="2" stroke-dasharray="6 5"/>' +
      curva(poli(pts), ROJO) + guia(40, ey, ex, ey) + punto(ex, ey) + letra(ex + 8, ey - 8, "E") +
      txt(116, 100, "Corto plazo", ROJO) + txt(ex + 8, 38, "Largo plazo", ORO) + txt(ex - 4, 276, "u*", TEXTO, ' text-anchor="end"'));
  }

  /* ---------- 2) Frontera de posibilidades de producción ---------- */
  function fpp() {
    var cx = 40, cy = 260, th = 48 * Math.PI / 180;
    var ex = cx + 290 * Math.cos(th), ey = cy - 210 * Math.sin(th);
    return marco("Frontera de posibilidades de producción, con un punto eficiente, uno ineficiente y su desplazamiento por crecimiento", "Bien A", "Bien B", 312,
      trazo("M 40 25 A 320 235 0 0 1 360 260", ORO) +
      curva("M 40 50 A 290 210 0 0 1 330 260", ROJO) +
      punto(ex, ey) + txt(ex - 10, ey + 18, "Eficiente", AZUL, ' text-anchor="end"') +
      punto(150, 180, false) + txt(160, 196, "Ineficiente", AZUL) +
      txt(64, 42, "FPP", ROJO) + txt(262, 56, "Crecimiento", ORO));
  }

  /* ---------- 3) Curva de Lorenz ---------- */
  function lorenz() {
    var pts = []; for (var t = 0; t <= 1.0001; t += 0.025) pts.push([40 + 320 * t, 260 - 240 * Math.pow(t, 2.3)]);
    var area = "M 40 260 L 360 20 " + pts.slice().reverse().map(function (p) { return "L" + p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" ") + " Z";
    return marco("Curva de Lorenz: desigualdad del ingreso frente a la línea de igualdad perfecta", "% del ingreso", "% de la población", 262,
      '<path d="' + area + '" fill="' + ORO + '" fill-opacity="0.2"/>' +
      '<line x1="40" y1="260" x2="360" y2="20" stroke="' + AZUL + '" stroke-opacity=".55" stroke-width="1.5" stroke-dasharray="6 5"/>' +
      curva(poli(pts), ROJO) +
      letra(258, 128, "A") + letra(246, 226, "B") +
      '<text x="90" y="215" ' + FUENTE + ' font-size="11" fill="' + TEXTO + '" transform="rotate(-36.87 90 215)">Igualdad perfecta</text>' +
      txt(196, 250, "Curva de Lorenz", ROJO) + txt(62, 52, "Gini = A / (A + B)"));
  }

  /* ---------- 4) Elección del consumidor ---------- */
  function consumidor() {
    var X = function (u) { return 40 + u; }, Y = function (vv) { return 260 - vv; };
    var ind = function (K, u0, u1) { var p = []; for (var u = u0; u <= u1; u += 6) p.push([X(u), Y(K / u)]); p.push([X(u1), Y(K / u1)]); return p; };
    var ex = X(140), ey = Y(100);
    return marco("Elección del consumidor: restricción presupuestaria y curva de indiferencia tangentes en el punto óptimo", "Bien Y", "Bien X", 318,
      '<path d="' + poli(ind(22000, 105, 290)) + '" fill="none" stroke="' + GRIS + '" stroke-width="1.5" stroke-dasharray="6 5"/>' +
      '<line class="curve" pathLength="420" x1="40" y1="60" x2="320" y2="260" stroke="' + ORO + '" stroke-width="2.5"/>' +
      curva(poli(ind(14000, 62, 280)), ROJO) +
      guia(40, ey, ex, ey) + guia(ex, ey, ex, 260) + punto(ex, ey) + letra(ex + 8, ey - 8, "E") +
      txt(110, 34, "Indiferencia", ROJO) + txt(46, 138, "Presupuesto", ORO) + txt(262, 128, "Inalcanzable", GRIS));
  }

  var GRAFICOS = {
    oferta: null, // ya está en el HTML
    phillips: { cap: "FIG. 02 — CURVA DE PHILLIPS", svg: phillips },
    fpp: { cap: "FIG. 03 — FRONTERA DE PRODUCCIÓN", svg: fpp },
    lorenz: { cap: "FIG. 04 — CURVA DE LORENZ", svg: lorenz },
    consumidor: { cap: "FIG. 05 — ELECCIÓN DEL CONSUMIDOR", svg: consumidor }
  };

  /* ---------- Selección y reemplazo ---------- */
  var cont = document.getElementById("hero-grafico");
  if (!cont) return;
  var forzado = (location.search.match(/[?&]grafico=([a-z]+)/) || [])[1];
  var id = (forzado && GRAFICOS.hasOwnProperty(forzado)) ? forzado : elegirId(Math.random());
  var g = GRAFICOS[id];
  if (!g) return; // oferta y demanda: se deja el HTML tal cual

  var tmp = document.createElement("div");
  tmp.innerHTML = g.svg();
  var viejo = cont.querySelector("svg");
  if (viejo && tmp.firstElementChild) cont.replaceChild(tmp.firstElementChild, viejo);
  var cap = document.getElementById("hero-grafico-cap");
  if (cap) cap.textContent = g.cap;
})();
