/* ==========================================================================
   simulador.js — "Sé el Banco Central" · SUE
   Modelo macroeconómico trimestral simplificado, con fines educativos:
   - Expectativas: ancladas a la meta de 3% según la credibilidad.
   - Actividad (brecha de producto): cae cuando la tasa real supera la neutral.
   - Inflación: persistente; sube con la actividad y los shocks de costos, y
     baja cuando sube la tasa (menos demanda y un peso más apreciado).
   - Credibilidad: cae si la inflación sale del rango de 2%–4% y se recupera
     cuando vuelve.
   Puntaje: se compara con un "piloto automático" que enfrenta exactamente los
   mismos shocks sin mover la tasa (piloto automático = 50 puntos).
   No representa las proyecciones ni los modelos del Banco Central de Chile.
   ========================================================================== */
(function () {
  "use strict";

  var META = 3, TASA_NEUTRAL_REAL = 1, TRIMESTRES = 8;
  var OPCIONES = [-150, -100, -50, -25, 0, 25, 50, 100, 150]; // puntos base
  var CLAVE_RECORDS = "sue-simulador-records";

  /* ---------- Shocks ---------- */
  var S = {
    cobreCae: ["El precio del cobre cae con fuerza", "Menores ingresos por exportaciones frenan la inversión y el peso se deprecia, lo que encarece los importados.", -0.9, 0.4, "Shock externo"],
    petroleo: ["Se dispara el precio del petróleo", "Suben los combustibles y el transporte; la actividad se resiente levemente.", -0.3, 1.0, "Shock de costos"],
    china: ["China se desacelera", "Cae la demanda por nuestras exportaciones y la economía se enfría.", -1.1, 0, "Shock externo"],
    liquidez: ["Los hogares reciben una fuerte inyección de liquidez", "El consumo se acelera y presiona los precios al alza.", 1.2, 0.4, "Shock de demanda"],
    fed: ["La Reserva Federal sube sus tasas", "Salen capitales de las economías emergentes y el peso se deprecia.", 0, 0.7, "Shock financiero"],
    cosecha: ["Buena cosecha y alimentos más baratos", "Los precios de los alimentos bajan más de lo esperado.", 0, -0.6, "Shock de costos"],
    inversion: ["Boom de inversión minera", "Nuevos proyectos impulsan la inversión y el empleo.", 0.9, 0, "Shock de demanda"],
    tranquilo: ["Un trimestre tranquilo", "Sin sorpresas relevantes. ¿Aprovechas de ajustar el rumbo?", 0, 0, "Sin shock"],
    sequia: ["Sequía en la zona central", "Suben los precios de frutas y verduras.", 0, 0.8, "Shock de costos"],
    externa: ["Repunte de la demanda externa", "Nuestros socios comerciales crecen más de lo esperado.", 0.7, 0, "Shock externo"],
    confianza: ["Crisis de confianza empresarial", "Las empresas postergan inversiones y contratan menos.", -0.7, -0.3, "Shock de demanda"],
    turismo: ["Temporada récord de turismo", "Más demanda por servicios presiona los precios internos.", 0.5, 0.5, "Shock de demanda"],
    lehman: ["Quiebra Lehman Brothers", "Pánico en los mercados financieros: el crédito se congela en todo el mundo.", -1.6, 0, "Shock financiero"],
    comercio: ["Se desploma el comercio mundial", "Caen las exportaciones y las empresas recortan producción.", -1.2, -0.3, "Shock externo"],
    petroleoCae: ["El petróleo se derrumba", "Bajan con fuerza los combustibles y el transporte.", 0, -1.1, "Shock de costos"],
    desempleo: ["Sube el desempleo", "Los hogares recortan su consumo ante la incertidumbre.", -0.6, -0.2, "Shock de demanda"],
    fiscal: ["El gobierno anuncia un estímulo fiscal", "Más gasto público y transferencias sostienen la demanda.", 0.8, 0.1, "Política fiscal"],
    cobreSube: ["El precio del cobre se recupera", "Vuelven los ingresos por exportaciones y el peso se aprecia.", 0.7, -0.2, "Shock externo"],
    confinamiento: ["Confinamientos por la pandemia", "Cierran comercios y oficinas: la actividad cae como nunca.", -2.4, -0.2, "Shock sanitario"],
    cierre: ["La economía sigue semicerrada", "El empleo no se recupera y muchas empresas están en pausa.", -1.3, 0, "Shock sanitario"],
    dolarPanico: ["El dólar se dispara", "La incertidumbre deprecia el peso y encarece los importados.", 0, 0.6, "Shock financiero"],
    retiro: ["Retiro de fondos previsionales", "Millones de personas reciben liquidez y el consumo se dispara.", 1.8, 0.5, "Shock de demanda"],
    reapertura: ["Reapertura de la economía", "La demanda reprimida vuelve con fuerza.", 1.5, 0.4, "Shock de demanda"],
    cuellos: ["Cuellos de botella globales", "Los fletes y los insumos se encarecen en todo el mundo.", -0.2, 1.0, "Shock de costos"],
    retiro2: ["Nuevo retiro de fondos previsionales", "Otra ola de liquidez empuja el consumo.", 1.2, 0.6, "Shock de demanda"],
    ucrania: ["Guerra en Ucrania", "Se disparan la energía y los alimentos a nivel mundial.", -0.3, 1.3, "Shock de costos"],
    pesoCae: ["El peso se deprecia con fuerza", "El dólar sube y encarece todo lo importado.", 0, 0.8, "Shock financiero"],
    alimentos: ["Los alimentos siguen subiendo", "La canasta básica se encarece mes a mes.", 0, 0.7, "Shock de costos"],
    enfria: ["El consumo se enfría", "Los hogares agotaron sus ahorros extra y gastan menos.", -0.9, -0.1, "Shock de demanda"],
    terremoto: ["Terremoto en la zona centro-sur", "Se destruye infraestructura y cae la producción.", -1.0, 0.3, "Desastre natural"],
    reconstruccion: ["Comienza la reconstrucción", "La inversión pública y privada se acelera.", 1.0, 0.1, "Shock de demanda"],
    cobreRecord: ["El cobre alcanza precios récord", "Entran divisas, se aprecia el peso y la inversión minera se dispara.", 1.0, -0.3, "Shock externo"],
    euro: ["Crisis de deuda en Europa", "Vuelve la incertidumbre global y se frenan las exportaciones.", -0.8, 0.1, "Shock externo"]
  };
  var POOL_HOY = ["cobreCae", "petroleo", "china", "liquidez", "fed", "cosecha", "inversion", "tranquilo", "sequia", "externa", "confianza", "turismo", "cuellos", "pesoCae", "fiscal", "cobreSube"];

  /* ---------- Escenarios ---------- */
  var ESCENARIOS = [
    { id: "hoy", n: "Chile hoy", tag: "Datos actuales", dif: 2, escala: 1.6,
      desc: "Partes con la inflación y la TPM reales de hoy. Los shocks cambian en cada partida.",
      ini: { pi: 4.0, i: 4.75, y: 0, cred: 0.7 }, azar: true },
    { id: "2008", n: "Crisis financiera global", tag: "Inspirado en 2008–2009", dif: 3,
      desc: "La inflación está alta, pero se viene la peor crisis financiera en décadas. ¿Cuándo empiezas a bajar la tasa?",
      ini: { pi: 8.5, i: 8.25, y: 1.0, cred: 0.6 }, mazo: ["lehman", "comercio", "cobreCae", "petroleoCae", "desempleo", "fiscal", "cobreSube", "tranquilo"] },
    { id: "2010", n: "Terremoto y superciclo del cobre", tag: "Inspirado en 2010–2011", dif: 2,
      desc: "Un terremoto golpea al país y luego el cobre vive precios récord. La tasa está en mínimos: ¿cuándo normalizarla?",
      ini: { pi: 1.5, i: 0.75, y: -1.5, cred: 0.8 }, mazo: ["terremoto", "reconstruccion", "cobreRecord", "inversion", "alimentos", "euro", "externa", "tranquilo"] },
    { id: "2020", n: "Pandemia", tag: "Inspirado en 2020–2021", dif: 3,
      desc: "La economía se cierra de golpe. Después llegan la liquidez y la reapertura. Evita la recesión sin desatar la inflación.",
      ini: { pi: 3.5, i: 1.75, y: 0, cred: 0.8 }, mazo: ["confinamiento", "cierre", "dolarPanico", "fiscal", "retiro", "reapertura", "cuellos", "retiro2"] },
    { id: "2022", n: "La gran inflación", tag: "Inspirado en 2021–2022", dif: 4,
      desc: "La economía está sobrecalentada y la tasa, en el suelo. Se vienen shocks de costos globales. Recupera el control de los precios.",
      ini: { pi: 4.5, i: 0.75, y: 2.0, cred: 0.75 }, mazo: ["retiro2", "cuellos", "ucrania", "pesoCae", "alimentos", "enfria", "cobreCae", "petroleoCae"] }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var fmt = function (n, dec) {
    dec = dec == null ? 1 : dec;
    return Number(n).toLocaleString("es-CL", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };
  var signo = function (n, dec) { return (n > 0 ? "+" : n < 0 ? "−" : "") + fmt(Math.abs(n), dec); };
  var azar = function () { return Math.random() * 2 - 1; };
  var esc = ESCENARIOS[0];

  /* ---------- Modelo ---------- */
  function paso(e, deltaPb, ev, ruido) {
    var i = Math.max(0, e.i + deltaPb / 100);
    var esperada = e.cred * META + (1 - e.cred) * e.pi;
    var d = ev.d + 0.4 * e.arr.d, s = ev.s + 0.4 * e.arr.s;      // los shocks persisten
    var y = 0.6 * e.y - 0.5 * ((i - esperada) - TASA_NEUTRAL_REAL) + d + ruido[0];
    var pi = 0.45 * e.pi + 0.55 * esperada + 0.3 * y + s - 0.3 * (deltaPb / 100) + ruido[1];
    var cred = Math.abs(pi - META) > 1 ? Math.max(0.35, e.cred - 0.1) : Math.min(0.9, e.cred + 0.05);
    return { pi: pi, i: i, y: y, cred: cred, arr: { d: ev.d, s: ev.s },
      perdida: Math.pow(pi - META, 2) + 0.5 * y * y + 0.2 * Math.pow(deltaPb / 100, 2) };
  }

  /* ---------- Partida ---------- */
  var P; // estado de la partida
  function nuevaPartida() {
    var claves = esc.azar ? POOL_HOY.slice().sort(function () { return Math.random() - 0.5; }).slice(0, TRIMESTRES) : esc.mazo;
    var k = esc.escala || 1;
    var ini = { pi: esc.ini.pi, i: esc.ini.i, y: esc.ini.y, cred: esc.ini.cred, arr: { d: 0, s: 0 } };
    P = {
      eventos: claves.map(function (c) { var s = S[c]; return { t: s[0], x: s[1], d: s[2] * k, s: s[3] * k, tipo: s[4] }; }),
      ruido: claves.map(function () { return [azar() * 0.15, azar() * 0.1]; }),
      e: ini, piloto: ini,
      hist: [{ pi: ini.pi, i: ini.i }], histPiloto: [{ pi: ini.pi }],
      t: 0, perdida: 0, perdidaPiloto: 0, enRango: 0
    };
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
    if (ev.d > 0.05) p.push("Demanda ↑"); if (ev.d < -0.05) p.push("Demanda ↓");
    if (ev.s > 0.05) p.push("Precios ↑"); if (ev.s < -0.05) p.push("Precios ↓");
    return p.length ? p : ["Sin presiones"];
  }
  function titulo(p) {
    if (p >= 85) return "Gobernador/a de excepción";
    if (p >= 70) return "Consejero/a sólido/a";
    if (p >= 55) return "Aprobado con observaciones";
    return "El mercado pide su renuncia";
  }
  function dificultad(n) {
    var s = ""; for (var k = 1; k <= 4; k++) s += '<i class="' + (k <= n ? "on" : "") + '"></i>';
    return '<span class="sim-dif" aria-label="Dificultad ' + n + ' de 4">' + s + "</span>";
  }

  /* ---------- Récords ---------- */
  function records() { try { return JSON.parse(localStorage.getItem(CLAVE_RECORDS)) || {}; } catch (e) { return {}; } }
  function guardarRecord(id, p) {
    var r = records(); var nuevo = !r[id] || p > r[id];
    if (nuevo) { r[id] = p; try { localStorage.setItem(CLAVE_RECORDS, JSON.stringify(r)); } catch (e) {} }
    return nuevo;
  }

  /* ---------- Gráfico (colores escritos en el SVG) ---------- */
  function grafico(conPiloto, contenedor) {
    // Se dibuja al ancho real del recuadro para que el texto se lea bien también en teléfonos
    var W = Math.max(300, Math.min(640, (contenedor && contenedor.clientWidth ? contenedor.clientWidth - 22 : 560)));
    var H = W < 420 ? 220 : 240, m = { l: 36, r: 56, t: 14, b: 26 };
    var vals = [];
    P.hist.forEach(function (h) { vals.push(h.pi, h.i); });
    if (conPiloto) P.histPiloto.forEach(function (h) { vals.push(h.pi); });
    var minY = Math.min(0, Math.floor(Math.min.apply(null, vals)));
    var maxY = Math.max(8, Math.ceil(Math.max.apply(null, vals)));
    if ((maxY - minY) % 2) maxY++;
    var X = function (k) { return m.l + (W - m.l - m.r) * k / TRIMESTRES; };
    var Y = function (v) { return m.t + (H - m.t - m.b) * (1 - (v - minY) / (maxY - minY)); };
    var linea = function (serie, clave) {
      return serie.map(function (h, k) { return (k ? "L" : "M") + X(k).toFixed(1) + " " + Y(h[clave]).toFixed(1); }).join(" ");
    };
    var paso2 = (maxY - minY) > 12 ? 4 : 2, g = "";
    for (var v = Math.ceil(minY / paso2) * paso2; v <= maxY; v += paso2) {
      g += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#e3e0d2" stroke-width="1"/>' +
        '<text x="' + (m.l - 7) + '" y="' + (Y(v) + 4) + '" text-anchor="end" font-size="11" fill="#b7545e" font-family="Montserrat, sans-serif">' + v + '%</text>';
    }
    var etiquetaX = function (k) { return k === 0 ? (W < 420 ? "0" : "Inicio") : "T" + k; };
    for (var k = 0; k <= TRIMESTRES; k++) {
      g += '<text x="' + X(k) + '" y="' + (H - 7) + '" text-anchor="middle" font-size="11" fill="#b7545e" font-family="Montserrat, sans-serif">' + etiquetaX(k) + "</text>";
    }
    var banda = '<rect x="' + m.l + '" y="' + Y(4) + '" width="' + (W - m.l - m.r) + '" height="' + (Y(2) - Y(4)) + '" fill="#b98a1f" fill-opacity="0.13"/>';
    var meta = '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(3) + '" y2="' + Y(3) + '" stroke="#b98a1f" stroke-width="1.5" stroke-dasharray="5 5"/>' +
      '<text x="' + (W - m.r + 6) + '" y="' + (Y(3) + 4) + '" font-size="11" font-weight="600" fill="#9a7318" font-family="Montserrat, sans-serif">Meta 3%</text>';
    var piloto = conPiloto ? '<path d="' + linea(P.histPiloto, "pi") + '" fill="none" stroke="#8a8f9c" stroke-width="2" stroke-dasharray="6 5"/>' : "";
    var tpm = '<path d="' + linea(P.hist, "i") + '" fill="none" stroke="#172340" stroke-width="2.25" stroke-linejoin="round"/>';
    var inf = '<path d="' + linea(P.hist, "pi") + '" fill="none" stroke="#CD1729" stroke-width="3" stroke-linejoin="round"/>' +
      P.hist.map(function (h, k) { return '<circle cx="' + X(k) + '" cy="' + Y(h.pi) + '" r="3.8" fill="#CD1729"/>'; }).join("");
    return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Evolución de la inflación y la TPM">' + banda + g + meta + piloto + tpm + inf + "</svg>";
  }

  /* ---------- Pantallas ---------- */
  function flecha(nuevo, viejo) { var d = nuevo - viejo; return Math.abs(d) < 0.05 ? "" : (d > 0 ? " ↑" : " ↓"); }

  function tablero(antes) {
    var e = P.e;
    $("sim-tpm").textContent = fmt(e.i, 2) + "%" + (antes ? flecha(e.i, antes.i) : "");
    $("sim-inf").textContent = fmt(e.pi) + "%" + (antes ? flecha(e.pi, antes.pi) : "");
    $("sim-inf").parentNode.classList.toggle("is-alerta", Math.abs(e.pi - META) > 1);
    $("sim-act").textContent = signo(e.y) + "%";
    $("sim-act-txt").textContent = textoActividad(e.y);
    $("sim-cred").style.width = Math.round(e.cred * 100) + "%";
    $("sim-cred-txt").textContent = Math.round(e.cred * 100) + "%";
    $("sim-grafico").innerHTML = grafico(false, $("sim-grafico"));
    $("sim-progreso").innerHTML = P.eventos.map(function (_, k) {
      return '<i class="' + (k < P.t ? "hecho" : k === P.t ? "actual" : "") + '"></i>';
    }).join("");
  }

  function mostrarEvento() {
    var ev = P.eventos[P.t];
    $("sim-trimestre").textContent = "Trimestre " + (P.t + 1) + " de " + TRIMESTRES;
    $("sim-ev-tipo").textContent = ev.tipo;
    $("sim-ev-titulo").textContent = ev.t;
    $("sim-ev-texto").textContent = ev.x;
    $("sim-ev-pistas").innerHTML = pistas(ev).map(function (p) { return "<span>" + p + "</span>"; }).join("");
    $("sim-botones").querySelectorAll("button").forEach(function (b) {
      b.disabled = P.e.i + Number(b.dataset.pb) / 100 < 0;
    });
    $("sim-preview").textContent = "TPM actual: " + fmt(P.e.i, 2) + "%";
  }

  function decidir(pb) {
    var t = P.t, ev = P.eventos[t], r = P.ruido[t], antes = P.e;
    var nuevo = paso(antes, pb, ev, r);
    var sinDecision = paso(antes, 0, ev, r);                 // mismo trimestre sin mover la tasa
    var piloto = paso(P.piloto, 0, ev, r);                   // piloto automático desde el inicio

    P.e = nuevo; P.piloto = piloto; P.t++;
    P.perdida += nuevo.perdida; P.perdidaPiloto += piloto.perdida;
    if (Math.abs(nuevo.pi - META) <= 1) P.enRango++;
    P.hist.push({ pi: nuevo.pi, i: nuevo.i }); P.histPiloto.push({ pi: piloto.pi });
    tablero(antes);

    var accion = pb === 0 ? "Mantuviste la TPM en " + fmt(nuevo.i, 2) + "%" :
      (pb > 0 ? "Subiste" : "Bajaste") + " la TPM " + Math.abs(pb) + " pb, a " + fmt(nuevo.i, 2) + "%";
    var efecto = "";
    if (pb !== 0) {
      var dPi = nuevo.pi - sinDecision.pi;
      efecto = " Tu decisión " + (dPi < 0 ? "restó " : "sumó ") + fmt(Math.abs(dPi)) + " pp a la inflación: sin ella habría llegado a " + fmt(sinDecision.pi) + "%.";
    }
    var cred = nuevo.cred < antes.cred ? " Las expectativas se desanclan: la credibilidad cae." :
      (nuevo.cred > antes.cred && antes.cred < 0.9 ? " La credibilidad se fortalece." : "");
    $("sim-informe").innerHTML = "<strong>Informe del trimestre " + P.t + "</strong>" + accion + ". La inflación quedó en " +
      fmt(nuevo.pi) + "% y " + textoActividad(nuevo.y).toLowerCase() + "." + efecto + cred;

    if (P.t >= TRIMESTRES) return finalizar();
    mostrarEvento();
  }

  function finalizar() {
    var puntaje = Math.round(100 * P.perdidaPiloto / (P.perdidaPiloto + P.perdida));
    var nuevoRecord = guardarRecord(esc.id, puntaje);
    $("sim-juego").hidden = true;
    $("sim-final").hidden = false;
    $("sim-final-esc").textContent = esc.n;
    $("sim-puntaje").textContent = puntaje;
    $("sim-titulo-final").textContent = titulo(puntaje);
    $("sim-record").textContent = nuevoRecord ? "¡Nuevo récord personal en este escenario!" : "Tu récord en este escenario: " + records()[esc.id] + "/100";
    var comp = puntaje > 55 ? "Lo hiciste mejor que el piloto automático" : (puntaje >= 45 ? "Te fue parecido al piloto automático" : "El piloto automático lo habría hecho mejor");
    $("sim-resumen").innerHTML = comp + " (un Banco Central que enfrenta los mismos shocks sin mover la tasa, que obtiene 50 puntos). " +
      "Terminaste con una inflación de <strong>" + fmt(P.e.pi) + "%</strong> y una TPM de <strong>" + fmt(P.e.i, 2) + "%</strong>; " +
      "el piloto automático habría terminado con " + fmt(P.piloto.pi) + "%. Mantuviste la inflación en el rango de 2%–4% en " +
      P.enRango + " de " + TRIMESTRES + " trimestres.";
    $("sim-grafico-final").innerHTML = grafico(true, $("sim-grafico-final"));
    $("sim-final").dataset.puntaje = puntaje;
    renderEscenarios();
    $("sim-final").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function compartir() {
    var p = $("sim-final").dataset.puntaje;
    var texto = "Fui el Banco Central en el escenario «" + esc.n + "» del simulador de la SUE y obtuve " + p + "/100 (" + titulo(p) + "). ¿Lo haces mejor?";
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

  /* ---------- Selección de escenario ---------- */
  function renderEscenarios() {
    var r = records();
    $("sim-escenarios").innerHTML = ESCENARIOS.map(function (s) {
      return '<button type="button" class="sim-esc' + (s === esc ? " is-activo" : "") + '" data-id="' + s.id + '" aria-pressed="' + (s === esc) + '">' +
        '<span class="sim-esc-tag">' + s.tag + "</span>" +
        '<span class="sim-esc-nombre">' + s.n + "</span>" +
        '<span class="sim-esc-pie">' + dificultad(s.dif) + (r[s.id] ? '<span class="sim-esc-rec">Récord: ' + r[s.id] + "</span>" : "") + "</span>" +
        "</button>";
    }).join("");
    $("sim-esc-desc").textContent = esc.desc;
    $("sim-ini-inf").textContent = fmt(esc.ini.pi) + "%";
    $("sim-ini-tpm").textContent = fmt(esc.ini.i, 2) + "%";
    $("sim-ini-act").textContent = signo(esc.ini.y) + "%";
  }

  function empezar() {
    nuevaPartida();
    $("sim-intro").hidden = true;
    $("sim-final").hidden = true;
    $("sim-juego").hidden = false;
    $("sim-juego-esc").textContent = esc.n;
    $("sim-informe").innerHTML = "<strong>Primera reunión del Consejo</strong>Lee el shock del trimestre y decide qué hacer con la tasa.";
    tablero(null);
    mostrarEvento();
    $("sim-juego").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function volverAlMenu() {
    $("sim-final").hidden = true;
    $("sim-juego").hidden = true;
    $("sim-intro").hidden = false;
    renderEscenarios();
    $("sim-intro").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- Datos reales para "Chile hoy" (mindicador.cl) ---------- */
  function cargarHoy() {
    var pedir = function (u) { return fetch(u).then(function (r) { if (!r.ok) throw 0; return r.json(); }); };
    Promise.all([pedir("https://mindicador.cl/api/ipc"), pedir("https://mindicador.cl/api/tpm")])
      .then(function (r) {
        var serie = (r[0].serie || []).slice(0, 12);
        var tpm = r[1].serie && r[1].serie[0] && r[1].serie[0].valor;
        if (serie.length === 12 && typeof tpm === "number") {
          var anual = serie.reduce(function (acc, m) { return acc * (1 + m.valor / 100); }, 1);
          ESCENARIOS[0].ini.pi = (anual - 1) * 100;
          ESCENARIOS[0].ini.i = tpm;
          ESCENARIOS[0].desc = "Partes con la inflación anual y la TPM reales de hoy (mindicador.cl). Los shocks cambian en cada partida.";
        }
      })
      .catch(function () { ESCENARIOS[0].desc = "Partes con valores de referencia cercanos a los actuales. Los shocks cambian en cada partida."; })
      .then(function () { renderEscenarios(); $("sim-empezar").disabled = false; });
  }

  /* ---------- Inicio ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    $("sim-botones").innerHTML = OPCIONES.map(function (pb) {
      var txt = pb === 0 ? "Mantener" : (pb > 0 ? "+" : "−") + Math.abs(pb);
      return '<button type="button" class="sim-op' + (pb === 0 ? " is-mantener" : pb > 0 ? " is-sube" : " is-baja") + '" data-pb="' + pb + '"' +
        ' aria-label="' + (pb === 0 ? "Mantener la tasa" : (pb > 0 ? "Subir " : "Bajar ") + Math.abs(pb) + " puntos base") + '">' + txt + "</button>";
    }).join("");
    $("sim-botones").addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (b && !b.disabled) decidir(Number(b.dataset.pb));
    });
    var vistaPrevia = function (ev) {
      var b = ev.target.closest && ev.target.closest("button"); if (!b || !P) return;
      var pb = Number(b.dataset.pb);
      $("sim-preview").textContent = pb === 0 ? "TPM se mantiene en " + fmt(P.e.i, 2) + "%" : "Nueva TPM: " + fmt(Math.max(0, P.e.i + pb / 100), 2) + "%";
    };
    $("sim-botones").addEventListener("mouseover", vistaPrevia);
    $("sim-botones").addEventListener("focusin", vistaPrevia);

    $("sim-escenarios").addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b) return;
      esc = ESCENARIOS.filter(function (s) { return s.id === b.dataset.id; })[0] || esc;
      renderEscenarios();
    });
    $("sim-empezar").addEventListener("click", empezar);
    $("sim-otra").addEventListener("click", empezar);
    $("sim-menu").addEventListener("click", volverAlMenu);
    $("sim-compartir").addEventListener("click", compartir);

    renderEscenarios();
    cargarHoy();
  });
})();
