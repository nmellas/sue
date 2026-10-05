/* ==========================================================================
   simulador.js — "Sé el Banco Central" · SUE
   --------------------------------------------------------------------------
   Modelo macroeconómico trimestral de una economía pequeña y abierta, en la
   tradición del régimen de metas de inflación (Nuevo Keynesiano):

     · Curva IS dinámica con rezago de la tasa real      (Clarida-Galí-Gertler 1999)
     · Curva de Phillips híbrida con traspaso cambiario   (Galí-Gertler 1999; Ball 1999)
     · Tipo de cambio que responde a la tasa (UIP simplificada)
     · Expectativas ancladas según la credibilidad        (Barro-Gordon 1983)
     · Pérdida de "objetivo flexible" con suavizamiento   (Svensson 1997; Rudebusch-Svensson 1999)

   Los parámetros son pedagógicos, no estimados: buscan que el juego sea ágil y
   que cada decisión se note. No representa los modelos ni las proyecciones del
   Banco Central de Chile.

   PUNTAJE (0–100): para cada partida se busca, con una búsqueda por haz sobre
   las 9 decisiones posibles de cada trimestre, el recorrido que MINIMIZA la
   pérdida total (= 100 puntos) y el que la MAXIMIZA (= 0 puntos). Esos dos
   recorridos existen siempre, así que 0 y 100 siempre son alcanzables.
   ========================================================================== */
