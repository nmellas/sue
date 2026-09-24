/* ============================================================
   Cinta de indicadores económicos — datos en vivo de mindicador.cl
   (API pública y gratuita que replica los valores del Banco Central)

   Para que la cinta no se "reinicie" al cambiar de página:
   1) Los datos se guardan en el navegador (localStorage) por 30
      minutos. Mientras estén vigentes, las demás páginas los
      muestran al instante, sin volver a descargarlos.
   2) Se guarda el momento en que empezó a moverse la cinta y cada
      página nueva la retoma en el mismo punto, en vez de partir
      desde el inicio.
   ============================================================ */

(function () {
  var LABELS = {
    dolar: 'DÓLAR OBS.',
    euro: 'EURO',
    uf: 'UF',
    utm: 'UTM',
    ipc: 'IPC (VAR. MENSUAL)',
    tpm: 'TPM',
    imacec: 'IMACEC',
    libra_cobre: 'LIBRA DE COBRE'
  };

  // Orden en que queremos mostrar los indicadores
  var ORDER = ['dolar', 'uf', 'utm', 'euro', 'ipc', 'tpm', 'imacec', 'libra_cobre'];

  var CACHE_KEY = 'sue-indicadores-v1';
  var INICIO_KEY = 'sue-ticker-inicio';
  var VIGENCIA_MS = 30 * 60 * 1000;          // datos "frescos": 30 minutos
  var MAX_ANTIGUEDAD_MS = 24 * 60 * 60 * 1000; // si la API falla, se muestran datos de hasta 24 horas

  /* ---------- Almacenamiento (protegido: Safari privado puede bloquearlo) ---------- */

  function leer(clave) {
    try { return JSON.parse(localStorage.getItem(clave)); } catch (e) { return null; }
  }
  function guardar(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* sin almacenamiento: no pasa nada */ }
  }

  /* ---------- Formato ---------- */

  function formatValue(key, valor) {
    if (key === 'dolar' || key === 'euro') {
      return '$' + Math.round(valor).toLocaleString('es-CL');
    }
    if (key === 'uf' || key === 'utm') {
      return '$' + valor.toLocaleString('es-CL', { maximumFractionDigits: 2 });
    }
    if (key === 'ipc' || key === 'tpm' || key === 'imacec') {
      return valor.toLocaleString('es-CL', { maximumFractionDigits: 2 }) + '%';
    }
    if (key === 'libra_cobre') {
      return 'US$' + valor.toLocaleString('es-CL', { maximumFractionDigits: 2 });
    }
    return valor;
  }

  // Guarda solo los valores que se usan (no toda la respuesta de la API)
  function resumir(data) {
    var valores = {};
    ORDER.forEach(function (key) {
      if (data[key] && typeof data[key].valor === 'number') valores[key] = data[key].valor;
    });
    return valores;
  }

  function buildItems(valores) {
    return ORDER.map(function (key) {
      if (typeof valores[key] !== 'number') return '';
      return '<span>' + LABELS[key] + ' <b>' + formatValue(key, valores[key]) + '</b></span>';
    }).filter(Boolean).join('');
  }

  /* ---------- Animación continua entre páginas ---------- */

  function duracionAnimacion(track) {
    var d = getComputedStyle(track).animationDuration || '';
    var seg = parseFloat(d);
    if (!seg) return 0;
    return d.indexOf('ms') !== -1 ? seg : seg * 1000;
  }

  function sincronizar(track) {
    var dur = duracionAnimacion(track);
    if (!dur) return; // sin animación (p. ej. "reducir movimiento" activado)
    var inicio = leer(INICIO_KEY);
    if (typeof inicio !== 'number') {
      inicio = Date.now();
      guardar(INICIO_KEY, inicio);
    }
    // Un retraso negativo hace que la animación parta "ya avanzada"
    track.style.animationDelay = '-' + ((Date.now() - inicio) % dur) + 'ms';
  }

  /* ---------- Render ---------- */

  function render(valores) {
    var track = document.getElementById('ticker-track');
    if (!track) return;
    var html = buildItems(valores);
    if (!html) return;
    // se duplica el contenido para que el desplazamiento sea continuo
    track.innerHTML = html + html;
    sincronizar(track);
  }

  function hideTicker() {
    var bar = document.querySelector('.ticker-bar');
    if (bar) bar.style.display = 'none';
  }

  /* ---------- Flujo principal ---------- */

  var cache = leer(CACHE_KEY);
  var edad = cache && cache.t ? Date.now() - cache.t : Infinity;

  // 1) Si hay datos guardados, se muestran de inmediato (sin "CARGANDO…")
  if (cache && cache.valores && edad < MAX_ANTIGUEDAD_MS) render(cache.valores);

  // 2) Solo se descargan de nuevo si ya pasaron 30 minutos
  if (edad < VIGENCIA_MS) return;

  fetch('https://mindicador.cl/api')
    .then(function (res) {
      if (!res.ok) throw new Error('respuesta no válida');
      return res.json();
    })
    .then(function (data) {
      var valores = resumir(data);
      guardar(CACHE_KEY, { t: Date.now(), valores: valores });
      render(valores);
    })
    .catch(function () {
      // Sin conexión a la API: se mantienen los datos guardados si son del último día;
      // si no hay datos recientes, se oculta la cinta en vez de mostrar datos viejos.
      if (!(cache && cache.valores && edad < MAX_ANTIGUEDAD_MS)) hideTicker();
    });
})();
