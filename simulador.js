/* ==========================================================================
   simulador.js — "Sé el Banco Central" · SUE
   Modelo macroeconómico trimestral simplificado, con fines educativos:
   - Expectativas: ancladas a la meta según la credibilidad del Banco Central.
   - Actividad (brecha de producto): cae si la tasa real supera la neutral.
   - Inflación: persistente, empujada por la actividad, los shocks de costos
     y el tipo de cambio (subir la tasa aprecia el peso).
   - Credibilidad: baja si la inflación se aleja de la meta y se recupera
     si vuelve al rango de 2% a 4%.
   No representa las proyecciones ni los modelos del Banco Central de Chile.
   ========================================================================== */
(function () {
  "use strict";

  var META = 3, TASA_NEUTRAL_REAL = 1, TRIMESTRES = 8, ESCALA_PUNTAJE = 45;
  var OPCIONES = [-100, -50, -25, 0, 25, 50, 100]; // puntos base

  var EVENTOS = [
    { t: "El precio del cobre cae con fuerza", x: "Menores ingresos por exportaciones frenan la inversión y el peso se deprecia, lo que encarece los productos importados.", d: -0.9, s: 0.4 },
    { t: "Se dispara el precio del petróleo", x: "Suben los combustibles y el transporte. La actividad se resiente levemente.", d: -0.3, s: 1.0 },
    { t: "China se desacelera", x: "Cae la demanda por nuestras exportaciones y la economía se enfría.", d: -1.1, s: 0 },
    { t: "Los hogares reciben una fuerte inyección de liquidez", x: "El consumo se acelera y presiona los precios al alza.", d: 1.2, s: 0.4 },
    { t: "La Reserva Federal sube sus tasas", x: "Salen capitales de las economías emergentes y el peso se deprecia.", d: 0, s: 0.7 },
    { t: "Buena cosecha y alimentos más baratos", x: "Los precios de los alimentos bajan más de lo esperado.", d: 0, s: -0.6 },
    { t: "Boom de inversión minera", x: "Nuevos proyectos impulsan la inversión y el empleo.", d: 0.9, s: 0 },
    { t: "Un trimestre tranquilo", x: "Sin sorpresas relevantes. ¿Aprovechas de ajustar el rumbo?", d: 0, s: 0 },
    { t: "Sequía en la zona central", x: "Suben los precios de frutas y verduras.", d: 0, s: 0.8 },
    { t: "Repunte de la demanda externa", x: "Nuestros socios comerciales crecen más de lo esperado.", d: 0.7, s: 0 },
    { t: "Crisis de confianza empresarial", x: "Las empresas postergan inversiones y contratan menos.", d: -0.7, s: -0.3 },
    { t: "Temporada récord de turismo", x: "Más demanda por servicios presiona los precios internos.", d: 0.5, s: 0.5 }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n, dec) {
    return Number(n).toLocaleString("es-CL", { minimumFractionDigits: dec == null ? 1 : dec, maximumFractionDigits: dec == null ? 1 : dec });
  };
  var azar = function () { return Math.random() * 2 - 1; };

  /* ---------- Estado ---------- */
  var inicio = { pi: 4.0, i: 4.75, fuente: "valores de referencia" };
  var e, historia, mazo, trimestre, perdidaTotal, enRango;

  function nuevaPartida() {
    e = { pi: inicio.pi, i: inicio.i, y: 0, cred: 0.7, arrastre: { d: 0, s: 0 } };
    historia = [{ pi: e.pi, i: e.i, y: e.y }];
    mazo = EVENTOS.slice().sort(function () { return Math.random() - 0.5; }).slice(0, TRIMESTRES);
    trimestre = 0; perdidaTotal = 0; enRango = 0;
  }

  /* ---------- Modelo ---------- */
  function avanzar(deltaPb, ev) {
    var i = Math.max(0, e.i + deltaPb / 100);
    var esperada = e.cred * META + (1 - e.cred) * e.pi;
    var brechaTasa = (i - esperada) - TASA_NEUTRAL_REAL;
    var d = ev.d + 0.5 * e.arrastre.d, s = ev.s + 0.5 * e.arrastre.s; // los shocks persisten
    var y = 0.7 * e.y - 0.45 * brechaTasa + d + azar() * 0.15;
    var pi = 0.6 * e.pi + 0.4 * esperada + 0.35 * y + s - 0.2 * (deltaPb / 100) + azar() * 0.1;
    var fueraDeRango = Math.abs(pi - META) > 1;
    var cred = fueraDeRango ? Math.max(0.2, e.cred - 0.12) : Math.min(0.9, e.cred + 0.05);

    perdidaTotal += Math.pow(pi - META, 2) + 0.5 * y * y + 0.25 * Math.pow(deltaPb / 100, 2);
    if (!fueraDeRango) enRango++;

    var antes = e;
    e = { pi: pi, i: i, y: y, cred: cred, arrastre: { d: ev.d, s: ev.s } };
    historia.push({ pi: pi, i: i, y: y });
    return antes;
  }

  /* ---------- Textos ---------- */
  function textoActividad(y) {
    if (y > 1.5) return "La economía se sobrecalienta";
    if (y > 0.5) return "Actividad sobre su potencial";
    if (y < -1.5) return "La economía está en recesión";
    if (y < -0.5) return "Actividad bajo su potencial";
    return "Actividad en torno a su potencial";
  }
  function pistas(ev) {
    var p = [];
    if (ev.d > 0) p.push("Demanda ↑"); if (ev.d < 0) p.push("Demanda ↓");
    if (ev.s > 0) p.push("Precios ↑"); if (ev.s < 0) p.push("Precios ↓");
    return p.length ? p : ["Sin presiones"];
  }
  function titulo(p) {
    if (p >= 85) return "Gobernador/a de excepción";
    if (p >= 70) return "Consejero/a sólido/a";
    if (p >= 50) return "Aprobado con observaciones";
    return "El mercado pide su renuncia";
  }

  /* ---------- Render ---------- */
  function flecha(nuevo, viejo) {
    var d = nuevo - viejo;
    if (Math.abs(d) < 0.05) return "";
    return d > 0 ? " ↑" : " ↓";
  }

  function tablero(antes) {
    $("sim-tpm").textContent = fmt(e.i, 2) + "%" + (antes ? flecha(e.i, antes.i) : "");
    $("sim-inf").textContent = fmt(e.pi) + "%" + (antes ? flecha(e.pi, antes.pi) : "");
    $("sim-inf").parentNode.classList.toggle("is-alerta", Math.abs(e.pi - META) > 1);
    $("sim-act").textContent = (e.y >= 0 ? "+" : "") + fmt(e.y) + "%";
    $("sim-act-txt").textContent = textoActividad(e.y);
    $("sim-cred").style.width = Math.round(e.cred * 100) + "%";
    $("sim-cred-txt").textContent = Math.round(e.cred * 100) + "%";
    grafico();
  }

  function grafico() {
    var W = 560, H = 230, m = { l: 34, r: 12, t: 12, b: 26 };
    var vals = [];
    historia.forEach(function (h) { vals.push(h.pi, h.i); });
    var minY = Math.min(0, Math.floor(Math.min.apply(null, vals)));
    var maxY = Math.max(8, Math.ceil(Math.max.apply(null, vals)));
    var X = function (k) { return m.l + (W - m.l - m.r) * k / TRIMESTRES; };
    var Y = function (v) { return m.t + (H - m.t - m.b) * (1 - (v - minY) / (maxY - minY)); };
    var linea = function (clave) {
      return historia.map(function (h, k) { return (k ? "L" : "M") + X(k).toFixed(1) + " " + Y(h[clave]).toFixed(1); }).join(" ");
    };
    var ejes = "";
    for (var v = minY; v <= maxY; v += 2) {
      ejes += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" class="sim-g-grid"/>' +
        '<text x="' + (m.l - 6) + '" y="' + (Y(v) + 4) + '" class="sim-g-eje" text-anchor="end">' + v + '%</text>';
    }
    for (var k = 0; k <= TRIMESTRES; k++) {
      ejes += '<text x="' + X(k) + '" y="' + (H - 6) + '" class="sim-g-eje" text-anchor="middle">' + (k === 0 ? "Hoy" : "T" + k) + '</text>';
    }
    var puntos = historia.map(function (h, k) {
      return '<circle cx="' + X(k) + '" cy="' + Y(h.pi) + '" r="3.5" class="sim-g-pi-pt"/>';
    }).join("");
    $("sim-grafico").innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Evolución de la inflación y la tasa de política monetaria">' +
      '<rect x="' + m.l + '" y="' + Y(4) + '" width="' + (W - m.l - m.r) + '" height="' + (Y(2) - Y(4)) + '" class="sim-g-rango"/>' +
      ejes +
      '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(3) + '" y2="' + Y(3) + '" class="sim-g-meta"/>' +
      '<path d="' + linea("i") + '" class="sim-g-tpm"/>' +
      '<path d="' + linea("pi") + '" class="sim-g-pi"/>' + puntos +
      '</svg>';
  }

  function mostrarEvento() {
    var ev = mazo[trimestre];
    $("sim-trimestre").textContent = "Trimestre " + (trimestre + 1) + " de " + TRIMESTRES;
    $("sim-ev-titulo").textContent = ev.t;
    $("sim-ev-texto").textContent = ev.x;
    $("sim-ev-pistas").innerHTML = pistas(ev).map(function (p) { return "<span>" + p + "</span>"; }).join("");
    $("sim-botones").querySelectorAll("button").forEach(function (b) {
      b.disabled = e.i + Number(b.dataset.pb) / 100 < 0;
    });
  }

  function decidir(pb) {
    var ev = mazo[trimestre];
    var antes = avanzar(pb, ev);
    trimestre++;
    tablero(antes);

    var decision = pb === 0 ? "mantuviste la TPM en " + fmt(e.i, 2) + "%" :
      (pb > 0 ? "subiste" : "bajaste") + " la TPM " + Math.abs(pb) + " pb, a " + fmt(e.i, 2) + "%";
    var credTxt = e.cred < antes.cred ? " Las expectativas se desanclan: la credibilidad cae." :
      (e.cred > antes.cred && e.cred < 0.9 ? " La credibilidad se fortalece." : "");
    $("sim-informe").innerHTML = "<strong>Informe del trimestre " + trimestre + ":</strong> " + decision +
      ". La inflación llegó a " + fmt(e.pi) + "% y " + textoActividad(e.y).toLowerCase() + "." + credTxt;

    if (trimestre >= TRIMESTRES) return finalizar();
    mostrarEvento();
  }

  function finalizar() {
    var puntaje = Math.round(100 * Math.exp(-perdidaTotal / ESCALA_PUNTAJE));
    $("sim-juego").hidden = true;
    $("sim-final").hidden = false;
    $("sim-puntaje").textContent = puntaje;
    $("sim-titulo-final").textContent = titulo(puntaje);
    $("sim-resumen").textContent =
      "Terminaste con una inflación de " + fmt(e.pi) + "% y una TPM de " + fmt(e.i, 2) + "%. " +
      "Mantuviste la inflación dentro del rango de tolerancia (2%–4%) en " + enRango + " de " + TRIMESTRES + " trimestres, " +
      "con una credibilidad final de " + Math.round(e.cred * 100) + "%.";
    $("sim-grafico-final").innerHTML = $("sim-grafico").innerHTML; // tu trayectoria completa
    $("sim-final").dataset.puntaje = puntaje;
    $("sim-final").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function compartir() {
    var p = $("sim-final").dataset.puntaje;
    var texto = "Fui el Banco Central por dos años en el simulador de la SUE y obtuve " + p + "/100 (" + titulo(p) + "). ¿Lo haces mejor?";
    var url = location.href.split("#")[0];
    if (navigator.share) {
      navigator.share({ title: "Sé el Banco Central — SUE", text: texto, url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(texto + " " + url).then(function () {
        $("sim-compartir").textContent = "¡Copiado!";
        setTimeout(function () { $("sim-compartir").textContent = "Compartir resultado"; }, 2000);
      });
    }
  }

  function empezar() {
    nuevaPartida();
    $("sim-intro").hidden = true;
    $("sim-final").hidden = true;
    $("sim-juego").hidden = false;
    $("sim-informe").textContent = "Lee el shock del trimestre y decide qué hacer con la tasa.";
    tablero(null);
    mostrarEvento();
    $("sim-juego").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- Datos reales de partida (mindicador.cl) ---------- */
  function cargarInicio() {
    var pedir = function (u) { return fetch(u).then(function (r) { if (!r.ok) throw 0; return r.json(); }); };
    Promise.all([pedir("https://mindicador.cl/api/ipc"), pedir("https://mindicador.cl/api/tpm")])
      .then(function (r) {
        var serie = (r[0].serie || []).slice(0, 12);
        var tpm = r[1].serie && r[1].serie[0] && r[1].serie[0].valor;
        if (serie.length === 12 && typeof tpm === "number") {
          var anual = serie.reduce(function (acc, m) { return acc * (1 + m.valor / 100); }, 1);
          inicio = { pi: (anual - 1) * 100, i: tpm, fuente: "datos reales de hoy (mindicador.cl)" };
        }
      })
      .catch(function () { /* se usan los valores de referencia */ })
      .then(function () {
        $("sim-ini-inf").textContent = fmt(inicio.pi) + "%";
        $("sim-ini-tpm").textContent = fmt(inicio.i, 2) + "%";
        $("sim-ini-fuente").textContent = "Punto de partida: " + inicio.fuente + ".";
        $("sim-empezar").disabled = false;
      });
  }

  /* ---------- Inicio ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    $("sim-botones").innerHTML = OPCIONES.map(function (pb) {
      var txt = pb === 0 ? "Mantener" : (pb > 0 ? "+" : "−") + Math.abs(pb) + " pb";
      return '<button type="button" class="sim-op' + (pb === 0 ? " is-mantener" : "") + '" data-pb="' + pb + '">' + txt + "</button>";
    }).join("");
    $("sim-botones").addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (b && !b.disabled) decidir(Number(b.dataset.pb));
    });
    $("sim-empezar").addEventListener("click", empezar);
    $("sim-otra").addEventListener("click", empezar);
    $("sim-compartir").addEventListener("click", compartir);
    cargarInicio();
  });
})();