(function () {
  "use strict";
  var EN_NAVEGADOR = typeof document !== "undefined";

  /* ======================= 1. MODELO ======================= */
  var META = 3, RSTAR = 1, I_NEUTRAL = META + RSTAR, IMIN = 0.5, IMAX = 20;
  var ACCIONES = [-150, -100, -50, -25, 0, 25, 50, 100, 150]; // puntos base
  var PAR = {
    rhoY: 0.6, sigma: 0.7, eta: 0.12,          // IS: persistencia, sensibilidad a la tasa real, efecto cambiario
    gammaB: 0.5, lambdaY: 0.25, psi: 0.2,      // Phillips: inercia, brecha de actividad, traspaso cambiario
    rhoQ: 0.6, lamQd: 0.9, lamQl: 0.25,        // tipo de cambio: persistencia, efecto de cambios y de nivel de la tasa
    persist: 0.4,                              // fracción de cada shock que se arrastra al trimestre siguiente
    credUp: 0.04, credDn: 0.08, credMin: 0.3, credMax: 0.92,
    wY: 0.5, wI: 0.25                          // pesos de la función de pérdida
  };
  var NEUTRO = { d: 0, s: 0, fx: 0 }, CERO = [0, 0, 0];
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  function crearEstado(ini) {
    var pe = ini.cred * META + (1 - ini.cred) * ini.pi;
    return { pi: ini.pi, i: clamp(ini.i, IMIN, IMAX), y: ini.y, c: ini.cred, q: ini.q || 0, rp: ini.i - pe };
  }
  // e: estado; deltaPb: decisión; ev: shock del trimestre; arr: shock del trimestre anterior; n: ruido [y, π, q]
  function paso(e, deltaPb, ev, arr, n) {
    var i = clamp(e.i + deltaPb / 100, IMIN, IMAX);
    var pe = e.c * META + (1 - e.c) * e.pi;                    // expectativas de inflación
    var r = i - pe, rbar = 0.5 * r + 0.5 * e.rp;               // tasa real ex ante, con rezago de transmisión
    var d = ev.d + PAR.persist * arr.d, s = ev.s + PAR.persist * arr.s, fx = ev.fx + PAR.persist * arr.fx;
    var q = clamp(PAR.rhoQ * e.q - PAR.lamQd * (i - e.i) - PAR.lamQl * (i - I_NEUTRAL) + fx + n[2], -15, 25);
    var y = clamp(PAR.rhoY * e.y - PAR.sigma * (rbar - RSTAR) + PAR.eta * q + d + n[0], -9, 9);
    var pi = clamp(PAR.gammaB * e.pi + (1 - PAR.gammaB) * pe + PAR.lambdaY * y + PAR.psi * (q - e.q) + s + n[1], -2, 25);
    var fuera = Math.abs(pi - META) > 1, falta = Math.min(Math.abs(pi - META) - 1, 3);
    var c = fuera ? Math.max(PAR.credMin, e.c - PAR.credDn - 0.03 * falta) : Math.min(PAR.credMax, e.c + PAR.credUp);
    var dI = i - e.i;
    var lp = (pi - META) * (pi - META), ly = PAR.wY * y * y, li = PAR.wI * dI * dI;
    return { pi: pi, i: i, y: y, c: c, q: q, rp: r, perdida: lp + ly + li, lp: lp, ly: ly, li: li };
  }
  function valida(e, a) { var i = e.i + a / 100; return i >= IMIN - 1e-9 && i <= IMAX + 1e-9; }

  /* ======================= 2. BÚSQUEDA DEL MEJOR / PEOR RECORRIDO ======================= */
  // Búsqueda por haz con deduplicación de estados. modo: "min" (mejor) o "max" (peor).
  function buscar(estado, t0, evs, ruido, modo, ancho) {
    var T = evs.length, capa = [{ st: estado, loss: 0, par: -1, act: 0 }], hist = [capa];
    for (var t = t0; t < T; t++) {
      var mapa = new Map(), arr = t === 0 ? NEUTRO : evs[t - 1];
      for (var idx = 0; idx < capa.length; idx++) {
        var nodo = capa[idx];
        for (var k = 0; k < ACCIONES.length; k++) {
          var a = ACCIONES[k];
          if (!valida(nodo.st, a)) continue;
          var r = paso(nodo.st, a, evs[t], arr, ruido[t]), loss = nodo.loss + r.perdida;
          var clave = Math.round(r.i * 4) + "|" + Math.round(r.pi / 0.05) + "|" + Math.round(r.y / 0.05) + "|" +
                      Math.round(r.c / 0.02) + "|" + Math.round(r.q / 0.2) + "|" + Math.round(r.rp / 0.1);
          var prev = mapa.get(clave);
          if (!prev || (modo === "min" ? loss < prev.loss : loss > prev.loss)) mapa.set(clave, { st: r, loss: loss, par: idx, act: a });
        }
      }
      var nueva = Array.from(mapa.values());
      if (nueva.length > ancho) {
        nueva.sort(function (x, y) { return modo === "min" ? x.loss - y.loss : y.loss - x.loss; });
        nueva = nueva.slice(0, ancho);
      }
      capa = nueva; hist.push(capa);
    }
    var mejor = capa[0];
    for (var m = 1; m < capa.length; m++) if (modo === "min" ? capa[m].loss < mejor.loss : capa[m].loss > mejor.loss) mejor = capa[m];
    var acts = [], nodo2 = mejor, kk = hist.length - 1;
    while (kk > 0) { acts.unshift(nodo2.act); nodo2 = hist[kk - 1][nodo2.par]; kk--; }
    return { acts: acts, loss: mejor.loss };
  }
  // Simula una secuencia exacta de decisiones (la misma lógica del juego)
  function simular(estado, acts, evs, ruido, t0) {
    t0 = t0 || 0;
    var e = estado, L = 0, tray = [];
    acts.forEach(function (a, k) {
      var t = t0 + k, arr = t === 0 ? NEUTRO : evs[t - 1];
      e = paso(e, a, evs[t], arr, ruido[t]); L += e.perdida; tray.push(e);
    });
    return { loss: L, tray: tray };
  }
  // Puntaje 0–100: 100 = pérdida mínima posible, 0 = pérdida máxima posible.
  // Escala logarítmica sobre cuántas veces peor que el óptimo fue la pérdida.
  var R0 = 0.3, KAPPA_POR_TRIM = 1;
  function puntajeDe(L, Lb, Lw, T) {
    var den = Lb + KAPPA_POR_TRIM * T, r = Math.max(0, (L - Lb) / den), rw = Math.max(1, (Lw - Lb) / den);
    return clamp(100 * (1 - Math.log(1 + r / R0) / Math.log(1 + rw / R0)), 0, 100);
  }

  /* ======================= 3. ESCENARIOS ======================= */
const S = {
  cobreCae: ["El precio del cobre cae con fuerza", "Menores ingresos por exportaciones frenan la inversión y el peso se deprecia, lo que encarece los importados.", -0.9, 0.3, 0.9, "Shock externo"],
  petroleo: ["Se dispara el precio del petróleo", "Suben los combustibles y el transporte; la actividad se resiente levemente.", -0.3, 1.0, 0.1, "Shock de costos"],
  china: ["China se desacelera", "Cae la demanda por nuestras exportaciones y la economía se enfría.", -1.1, 0, 0.5, "Shock externo"],
  liquidez: ["Los hogares reciben una fuerte inyección de liquidez", "El consumo se acelera y presiona los precios al alza.", 1.2, 0.4, 0, "Shock de demanda"],
  fed: ["La Reserva Federal sube sus tasas", "Salen capitales de las economías emergentes y el peso se deprecia.", -0.2, 0.3, 1.0, "Shock financiero"],
  cosecha: ["Buena cosecha y alimentos más baratos", "Los precios de los alimentos bajan más de lo esperado.", 0, -0.6, 0, "Shock de costos"],
  inversion: ["Boom de inversión minera", "Nuevos proyectos impulsan la inversión y el empleo.", 0.9, 0, -0.3, "Shock de demanda"],
  tranquilo: ["Un trimestre tranquilo", "Sin sorpresas relevantes. ¿Aprovechas de ajustar el rumbo?", 0, 0, 0, "Sin shock"],
  sequia: ["Sequía en la zona central", "Suben los precios de frutas y verduras.", 0, 0.8, 0, "Shock de costos"],
  externa: ["Repunte de la demanda externa", "Nuestros socios comerciales crecen más de lo esperado.", 0.7, 0, -0.4, "Shock externo"],
  confianza: ["Crisis de confianza empresarial", "Las empresas postergan inversiones y contratan menos.", -0.7, -0.2, 0.3, "Shock de demanda"],
  turismo: ["Temporada récord de turismo", "Más demanda por servicios presiona los precios internos.", 0.5, 0.5, -0.1, "Shock de demanda"],
  cuellos: ["Cuellos de botella globales", "Los fletes y los insumos se encarecen en todo el mundo.", -0.2, 1.0, 0.2, "Shock de costos"],
  pesoCae: ["El peso se deprecia con fuerza", "El dólar sube y encarece todo lo importado.", 0, 0.5, 1.2, "Shock financiero"],
  fiscal: ["El gobierno anuncia un estímulo fiscal", "Más gasto público y transferencias sostienen la demanda.", 0.8, 0.1, 0, "Política fiscal"],
  cobreSube: ["El precio del cobre se recupera", "Vuelven los ingresos por exportaciones y el peso se aprecia.", 0.7, -0.2, -0.9, "Shock externo"],
  petroleoCae: ["El petróleo se derrumba", "Bajan con fuerza los combustibles y el transporte.", 0.1, -1.1, 0, "Shock de costos"],
  desempleo: ["Sube el desempleo", "Los hogares recortan su consumo ante la incertidumbre.", -0.6, -0.2, 0.2, "Shock de demanda"],
  enfria: ["El consumo se enfría", "Los hogares agotaron sus ahorros extra y gastan menos.", -0.9, -0.1, 0, "Shock de demanda"],
  alimentos: ["Los alimentos siguen subiendo", "La canasta básica se encarece mes a mes.", 0, 0.7, 0, "Shock de costos"],
  ucrania: ["Guerra en Ucrania", "Se disparan la energía y los alimentos a nivel mundial.", -0.3, 1.3, 0.3, "Shock de costos"],
  euro: ["Crisis de deuda en Europa", "Vuelve la incertidumbre global y se frenan las exportaciones.", -0.8, 0.1, 0.5, "Shock externo"],
  tarifas: ["Suben las tarifas eléctricas", "El alza de la energía se traspasa a los precios de toda la economía.", -0.1, 0.8, 0.1, "Shock de costos"],
  dolarSube: ["Sube el dólar y la incertidumbre global", "Los inversionistas buscan refugio y el peso se debilita.", -0.2, 0.3, 0.8, "Shock financiero"],
  // Crisis financiera global (2007–2010)
  boomCobre: ["Boom del cobre", "Precios récord impulsan la inversión minera y aprecian el peso.", 0.8, -0.2, -0.6, "Shock externo"],
  alimentos07: ["Se encarecen los alimentos en el mundo", "Trigo, maíz y lácteos suben con fuerza y llegan a la canasta de los hogares.", 0, 0.8, 0, "Shock de costos"],
  subprime: ["Estalla la crisis subprime en EE.UU.", "Aparecen las primeras tensiones en los mercados financieros globales.", -0.2, 0, 0.4, "Shock financiero"],
  petroleo100: ["El petróleo se acerca a los US$100", "Suben los combustibles y el transporte, y con ellos los precios de casi todo.", -0.1, 0.9, 0.2, "Shock de costos"],
  energiaAlza: ["Alimentos y energía siguen al alza", "La inflación se acelera mientras la demanda interna sigue fuerte.", 0.3, 1.0, 0, "Shock de costos"],
  petroleoRecord: ["El petróleo marca un récord", "Se encarecen los combustibles y la actividad empieza a resentirse.", 0.2, 0.8, 0.1, "Shock de costos"],
  lehman: ["Quiebra Lehman Brothers", "Pánico en los mercados financieros: el crédito se congela en todo el mundo.", -1.6, 0, 1.5, "Shock financiero"],
  creditoCongelado: ["Se congela el crédito global", "Las empresas no consiguen financiamiento y recortan inversión y empleo.", -1.4, -0.3, 1.0, "Shock financiero"],
  comercio: ["Se desploma el comercio mundial", "Caen las exportaciones y las empresas recortan producción.", -1.2, -0.4, 0.3, "Shock externo"],
  commoditiesCaen: ["Cobre y petróleo caen", "Bajan los precios de las materias primas: menos ingresos, pero también menos costos.", -0.5, -1.0, 0.2, "Shock externo"],
  estimuloGlobal: ["Estímulos globales", "Gobiernos y bancos centrales inyectan liquidez y se aprecia el peso.", 0.6, 0, -0.5, "Política fiscal"],
  recuperacion: ["Primeros signos de recuperación", "Mejoran el empleo y la confianza.", 0.7, 0, -0.4, "Shock de demanda"],
  terremoto: ["Terremoto en la zona centro-sur", "Se destruye infraestructura y cae la producción.", -0.9, 0.3, 0.1, "Desastre natural"],
  reconstruccion: ["Comienza la reconstrucción", "La inversión pública y privada se acelera.", 1.0, 0.1, -0.3, "Shock de demanda"],
  cobreRecord: ["El cobre alcanza precios récord", "Entran divisas, se aprecia el peso y la inversión minera se dispara.", 1.0, -0.3, -0.6, "Shock externo"],
  alimentos10: ["Fuerte alza de alimentos", "Los precios de los alimentos vuelven a subir con fuerza.", 0.3, 0.7, -0.1, "Shock de costos"],
  // Fin del superciclo (2013–2016)
  demandaVigorosa: ["Demanda interna vigorosa", "El consumo y la inversión crecen a buen ritmo: la economía opera al límite.", 0.7, 0.2, 0, "Shock de demanda"],
  taper: ["La Fed anuncia que reducirá sus compras de bonos", "Suben las tasas largas en el mundo y los capitales abandonan los emergentes.", -0.1, 0.2, 0.9, "Shock financiero"],
  cobreBaja13: ["Cae el cobre y se enfría la inversión minera", "Termina el superciclo: los grandes proyectos se postergan.", -0.8, 0.1, 0.5, "Shock externo"],
  pesoDebil: ["El peso se debilita", "El dólar sube y encarece los productos importados.", -0.2, 0.5, 0.8, "Shock financiero"],
  inversionBaja: ["Menor inversión y consumo moderado", "La economía crece menos y se empieza a notar en el empleo.", -0.7, 0.2, 0.4, "Shock de demanda"],
  chinaFrena: ["Se desacelera China", "La demanda china por cobre y otras materias primas se debilita.", -0.8, 0, 0.3, "Shock externo"],
  dolarAlto: ["Sube el desempleo y se encarece el dólar", "Los hogares gastan menos y los importados se encarecen.", -0.4, 0.6, 0.7, "Shock financiero"],
  petroleoDerrumbe: ["Se derrumba el petróleo", "Bajan los combustibles, un alivio para los costos.", 0.1, -0.7, 0.2, "Shock de costos"],
  cobreMinimos: ["El cobre toca mínimos de años", "Cae el ingreso de la minería y el peso se deprecia otra vez.", -0.7, 0.1, 0.8, "Shock externo"],
  serviciosCaros: ["Alimentos y servicios más caros", "Los precios internos suben aunque la economía está débil.", -0.1, 0.8, 0.3, "Shock de costos"],
  turbulenciaChina: ["Turbulencia en China y en los mercados", "Caen las bolsas y se encarece el dólar.", -0.4, 0.4, 0.7, "Shock financiero"],
  dolarSigueAlto: ["El dólar sigue alto", "Los productos importados siguen presionando los precios.", -0.3, 0.5, 0.3, "Shock financiero"],
  sequiaAlimentos: ["Sequía y alimentos al alza", "Suben frutas y verduras y los costos de producción agrícola.", -0.2, 0.7, -0.2, "Shock de costos"],
  pesoAprecia: ["El peso comienza a apreciarse", "Baja el dólar y se abaratan los importados.", 0.1, -0.4, -0.8, "Shock financiero"],
  cobreEstable: ["El cobre se estabiliza", "Vuelve cierta calma a los mercados de materias primas.", 0.3, -0.3, -0.4, "Shock externo"],
  eleccionEEUU: ["Elección en EE.UU. y alza de tasas en el mundo", "Sube el dólar a nivel global y se tensionan los emergentes.", 0, 0.1, 0.7, "Shock financiero"],
  // Pandemia (2020–2021) y gran inflación (2021–2024)
  confinamiento: ["Confinamientos por la pandemia", "Cierran comercios y oficinas: la actividad cae como nunca.", -2.4, -0.2, 0.3, "Shock sanitario"],
  cierre: ["La economía sigue semicerrada", "El empleo no se recupera y muchas empresas están en pausa.", -1.3, 0, 0, "Shock sanitario"],
  dolarPanico: ["El dólar se dispara", "La incertidumbre deprecia el peso y encarece los importados.", 0, 0.6, 1.2, "Shock financiero"],
  retiro: ["Primer retiro de fondos previsionales", "Millones de personas reciben liquidez y el consumo se dispara.", 1.6, 0.4, 0.3, "Shock de demanda"],
  retiro2: ["Segundo retiro de fondos previsionales", "Otra ola de liquidez para los hogares impulsa el consumo.", 1.4, 0.3, 0.2, "Shock de demanda"],
  reapertura: ["Reapertura de la economía", "La demanda reprimida vuelve con fuerza.", 1.5, 0.4, -0.2, "Shock de demanda"],
  retiro3: ["Tercer retiro y apoyos fiscales", "Más liquidez para los hogares: el consumo se acelera.", 1.4, 0.3, 0.2, "Shock de demanda"],
  reapertura21: ["Reapertura y demanda reprimida", "Los servicios vuelven a funcionar y la demanda se dispara.", 1.3, 0.4, -0.2, "Shock de demanda"],
  cuellos21: ["Reapertura y cuellos de botella globales", "La demanda reprimida vuelve, pero los fletes y los insumos se encarecen en todo el mundo.", 0.7, 0.9, 0.2, "Shock de costos"],
  dolarFuerte21: ["El dólar se dispara", "El peso pierde valor y encarece los productos importados.", 0.2, 0.6, 1.1, "Shock financiero"],
  ucrania22: ["Guerra en Ucrania", "Se disparan la energía y los alimentos a nivel mundial.", -0.2, 1.3, 0.2, "Shock de costos"],
  consumoElevado: ["El consumo sigue elevado", "Los hogares aún gastan los fondos retirados.", 0.6, 0.5, 0.4, "Shock de demanda"],
  dolar1000: ["El dólar supera los $1.000", "El peso toca mínimos y los importados se encarecen.", -0.2, 0.7, 1.3, "Shock financiero"],
  tasaMundial: ["Suben las tasas en todo el mundo", "El crédito se encarece y se frena la inversión.", -0.5, 0.4, 0.4, "Shock financiero"],
  consumoEnfria: ["El consumo se enfría", "Los hogares agotan sus ahorros y gastan menos.", -0.9, 0.1, -0.3, "Shock de demanda"],
  combustiblesBajan: ["Bajan combustibles y alimentos", "Menores costos alivian los precios de la canasta.", -0.4, -0.6, -0.3, "Shock de costos"],
  estancamiento: ["La economía se estanca", "La inversión sigue débil y el empleo se resiente.", -0.8, -0.2, 0.2, "Shock de demanda"],
  pesoAprecia23: ["El peso se aprecia", "Baja el dólar y se abaratan los importados.", -0.2, -0.5, -0.6, "Shock financiero"],
  desinflacion: ["La desinflación avanza", "Los precios internacionales ceden y la inflación se desacelera.", -0.1, -0.4, -0.2, "Shock de costos"],
  inversionLenta: ["La inversión repunta lentamente", "Se recuperan algunos proyectos, aunque con cautela.", 0.3, 0, 0, "Shock de demanda"]
};
const POOL_HOY = ["cobreCae","petroleo","china","liquidez","fed","cosecha","inversion","tranquilo","sequia","externa","confianza","turismo","cuellos","pesoCae","fiscal","cobreSube","petroleoCae","desempleo","enfria","alimentos","euro","tarifas","dolarSube","ucrania"];
const ESC = [
  { id: "diario", n: "Reto del día", T: 8, escala: 2.2, ini: { pi: 4.0, i: 4.75, y: 0, cred: 0.7 }, azar: true, diario: true, tag: "Igual para todos hoy", dif: 2, desc: "Mismos shocks para todos los jugadores del día: compara tu puntaje con tus compañeros. Se renueva cada medianoche." },
  { id: "hoy", tag: "Datos actuales", dif: 2, desc: "Partes con la inflación y la TPM de hoy. Los shocks cambian en cada partida: ningún mandato es igual a otro.",  n: "Chile hoy", T: 8, escala: 2.2, ini: { pi: 4.0, i: 4.75, y: 0, cred: 0.7 }, azar: true },
  { id: "hoy4", tag: "Datos actuales · 4 años", dif: 3, desc: "El mismo punto de partida de hoy, pero con un mandato completo: 16 trimestres para construir (o perder) credibilidad.",  n: "Chile hoy, a largo plazo", T: 16, escala: 2.0, ini: { pi: 4.0, i: 4.75, y: 0, cred: 0.7 }, azar: true },
  { id: "2007", tag: "Inspirado en 2007–2010", dif: 3, desc: "Comienza 2007: la inflación es baja, la tasa está en 5,0% y la economía opera algo sobre su potencial. Tienes cuatro años de mandato por delante.", anio0: 2007, trim0: 1,  n: "Del boom a la crisis global", T: 16, ini: { pi: 2.6, i: 5.0, y: 0.5, cred: 0.85, q: -1 },
    mazo: ["boomCobre","alimentos07","subprime","petroleo100","energiaAlza","petroleoRecord","lehman","creditoCongelado","comercio","commoditiesCaen","estimuloGlobal","recuperacion","terremoto","reconstruccion","cobreRecord","alimentos10"] },
  { id: "2010", tag: "Inspirado en 2010–2011", dif: 2, desc: "Comienza 2010: la inflación está bajo la meta, la tasa en un mínimo de 0,75% y la economía opera bajo su potencial. Tienes dos años de mandato por delante.", anio0: 2010, trim0: 1,  n: "Terremoto y superciclo del cobre", T: 8, ini: { pi: 1.5, i: 0.75, y: -1.5, cred: 0.8 },
    mazo: ["terremoto","reconstruccion","cobreRecord","inversion","alimentos","euro","externa","tranquilo"] },
  { id: "2013", tag: "Inspirado en 2013–2016", dif: 2, desc: "Comienza 2013: la economía crece con fuerza, la inflación es baja y la tasa está en 5,0%. Tienes cuatro años de mandato por delante.", anio0: 2013, trim0: 1,  n: "El fin del superciclo", T: 16, ini: { pi: 1.8, i: 5.0, y: 1.0, cred: 0.85 },
    mazo: ["demandaVigorosa","taper","cobreBaja13","pesoDebil","inversionBaja","chinaFrena","dolarAlto","petroleoDerrumbe","cobreMinimos","serviciosCaros","turbulenciaChina","dolarSigueAlto","sequiaAlimentos","pesoAprecia","cobreEstable","eleccionEEUU"] },
  { id: "2020", tag: "Inspirado en 2020–2021", dif: 3, desc: "Comienza 2020: la inflación está en la meta, la tasa en 1,75% y la economía opera bajo su potencial. Tienes dos años de mandato por delante.", anio0: 2020, trim0: 1,  n: "Pandemia", T: 8, ini: { pi: 3.0, i: 1.75, y: -1.0, cred: 0.8, q: 1.5 },
    mazo: ["confinamiento","dolarPanico","cierre","retiro","retiro2","retiro3","reapertura21","cuellos21"] },
  { id: "2021", tag: "Inspirado en 2021–2024", dif: 4, desc: "Comienza 2021: la tasa está en su mínimo de 0,5%, la inflación en 3,0% y la economía opera bajo su potencial. Tienes cuatro años de mandato por delante.", anio0: 2021, trim0: 1,  n: "La gran inflación", T: 16, ini: { pi: 3.0, i: 0.5, y: -1.5, cred: 0.8, q: 0.5 },
    mazo: ["retiro2","retiro3","cuellos21","dolarFuerte21","ucrania22","consumoElevado","dolar1000","tasaMundial","consumoEnfria","combustiblesBajan","estancamiento","pesoAprecia23","desinflacion","tarifas","dolarSube","inversionLenta"] }
];

  /* ======================= 4. UTILIDADES ======================= */
  function mulberry32(a) {
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function hashTxt(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function claveDia() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function barajar(arr, rng) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
  function fmt(n, dec) { dec = dec == null ? 1 : dec; return Number(n).toLocaleString("es-CL", { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
  function signo(n, dec) { var r = Math.round(Math.abs(n) * Math.pow(10, dec == null ? 1 : dec)); return (r === 0 ? "" : n > 0 ? "+" : "−") + fmt(Math.abs(n), dec); }
  function pistas(ev) {
    var p = [];
    if (ev.d > 0.15) p.push("Demanda ↑"); if (ev.d < -0.15) p.push("Demanda ↓");
    if (ev.s > 0.15) p.push("Precios ↑"); if (ev.s < -0.15) p.push("Precios ↓");
    if (ev.fx > 0.3) p.push("Peso se debilita"); if (ev.fx < -0.3) p.push("Peso se fortalece");
    return p.length ? p : ["Sin presiones"];
  }
  function textoActividad(y) {
    if (y > 1.5) return "La economía se sobrecalienta";
    if (y > 0.5) return "Actividad sobre su potencial";
    if (y < -1.5) return "La economía está en recesión";
    if (y < -0.5) return "Actividad bajo su potencial";
    return "Actividad en torno a su potencial";
  }
  function titulo(p) {
    if (p >= 90) return "Gobernador/a de excepción";
    if (p >= 75) return "Consejero/a sólido/a";
    if (p >= 60) return "Aprobado con observaciones";
    if (p >= 40) return "Con margen de mejora";
    return "El mercado pide su renuncia";
  }
  var ORD = ["1er", "2.º", "3er", "4.º"];
  function fechaTrim(esc, t) {
    if (!esc.anio0) return "";
    var idx = (esc.trim0 - 1) + t, anio = esc.anio0 + Math.floor(idx / 4);
    return ORD[idx % 4] + " trimestre de " + anio;
  }
  function dificultad(n) {
    var s = ""; for (var k = 1; k <= 4; k++) s += '<i class="' + (k <= n ? "on" : "") + '"></i>';
    return '<span class="sim-dif" aria-label="Dificultad ' + n + ' de 4">' + s + "</span>";
  }

  if (!EN_NAVEGADOR) {
    module.exports = { S: S, POOL_HOY: POOL_HOY, ESC: ESC, paso: paso, crearEstado: crearEstado, valida: valida, buscar: buscar,
      simular: simular, puntajeDe: puntajeDe, ACCIONES: ACCIONES, NEUTRO: NEUTRO, CERO: CERO, mulberry32: mulberry32, barajar: barajar, pistas: pistas };
    return;
  }

  /* ======================= 5. PARTIDA ======================= */
  var $ = function (id) { return document.getElementById(id); };
  var CLAVE_RECORDS = "sue-simulador-records-v2";
  var ESCENARIO = ESC[1], P = null;

  function records() { try { return JSON.parse(localStorage.getItem(CLAVE_RECORDS)) || {}; } catch (e) { return {}; } }
  function claveRecord(e) { return e.diario ? "diario-" + claveDia() : e.id; }
  function guardarRecord(e, p) {
    var r = records(), k = claveRecord(e), nuevo = r[k] == null || p > r[k];
    if (nuevo) { r[k] = p; try { localStorage.setItem(CLAVE_RECORDS, JSON.stringify(r)); } catch (x) {} }
    return nuevo;
  }

  function armarPartida(e) {
    var rng = e.diario ? mulberry32(hashTxt("sue-" + claveDia())) : Math.random.bind(Math);
    var claves = e.azar ? barajar(POOL_HOY.slice(), rng).slice(0, e.T) : e.mazo.slice();
    var k = e.escala || 1, jit = function () { return 0.8 + 0.4 * rng(); };
    var eventos = claves.map(function (c) {
      var s = S[c]; return { t: s[0], x: s[1], tipo: s[5], d: s[2] * k * jit(), s: s[3] * k * jit(), fx: s[4] * jit() };
    });
    var ruido = claves.map(function () { return [(rng() * 2 - 1) * 0.12, (rng() * 2 - 1) * 0.08, (rng() * 2 - 1) * 0.3]; });
    var radar = eventos.map(function (_, t) { return t + 1 >= eventos.length ? null : (rng() < 0.75 ? pistas(eventos[t + 1]) : ["Señales mixtas"]); });
    var ini = crearEstado(e.ini);
    return { esc: e, T: e.T, eventos: eventos, ruido: ruido, radar: radar, ini: ini, e: ini, piloto: ini,
      hist: [ini], histPiloto: [ini], decisiones: [], t: 0, perdida: 0, enRango: 0 };
  }
  function prepararReferencia() {
    var mejor = buscar(P.ini, 0, P.eventos, P.ruido, "min", 900), peor = buscar(P.ini, 0, P.eventos, P.ruido, "max", 900);
    var sm = simular(P.ini, mejor.acts, P.eventos, P.ruido), sp = simular(P.ini, peor.acts, P.eventos, P.ruido);
    P.refActs = mejor.acts; P.peorActs = peor.acts; P.refTray = [P.ini].concat(sm.tray); P.Lb = sm.loss; P.Lw = sp.loss; 
  }
  var puntaje = function (L) { return puntajeDe(L, P.Lb, P.Lw, P.T); };

  /* ---------- Gráfico (colores escritos en el SVG) ---------- */
  function grafico(cont, o) {
    var T = P.T, esc = P.esc;
    var W = Math.max(300, Math.min(680, cont.clientWidth ? cont.clientWidth - 22 : 560));
    var H = W < 420 ? 224 : 250, m = { l: 36, r: 60, t: 14, b: 28 };
    var vals = [];
    o.hist.forEach(function (h) { vals.push(h.pi, h.i); });
    (o.piloto || []).forEach(function (h) { vals.push(h.pi); });
    (o.optimo || []).forEach(function (h) { vals.push(h.pi); });
    var minY = Math.min(0, Math.floor(Math.min.apply(null, vals))), maxY = Math.max(8, Math.ceil(Math.max.apply(null, vals)));
    if ((maxY - minY) % 2) maxY++;
    var X = function (k) { return m.l + (W - m.l - m.r) * k / T; };
    var Y = function (v) { return m.t + (H - m.t - m.b) * (1 - (v - minY) / (maxY - minY)); };
    var linea = function (serie, clave) { return serie.map(function (h, k) { return (k ? "L" : "M") + X(k).toFixed(1) + " " + Y(h[clave]).toFixed(1); }).join(" "); };
    var paso2 = (maxY - minY) > 12 ? 4 : 2, g = "", fuente = 'font-family="Montserrat, sans-serif"';
    for (var v = Math.ceil(minY / paso2) * paso2; v <= maxY; v += paso2)
      g += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#e3e0d2" stroke-width="1"/>' +
           '<text x="' + (m.l - 7) + '" y="' + (Y(v) + 4) + '" text-anchor="end" font-size="11" fill="#b7545e" ' + fuente + '>' + v + '%</text>';
    for (var k = 0; k <= T; k++) {
      var et = "";
      if (k === 0) et = esc.anio0 && W < 420 ? "" : (W < 420 ? "0" : "Inicio");
      else if (esc.anio0) { var idx = esc.trim0 - 1 + (k - 1); if (idx % 4 === 0) et = String(esc.anio0 + Math.floor(idx / 4)); }
      else if (T <= 8 || k % 2 === 0) et = "T" + k;
      if (et) g += '<text x="' + X(k) + '" y="' + (H - 7) + '" text-anchor="middle" font-size="11" fill="#b7545e" ' + fuente + '>' + et + "</text>";
    }
    var banda = '<rect x="' + m.l + '" y="' + Y(4) + '" width="' + (W - m.l - m.r) + '" height="' + (Y(2) - Y(4)) + '" fill="#b98a1f" fill-opacity="0.13"/>';
    var meta = '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(3) + '" y2="' + Y(3) + '" stroke="#b98a1f" stroke-width="1.5" stroke-dasharray="5 5"/>' +
      '<text x="' + (W - m.r + 6) + '" y="' + (Y(3) + 4) + '" font-size="11" font-weight="600" fill="#9a7318" ' + fuente + '>Meta 3%</text>';
    var piloto = o.piloto ? '<path d="' + linea(o.piloto, "pi") + '" fill="none" stroke="#8a8f9c" stroke-width="2" stroke-dasharray="6 5"/>' : "";
    var optimo = o.optimo ? '<path d="' + linea(o.optimo, "pi") + '" fill="none" stroke="#1f7a3d" stroke-width="2.5" stroke-dasharray="7 5" stroke-linejoin="round"/>' : "";
    var tpm = '<path d="' + linea(o.hist, "i") + '" fill="none" stroke="#172340" stroke-width="2.25" stroke-linejoin="round"/>';
    var inf = '<path d="' + linea(o.hist, "pi") + '" fill="none" stroke="#CD1729" stroke-width="3" stroke-linejoin="round"/>' +
      (T <= 8 ? o.hist.map(function (h, kk) { return '<circle cx="' + X(kk) + '" cy="' + Y(h.pi) + '" r="3.8" fill="#CD1729"/>'; }).join("") : "");
    return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Evolución de la inflación y la TPM">' + banda + g + meta + piloto + optimo + tpm + inf + "</svg>";
  }

  /* ---------- Pantallas ---------- */
  function flecha(n, v) { var d = n - v; return Math.abs(d) < 0.05 ? "" : (d > 0 ? " ↑" : " ↓"); }

  function tablero(antes) {
    var e = P.e;
    $("sim-tpm").textContent = fmt(e.i, 2) + "%" + (antes ? flecha(e.i, antes.i) : "");
    $("sim-inf").textContent = fmt(e.pi) + "%" + (antes ? flecha(e.pi, antes.pi) : "");
    $("sim-inf").parentNode.classList.toggle("is-alerta", Math.abs(e.pi - META) > 1);
    $("sim-act").textContent = signo(e.y) + "%";
    $("sim-act-txt").textContent = textoActividad(e.y);
    $("sim-cred").style.width = Math.round(e.c * 100) + "%";
    $("sim-cred-txt").textContent = Math.round(e.c * 100) + "%";
    $("sim-peso").textContent = signo(e.q) + "%";
    $("sim-peso-txt").textContent = e.q > 1 ? "Peso depreciado" : e.q < -1 ? "Peso apreciado" : "Peso en equilibrio";
    $("sim-grafico").innerHTML = grafico($("sim-grafico"), { hist: P.hist, piloto: P.histPiloto });
    $("sim-progreso").innerHTML = P.eventos.map(function (_, k) { return '<i class="' + (k < P.t ? "hecho" : k === P.t ? "actual" : "") + '"></i>'; }).join("");
  }

  function mostrarEvento() {
    var ev = P.eventos[P.t];
    $("sim-trimestre").textContent = "Trimestre " + (P.t + 1) + " de " + P.T;
    $("sim-fecha").textContent = fechaTrim(P.esc, P.t);
    $("sim-ev-tipo").textContent = ev.tipo;
    $("sim-ev-titulo").textContent = ev.t;
    $("sim-ev-texto").textContent = ev.x;
    $("sim-ev-pistas").innerHTML = pistas(ev).map(function (p) { return "<span>" + p + "</span>"; }).join(" ");
    var rd = P.radar[P.t];
    $("sim-radar").innerHTML = rd ? "<b>Radar del próximo trimestre:</b> " + rd.map(function (p) { return "<span>" + p + "</span>"; }).join(" ") + " <em>(señal probable, no segura)</em>"
                                  : "<b>Último trimestre de tu mandato</b>";
    $("sim-botones").querySelectorAll("button").forEach(function (b) { b.disabled = !valida(P.e, Number(b.dataset.pb)); });
  }

  function decidir(pb) {
    var t = P.t, ev = P.eventos[t], r = P.ruido[t], antes = P.e, arr = t === 0 ? NEUTRO : P.eventos[t - 1];
    var nuevo = paso(antes, pb, ev, arr, r), sin = paso(antes, 0, ev, arr, r), pil = paso(P.piloto, 0, ev, arr, r);
        P.e = nuevo; P.piloto = pil; P.t++; P.perdida += nuevo.perdida;
    if (Math.abs(nuevo.pi - META) <= 1) P.enRango++;
    P.hist.push(nuevo); P.histPiloto.push(pil); P.decisiones.push(pb);

    tablero(antes);
    var accion = pb === 0 ? "Mantuviste la TPM en " + fmt(nuevo.i, 2) + "%" : (pb > 0 ? "Subiste" : "Bajaste") + " la TPM " + Math.abs(pb) + " pb, a " + fmt(nuevo.i, 2) + "%";
    var efecto = "";
    if (pb !== 0) {
      var dPi = nuevo.pi - sin.pi, dY = nuevo.y - sin.y;
      efecto = " Tu decisión " + (dPi < 0 ? "restó " : "sumó ") + fmt(Math.abs(dPi)) + " pp a la inflación y " + (dY < 0 ? "restó " : "sumó ") +
               fmt(Math.abs(dY)) + " pp a la actividad: sin ella, inflación " + fmt(sin.pi) + "%.";
    }
    var cred = nuevo.c < antes.c ? " Las expectativas se desanclan: la credibilidad cae." : (nuevo.c > antes.c && antes.c < PAR.credMax ? " La credibilidad se fortalece." : "");
    $("sim-informe").innerHTML = "<strong>Informe del trimestre " + P.t + "</strong>" + accion + ". La inflación quedó en " + fmt(nuevo.pi) +
      "% y " + textoActividad(nuevo.y).toLowerCase() + "." + efecto + cred;

    if (P.t >= P.T) return finalizar();
    mostrarEvento();
  }

  /* ---------- Reseña de cómo jugaste ----------
     Se calcula con los mismos números que el puntaje. La pérdida suma, trimestre a trimestre, tres cosas: qué tan lejos
     estuvo la inflación de la meta, qué tan lejos estuvo la actividad de su potencial y cuánto se movió la TPM de golpe.
     La credibilidad no resta puntos por sí sola, pero decide qué tan fácil es controlar la inflación. Cada frase de la
     reseña solo aparece si los datos de la partida la respaldan. */
  function pct(c) { return Math.round(c * 100) + "%"; }

  function actividadFinal(y) {
    if (y > 1.5) return "una economía sobrecalentada";
    if (y > 0.5) return "la actividad sobre su potencial";
    if (y < -1.5) return "una economía en recesión";
    if (y < -0.5) return "la actividad bajo su potencial";
    return "la actividad en torno a su potencial";
  }

  // Promedios, conteos y las tres partes de la pérdida de una trayectoria (trimestres 1..T)
  function metricas(tray, ini) {
    var n = tray.length, m = { n: n, pi: 0, y: 0, i: 0, real: 0, rango: 0, debil: 0, calor: 0, minC: 1, lp: 0, ly: 0, li: 0 };
    tray.forEach(function (e, k) {
      var prev = k ? tray[k - 1] : ini, dI = e.i - prev.i;
      m.pi += e.pi; m.y += e.y; m.i += e.i; m.real += e.rp - RSTAR;           // rp = tasa real que usó el modelo ese trimestre
      if (Math.abs(e.pi - META) <= 1) m.rango++;
      if (e.y < -0.5) m.debil++;                                               // mismos cortes que el texto "bajo / sobre su potencial"
      if (e.y > 0.5) m.calor++;
      m.minC = Math.min(m.minC, e.c);
      m.lp += (e.pi - META) * (e.pi - META); m.ly += PAR.wY * e.y * e.y; m.li += PAR.wI * dI * dI;
    });
    m.pi /= n; m.y /= n; m.i /= n; m.real /= n;
    return m;
  }

  function resenaDelDesempeno(puntaje) {
    var j = metricas(P.hist.slice(1), P.ini), o = metricas(P.refTray.slice(1), P.ini), n = j.n;
    var cFinal = P.e.c, cIni = P.ini.c, enRango = j.rango + " de " + n;
    var finalEnRango = Math.abs(P.e.pi - META) <= 1;
    var tasaAlta = j.real >= 0.7, tasaBaja = j.real <= -0.7;               // TPM alta o baja PARA la inflación que había (tasa real)
    var tpm = "(promedio de " + fmt(j.i) + "%)";
    var infBuena = Math.abs(j.pi - META) <= 1 && j.rango >= 0.75 * n;
    var debil = j.y <= -0.7 || (j.y < 0 && j.debil >= 0.4 * n);
    var caliente = j.y >= 0.7 || (j.y > 0 && j.calor >= 0.4 * n);

    // ¿El mejor recorrido posible también habría tenido ese problema? Solo entonces se aclara que era difícil evitarlo.
    var dificil = ", aunque en este escenario era difícil evitarlo";
    var oInfBuena = Math.abs(o.pi - META) <= 1 && o.rango >= 0.75 * n;
    var oDebil = o.y <= -0.7 || (o.y < 0 && o.debil >= 0.4 * n);
    var oCaliente = o.y >= 0.7 || (o.y > 0 && o.calor >= 0.4 * n);
    var oCredCae = o.minC <= 0.5 || cIni - o.minC >= 0.2;

    // Credibilidad
    var s3;
    if (j.minC <= 0.5 || cIni - j.minC >= 0.2) {
      s3 = "La credibilidad llegó a caer hasta " + pct(j.minC) + (cFinal >= j.minC + 0.1 ? " y terminó en " + pct(cFinal) : "") +
        ": cuando la inflación se aleja de la meta por varios trimestres, las expectativas se desanclan y cuesta más controlarla." +
        (oCredCae && j.minC <= o.minC + 0.1 ? " En este escenario era difícil evitarlo." : "");
    } else if (cFinal >= 0.8) {
      s3 = "Cuidaste la credibilidad (terminó en " + pct(cFinal) + "), lo que mantuvo ancladas las expectativas y ayudó a controlar los precios.";
    } else {
      s3 = "La credibilidad terminó en " + pct(cFinal) + ".";
    }

    // Con buen puntaje, la reseña empieza reconociéndolo: lo que sigue es en qué afinar, no un reproche
    var apertura = "";
    if (puntaje >= 85) apertura = "Gran mandato: estuviste muy cerca de lo mejor posible en este escenario. ";
    else if (puntaje >= 75) apertura = "Buen mandato en un escenario exigente. ";
    else if (puntaje >= 60) apertura = "Mandato correcto, con margen para afinar. ";
    var matiz = puntaje >= 75 ? "Para acercarte al máximo, " : "";   // enmarca lo que falta como ajuste, no como falla

    // Gestión casi perfecta: no hay mucho que corregir
    if (puntaje >= 90) {
      var buena = (puntaje >= 98 ? "Gestión perfecta" : "Gestión casi perfecta") + ": la inflación, la actividad y la credibilidad quedaron " +
        (puntaje >= 98 ? "en lo mejor posible" : "muy cerca de lo mejor posible") + " en este escenario.";
      var f2 = infBuena ? "Mantuviste la inflación dentro del rango en " + enRango + " trimestres."
             : (o.rango < 0.75 * n ? "Era un escenario muy exigente para la inflación y lo manejaste casi tan bien como era posible." : "");
      return [buena, f2, cFinal >= 0.8 ? s3 : ""].filter(Boolean).join(" ");
    }

    // Inflación
    var s1, tpmDicho = false;
    if (infBuena) {
      s1 = "Mantuviste la inflación dentro del rango " + (j.rango === n ? "durante todo el mandato" : "casi todo el mandato") + " (" + enRango + " trimestres)";
    } else if (Math.abs(j.pi - META) <= 1) {
      s1 = "La inflación promedió " + fmt(j.pi) + "%, dentro del rango, pero salió de él en " + (n - j.rango) + " de " + n + " trimestres";
    } else {
      var alta = j.pi > META, intensidad = Math.abs(j.pi - META) > 2 ? "muy " : "";
      s1 = (puntaje >= 75
              ? "El punto a pulir fue la inflación: en promedio estuvo "
              : (finalEnRango ? "Aunque terminaste con una inflación dentro del rango, en promedio la mantuviste " : "En promedio, la inflación estuvo ")) +
        intensidad + (alta ? "alta" : "baja") + " (" + fmt(j.pi) + "%)";
      if (alta && tasaBaja) { s1 += ", con una TPM baja para frenarla " + tpm; tpmDicho = true; }
      if (!alta && tasaAlta) { s1 += ", con una TPM alta que la mantuvo contenida " + tpm; tpmDicho = true; }
    }
    if (!infBuena && !oInfBuena && Math.abs(j.pi - o.pi) <= 0.5) s1 += dificil;

    // Actividad (y su relación con la TPM, cuando los datos la respaldan)
    var act;
    if (debil) {
      var cd = j.debil + " de " + n + " trimestres" + (oDebil && Math.abs(j.y - o.y) <= 0.5 ? dificil : "");
      act = tasaAlta
        ? (tpmDicho
            ? { mala: true, unida: "pero esa tasa alta además contrajo la actividad: estuvo bajo su potencial en " + cd, sola: "Esa tasa alta además contrajo la actividad: estuvo bajo su potencial en " + cd + "." }
            : { mala: true, unida: "pero con una TPM alta para el nivel de inflación que enfrentabas " + tpm + " que contrajo la actividad: estuvo bajo su potencial en " + cd,
                sola: "Con una TPM alta para el nivel de inflación que enfrentabas " + tpm + ", la actividad se contrajo: estuvo bajo su potencial en " + cd + "." })
        : { mala: true, unida: "pero la actividad estuvo bajo su potencial en " + cd, sola: "La actividad estuvo bajo su potencial en " + cd + "." };
    } else if (caliente) {
      var cc = j.calor + " de " + n + " trimestres" + (oCaliente && Math.abs(j.y - o.y) <= 0.5 ? dificil : "");
      act = tasaBaja
        ? (tpmDicho
            ? { mala: true, unida: "pero esa tasa baja además dejó la economía sobrecalentada: estuvo sobre su potencial en " + cc, sola: "Esa tasa baja además dejó la economía sobrecalentada: estuvo sobre su potencial en " + cc + "." }
            : { mala: true, unida: "pero con una TPM baja para el nivel de inflación que enfrentabas " + tpm + " que dejó la economía sobrecalentada: estuvo sobre su potencial en " + cc,
                sola: "Con una TPM baja para el nivel de inflación que enfrentabas " + tpm + ", la economía se recalentó: estuvo sobre su potencial en " + cc + "." })
        : { mala: true, unida: "pero la actividad estuvo sobre su potencial en " + cc, sola: "La actividad estuvo sobre su potencial en " + cc + "." };
    } else {
      act = { mala: false, unida: "y la actividad se mantuvo cerca de su potencial", sola: "La actividad se mantuvo cerca de su potencial." };
    }

    var partes = infBuena
      ? [s1 + ", " + act.unida + "."]
      : [s1 + ".", act.sola];
    partes.push(s3);

    // Lo que más puntos restó, solo si el dato es claro y coincide con lo que se dijo arriba
    var ex = { inf: Math.max(0, j.lp - o.lp), act: Math.max(0, j.ly - o.ly), tasa: Math.max(0, j.li - o.li) };
    var tot = ex.inf + ex.act + ex.tasa, clave = "inf";
    if (ex.act > ex[clave]) clave = "act";
    if (ex.tasa > ex[clave]) clave = "tasa";
    if (tot > 0 && ex[clave] / tot >= 0.5) {
      var dondeMejorar = matiz ? matiz + "lo que más te resta es " : "Lo que más puntos te costó fue ";
      if (clave === "act" && (debil || caliente)) partes.push(dondeMejorar + "la actividad.");
      else if (clave === "inf" && (!infBuena || j.lp / n > 0.35)) partes.push(dondeMejorar + "la inflación: cuanto más cerca de la meta de 3%, mejor.");
      else if (clave === "tasa") partes.push(matiz ? matiz + "lo que más te resta son los cambios bruscos de tasa." : "Lo que más puntos te costó fueron los cambios bruscos de tasa.");
    }
    return apertura + partes.join(" ");
  }

  function finalizar() {
    var p = Math.round(puntaje(P.perdida)), nuevoRecord = guardarRecord(P.esc, p), rec = records()[claveRecord(P.esc)];
    $("sim-juego").hidden = true; $("sim-final").hidden = false;
    $("sim-final-esc").textContent = P.esc.n + (P.esc.diario ? " · " + claveDia().split("-").reverse().join("/") : "");
    $("sim-puntaje").textContent = p;
    $("sim-titulo-final").textContent = titulo(p);
    $("sim-record").textContent = nuevoRecord ? "¡Nuevo récord personal en este escenario!" : "Tu récord en este escenario: " + rec + "/100";
    $("sim-resumen").innerHTML = "Terminaste con una inflación de <strong>" + fmt(P.e.pi) + "%</strong>, una TPM de <strong>" + fmt(P.e.i, 2) +
      "%</strong>, " + actividadFinal(P.e.y) + " y una credibilidad de <strong>" + pct(P.e.c) + "</strong>.";
    $("sim-resena").textContent = resenaDelDesempeno(p);
    rankingAlFinalizar(p);
    $("sim-grafico-final").innerHTML = grafico($("sim-grafico-final"), { hist: P.hist, optimo: P.refTray });
    $("sim-final").dataset.puntaje = p;
    renderEscenarios();
    $("sim-final").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function compartir() {
    var p = $("sim-final").dataset.puntaje, e = P.esc;
    var texto = "Fui el Banco Central en «" + e.n + "» (" + P.T / 4 + (P.T === 4 ? " año" : " años") + ") del simulador de la SUE y obtuve " + p + "/100 (" + titulo(p) + "). ¿Lo haces mejor?";
    var url = location.href.split("#")[0];
    if (navigator.share) navigator.share({ title: "Sé el Banco Central — SUE", text: texto, url: url }).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(texto + " " + url).then(function () {
      $("sim-compartir").textContent = "¡Copiado!"; setTimeout(function () { $("sim-compartir").textContent = "Compartir resultado"; }, 2000);
    });
  }

  /* ---------- Ranking online (opcional) ----------
     Se activa solo si ranking-config.js trae la dirección del ranking. Sin ella, el juego funciona igual que antes.
     Se pide cargando la dirección como un <script> (JSONP): así funciona también en los navegadores integrados de
     Instagram, Facebook o WhatsApp, donde las peticiones fetch a Google suelen fallar. */
  var RANKING_URL = String(window.SUE_RANKING_URL || "").trim();
  var NOMBRE_KEY = "sue-simulador-nombre";
  var RK_ESPERA = Number(window.SUE_RANKING_ESPERA) || 8000;           // cuánto espera cada intento antes de darlo por perdido
  var rkCache = {};                                                      // última tabla recibida de cada escenario (en memoria)
  var RK_INICIO = { titulo: "sim-ranking-titulo", sub: "sim-ranking-sub", tabla: "sim-rk", cuerpo: "sim-rk-cuerpo", estado: "sim-rk-estado", clave: "", datos: null, enCurso: "", fallo: null };
  var RK_FINAL = { titulo: "sim-rkf-titulo", sub: "sim-rkf-sub", tabla: "sim-rkf", cuerpo: "sim-rkf-cuerpo", estado: "sim-rkf-estado", clave: "", datos: null, enCurso: "", fallo: null };

  function normNombre(t) { return String(t || "").replace(/\s+/g, " ").trim().toLowerCase(); }
  function nombreJugador() { var el = $("sim-nombre"); return el ? el.value.replace(/\s+/g, " ").trim() : ""; }
  function claveRanking(e) { return e.diario ? "diario-" + claveDia() : e.id; }   // el Reto del día tiene un ranking nuevo cada día

  // Pide algo al ranking cargando un <script>. Llama a fin(error, datos).
  function rkLlamar(params, espera, fin) {
    var nombre = "__rk" + Date.now().toString(36) + Math.floor(Math.random() * 1e6), s = document.createElement("script"), listo = false, t;
    function terminar(err, d) {
      if (listo) return;
      listo = true; clearTimeout(t);
      window[nombre] = function () {};                                    // si llega tarde, no hace nada ni deja errores
      if (s.parentNode) s.parentNode.removeChild(s);
      fin(err, d);
    }
    window[nombre] = function (d) { terminar(d && d.ok === false && !d.mensaje ? true : null, d); };
    s.onerror = function () { terminar(true); };
    t = setTimeout(function () { terminar(true); }, espera);
    params.callback = nombre;
    var q = Object.keys(params).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]); }).join("&");
    s.async = true;
    s.src = RANKING_URL + (RANKING_URL.indexOf("?") === -1 ? "?" : "&") + q;
    document.head.appendChild(s);
  }

  // Método de respaldo: fetch normal. Sirve si el navegador no deja cargar el <script>, o si el backend de Google
  // todavía está en una versión anterior (que solo habla JSON).
  function rkFetch(params, espera, metodo, fin) {
    var hecho = false, ctl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) { try { ctl.abort(); } catch (e) {} } terminar(true); }, espera);
    function terminar(err, d) { if (hecho) return; hecho = true; clearTimeout(t); fin(err, d); }
    var q = Object.keys(params).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]); }).join("&");
    var opc = ctl ? { signal: ctl.signal } : {}, dir = RANKING_URL;
    if (metodo === "POST") { opc.method = "POST"; opc.body = new URLSearchParams(params); }   // formato simple: evita bloqueos entre dominios
    else dir += (RANKING_URL.indexOf("?") === -1 ? "?" : "&") + q;
    fetch(dir, opc).then(function (r) { return r.json(); }).then(function (d) { terminar(null, d); }).catch(function () { terminar(true); });
  }

  // Primero el método principal (<script>); si no responde, el de respaldo. Llama a fin(error, datos).
  function rkPedir(params, espera, metodoRespaldo, fin) {
    var copia = {}; Object.keys(params).forEach(function (k) { copia[k] = params[k]; });
    rkLlamar(params, espera, function (err, d) {
      if (!err && d) { fin(null, d); return; }
      rkFetch(copia, espera, metodoRespaldo, function (err2, d2) { fin(err2 || !d2 ? true : null, d2); });
    });
  }

  // Última tabla guardada en este dispositivo: se muestra al instante mientras llega la actualizada
  function leerLocal(clave) {
    try { var o = JSON.parse(localStorage.getItem("sue-rk-" + clave) || "null"); return o && o.top ? o : null; } catch (e) { return null; }
  }
  function guardarLocal(clave, d) {
    try { localStorage.setItem("sue-rk-" + clave, JSON.stringify({ total: d.total, top: d.top })); } catch (e) {}
  }
  function recordarRanking(clave, d) {
    if (!d || !d.top || (!d.top.length && d.total > 0)) return;      // una tabla vacía con jugadores en el total es una respuesta incoherente
    rkCache[clave] = { t: Date.now(), datos: { total: d.total, top: d.top } };
    guardarLocal(clave, d);
  }

  function estadoVista(v, txt, reintentar) {
    var el = $(v.estado);
    el.textContent = txt || "";
    if (reintentar) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "sim-rk-reintentar"; b.textContent = "Reintentar";
      b.addEventListener("click", reintentar);
      el.appendChild(document.createTextNode(" ")); el.appendChild(b);
    }
  }

  function pintarRanking(v, d, nota) {
    v.datos = d;
    var cuerpo = $(v.cuerpo), yo = normNombre(nombreJugador());
    cuerpo.textContent = "";
    if (!d.top || !d.top.length) {
      $(v.tabla).hidden = true;
      estadoVista(v, nota || "Aún nadie ha jugado este escenario: ¡puedes ser el primero!");
      return;
    }
    d.top.forEach(function (f, i) {
      var tr = document.createElement("tr");
      if (yo && normNombre(f.nombre) === yo) tr.className = "is-tu";
      [i + 1, f.nombre, f.puntaje].forEach(function (val, k) {
        var td = document.createElement(k === 0 ? "th" : "td");
        if (k === 0) td.setAttribute("scope", "row");
        td.textContent = val;                                  // textContent: un nombre nunca se interpreta como HTML
        tr.appendChild(td);
      });
      cuerpo.appendChild(tr);
    });
    $(v.tabla).hidden = false;
    estadoVista(v, nota || (d.total > d.top.length ? "Mostrando los " + d.top.length + " mejores de " + d.total + " jugadores." : ""));
  }

  // Muestra el ranking de un escenario en una vista (inicio o final): primero lo que ya se tiene, luego lo actualizado
  function cargarRanking(v, esc, forzar) {
    if (!RANKING_URL) return;
    var clave = claveRanking(esc);
    v.clave = clave;
    $(v.titulo).textContent = "Ranking · " + esc.n;
    $(v.sub).textContent = esc.diario
      ? "Se reinicia cada día: aquí compiten solo los puntajes de hoy. De cada jugador cuenta su mejor intento."
      : "Los mejores puntajes de este escenario. De cada jugador cuenta su mejor intento.";

    var mem = rkCache[clave];
    if (mem && !forzar && Date.now() - mem.t < 30000) { pintarRanking(v, mem.datos); return; }
    if (v.enCurso === clave && !forzar) return;                // ya se está pidiendo: no se repite (la pantalla se redibuja varias veces)
    if (!forzar && v.fallo && v.fallo.clave === clave && Date.now() - v.fallo.t < 15000) { mostrarFalloRanking(v, esc); return; }
    v.enCurso = clave;

    var viejo = (mem && mem.datos) || leerLocal(clave);
    if (viejo) pintarRanking(v, viejo, "Actualizando…");
    else { $(v.tabla).hidden = true; estadoVista(v, "Cargando ranking…"); }

    function intentar() {
      rkPedir({ esc: clave, t: Date.now() }, RK_ESPERA, "GET", function (err, d) {
        if (v.clave !== clave) return;                         // el jugador ya cambió de escenario
        v.enCurso = "";
        if (!err && d && d.ok && d.top && (d.top.length || !d.total)) { v.fallo = null; recordarRanking(clave, d); pintarRanking(v, d); return; }
        v.fallo = { clave: clave, t: Date.now() };
        mostrarFalloRanking(v, esc);
      });
    }
    intentar();
  }

  function mostrarFalloRanking(v, esc) {
    var clave = claveRanking(esc), viejo = (rkCache[clave] && rkCache[clave].datos) || leerLocal(clave);
    var txt = viejo ? "No pudimos actualizar el ranking: se muestra la última versión guardada en este dispositivo." : "No pudimos cargar el ranking.";
    if (viejo) pintarRanking(v, viejo, txt); else $(v.tabla).hidden = true;
    estadoVista(v, txt, function () { cargarRanking(v, esc, true); });
  }

  function repintarRankings() {
    [RK_INICIO, RK_FINAL].forEach(function (v) { if (v.datos && !$(v.tabla).hidden) pintarRanking(v, v.datos, $(v.estado).textContent.indexOf("Mostrando") === 0 ? "" : undefined); });
  }

  function guardarNombre() {
    try { localStorage.setItem(NOMBRE_KEY, nombreJugador()); } catch (e) {}
  }

  // Al terminar la partida: se envía el puntaje, se informa en qué puesto quedó y se muestra el ranking del escenario
  function rankingAlFinalizar(p) {
    var el = $("sim-ranking-envio"), caja = $("sim-ranking-final");
    if (el) el.hidden = true;
    if (caja) caja.hidden = true;
    if (!RANKING_URL || !el || !caja) return;

    var esc = P.esc, clave = claveRanking(esc), nombre = nombreJugador();
    var dur = Math.round((Date.now() - (P.inicio || Date.now())) / 1000);
    caja.hidden = false; el.hidden = false;

    if (nombre.length < 2) {
      el.textContent = "Para aparecer en el ranking, escribe tu nombre en la pantalla de inicio antes de jugar.";
      cargarRanking(RK_FINAL, esc, true);
      return;
    }

    // Mientras se envía el puntaje, ya se ve el último ranking conocido
    var mem = rkCache[clave], viejo = (mem && mem.datos) || leerLocal(clave);
    RK_FINAL.clave = clave;
    $(RK_FINAL.titulo).textContent = "Ranking · " + esc.n;
    $(RK_FINAL.sub).textContent = esc.diario ? "Se reinicia cada día: aquí compiten solo los puntajes de hoy. De cada jugador cuenta su mejor intento."
                                              : "Los mejores puntajes de este escenario. De cada jugador cuenta su mejor intento.";
    if (viejo) pintarRanking(RK_FINAL, viejo, "Actualizando con tu puntaje…");
    else { $(RK_FINAL.tabla).hidden = true; estadoVista(RK_FINAL, "Cargando ranking…"); }

    function enviar() {
      el.textContent = "Enviando tu puntaje al ranking…";
      rkPedir({ accion: "guardar", esc: clave, nombre: nombre, puntaje: String(p), dur: String(dur), website: "", t: Date.now() }, RK_ESPERA * 1.5, "POST", function (err, d) {
        if (!err && d && d.ok && d.puesto) {
          el.textContent = "Tu puntaje quedó registrado como «" + nombre + "». Tu mejor puntaje en este escenario te deja en el puesto " + d.puesto + " de " + d.total + ".";
          if (d.top && d.top.length) { recordarRanking(clave, d); if (RK_FINAL.clave === clave) pintarRanking(RK_FINAL, d); }
          else { delete rkCache[clave]; cargarRanking(RK_FINAL, esc, true); }          // sin tabla (backend anterior) o incoherente: se vuelve a pedir
          return;
        }
        if (!err && d && d.ok && !d.mensaje) {                 // el servidor guardó el puntaje pero aún no lo ubica en la tabla
          el.textContent = "Tu puntaje se envió; puede tardar unos segundos en aparecer en el ranking.";
          delete rkCache[clave];
          setTimeout(function () { if (RK_FINAL.clave === clave) cargarRanking(RK_FINAL, esc, true); }, 2500);
          return;
        }
        if (!err && d && d.mensaje) {                          // el servidor respondió y explicó por qué no (p. ej. "espera unos segundos")
          el.textContent = d.mensaje;
          cargarRanking(RK_FINAL, esc, true);
          return;
        }
        el.textContent = "No pudimos registrar tu puntaje en el ranking. ";
        var b = document.createElement("button");
        b.type = "button"; b.className = "sim-rk-reintentar"; b.textContent = "Reintentar";
        b.addEventListener("click", enviar);
        el.appendChild(b);
        cargarRanking(RK_FINAL, esc, true);
      });
    }
    enviar();
  }

  /* ---------- Selección de escenario ---------- */
  function renderEscenarios() {
    var r = records();
    $("sim-escenarios").innerHTML = ESC.map(function (s) {
      var rec = r[claveRecord(s)];
      return '<button type="button" class="sim-esc' + (s === ESCENARIO ? " is-activo" : "") + '" data-id="' + s.id + '" aria-pressed="' + (s === ESCENARIO) + '">' +
        '<span class="sim-esc-tag">' + s.tag + "</span>" +
        '<span class="sim-esc-nombre">' + s.n + "</span>" +
        '<span class="sim-esc-dur">' + (s.T / 4) + (s.T === 4 ? " año" : " años") + " · " + s.T + " trimestres</span>" +
        '<span class="sim-esc-pie">' + dificultad(s.dif) + (rec != null ? '<span class="sim-esc-rec">Récord: ' + rec + "</span>" : "") + "</span></button>";
    }).join("");
    $("sim-esc-desc").textContent = ESCENARIO.desc;
    $("sim-ini-inf").textContent = fmt(ESCENARIO.ini.pi) + "%";
    $("sim-ini-tpm").textContent = fmt(ESCENARIO.ini.i, 2) + "%";
    $("sim-ini-act").textContent = signo(ESCENARIO.ini.y) + "%";
    $("sim-ini-dur").textContent = ESCENARIO.T / 4 + (ESCENARIO.T === 4 ? " año" : " años");
    cargarRanking(RK_INICIO, ESCENARIO);
  }

  function empezar() {
    $("sim-intro").hidden = true; $("sim-final").hidden = true; $("sim-juego").hidden = true; $("sim-cargando").hidden = false;
    var espera = (ESCENARIO.azar && !ESCENARIO.diario) ? datosHoy : Promise.resolve();
    espera.then(function () { setTimeout(function () {   // deja que se pinte el aviso antes del cálculo
      P = armarPartida(ESCENARIO);
      prepararReferencia();
      P.inicio = Date.now();
      guardarNombre();
      $("sim-cargando").hidden = true; $("sim-juego").hidden = false;
      $("sim-juego-esc").textContent = ESCENARIO.n;
      $("sim-informe").innerHTML = "<strong>Primera reunión del Consejo</strong>Lee el shock del trimestre, mira el radar y decide qué hacer con la tasa.";
      tablero(null); mostrarEvento();
      $("sim-juego").scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40); });
  }
  // Salir de la partida (botón "Volver" o clic en el título). Si hay avance, pide confirmación.
  function salir(ev) {
    if (ev) ev.preventDefault();
    if (!$("sim-cargando").hidden) return;
    if (!$("sim-intro").hidden) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    var enCurso = !$("sim-juego").hidden && P && P.t > 0 && P.t < P.T;
    if (enCurso && !window.confirm("¿Salir de la partida? Perderás tu avance.")) return;
    volverAlMenu();
  }
  function volverAlMenu() {
    $("sim-final").hidden = true; $("sim-juego").hidden = true; $("sim-intro").hidden = false;
    renderEscenarios(); $("sim-intro").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- Datos reales de partida (mindicador.cl) ---------- */
  // Los datos reales (mindicador.cl) solo afectan a los escenarios "de hoy". Si tardan o fallan, se sigue con valores de respaldo:
  // el botón de jugar NUNCA depende de esta consulta.
  var datosHoy = Promise.resolve();
  function cargarHoy() {
    var pedir = function (u) { return fetch(u).then(function (r) { if (!r.ok) throw 0; return r.json(); }); };
    var consulta = Promise.all([pedir("https://mindicador.cl/api/ipc"), pedir("https://mindicador.cl/api/tpm")])
      .then(function (r) {
        var serie = (r[0].serie || []).slice(0, 12), tpm = r[1].serie && r[1].serie[0] && r[1].serie[0].valor;
        if (serie.length === 12 && typeof tpm === "number") {
          var anual = (serie.reduce(function (acc, m) { return acc * (1 + m.valor / 100); }, 1) - 1) * 100;
          // El Reto del día no se toca: debe partir igual para todos los jugadores, con o sin conexión
          ESC.filter(function (s) { return s.azar && !s.diario; }).forEach(function (s) { s.ini.pi = clamp(anual, 0, 12); s.ini.i = clamp(tpm, IMIN, IMAX); });
        }
      })
      .catch(function () {});
    var limite = new Promise(function (ok) { setTimeout(ok, 3000); });          // máximo 3 s de espera
    datosHoy = Promise.race([consulta, limite]);
    consulta.then(function () { try { renderEscenarios(); } catch (e) {} });     // refresca las cifras de la pantalla cuando llegan
  }

  // Solo para pruebas: con ?debug en la URL se puede inspeccionar la partida
  if (location.search.indexOf("debug") !== -1) window.__sim = function () { return P; };

  /* ---------- Inicio ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    $("sim-botones").innerHTML = ACCIONES.map(function (pb) {
      return '<button type="button" class="sim-op' + (pb === 0 ? " is-mantener" : pb > 0 ? " is-sube" : " is-baja") + '" data-pb="' + pb + '" aria-label="' +
        (pb === 0 ? "Mantener la tasa" : (pb > 0 ? "Subir " : "Bajar ") + Math.abs(pb) + " puntos base") + '">' + (pb === 0 ? "Mantener" : (pb > 0 ? "+" : "−") + Math.abs(pb)) + "</button>";
    }).join("");
    $("sim-botones").addEventListener("click", function (ev) { var b = ev.target.closest("button"); if (b && !b.disabled) decidir(Number(b.dataset.pb)); });
    $("sim-escenarios").addEventListener("click", function (ev) {
      var b = ev.target.closest("button"); if (!b) return;
      ESCENARIO = ESC.filter(function (s) { return s.id === b.dataset.id; })[0] || ESCENARIO; renderEscenarios();
    });
    if (RANKING_URL) {
      $("sim-nombre-caja").hidden = false; $("sim-ranking").hidden = false;
      try { $("sim-nombre").value = localStorage.getItem(NOMBRE_KEY) || ""; } catch (e) {}
      $("sim-nombre").addEventListener("input", function () { guardarNombre(); repintarRankings(); });   // resalta tu fila al escribir
    }
    $("sim-empezar").disabled = false;
    $("sim-empezar").addEventListener("click", empezar);
    $("sim-otra").addEventListener("click", empezar);
    $("sim-menu").addEventListener("click", volverAlMenu);
    $("sim-volver").addEventListener("click", salir);
    $("sim-titulo-link").addEventListener("click", salir);
    $("sim-compartir").addEventListener("click", compartir);
    renderEscenarios(); cargarHoy();
  });
})();
