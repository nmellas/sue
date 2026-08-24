/* ============================================================
   Cinta de indicadores económicos — datos en vivo de mindicador.cl
   (API pública y gratuita que replica los valores del Banco Central)
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

  function buildItems(data) {
    var spans = ORDER.map(function (key) {
      var entry = data[key];
      if (!entry || typeof entry.valor === 'undefined') return '';
      return '<span>' + LABELS[key] + ' <b>' + formatValue(key, entry.valor) + '</b></span>';
    }).filter(Boolean);

    return spans.join('');
  }

  function render(data) {
    var track = document.getElementById('ticker-track');
    if (!track) return;
    var html = buildItems(data);
    // se duplica el contenido para que el desplazamiento sea continuo
    track.innerHTML = html + html;
  }

  function hideTicker() {
    var bar = document.querySelector('.ticker-bar');
    if (bar) bar.style.display = 'none';
  }

  fetch('https://mindicador.cl/api')
    .then(function (res) {
      if (!res.ok) throw new Error('respuesta no válida');
      return res.json();
    })
    .then(function (data) {
      render(data);
    })
    .catch(function () {
      // sin conexión a la API: se oculta la cinta en vez de mostrar datos viejos
      hideTicker();
    });
})();
