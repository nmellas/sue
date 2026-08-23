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
    tpm: 'TPM'
  };

  // Orden en que queremos mostrar los indicadores
  var ORDER = ['dolar', 'uf', 'utm', 'euro', 'ipc', 'tpm'];

  // Valores de respaldo, solo por si la API no responde (ej. sin conexión).
  // Se muestran igual para que la cinta nunca quede vacía.
  var FALLBACK = {
    dolar: { valor: 916 },
    uf: { valor: 40804 },
    utm: { valor: 71506 },
    euro: { valor: 990 },
    ipc: { valor: 0.4 },
    tpm: { valor: 5.5 }
  };

  function formatValue(key, valor) {
    if (key === 'dolar' || key === 'euro') {
      return '$' + Math.round(valor).toLocaleString('es-CL');
    }
    if (key === 'uf' || key === 'utm') {
      return '$' + valor.toLocaleString('es-CL', { maximumFractionDigits: 2 });
    }
    if (key === 'ipc' || key === 'tpm') {
      return valor.toLocaleString('es-CL', { maximumFractionDigits: 2 }) + '%';
    }
    return valor;
  }

  function buildItems(data) {
    var spans = ORDER.map(function (key) {
      var entry = data[key];
      if (!entry || typeof entry.valor === 'undefined') return '';
      return '<span>' + LABELS[key] + ' <b>' + formatValue(key, entry.valor) + '</b></span>';
    }).filter(Boolean);

    // Un par de datos institucionales al final, para no perder el tono propio
    spans.push('<span>PRÓXIMO CONVERSATORIO: <b>MARTES 16:00</b></span>');
    spans.push('<span>CONVOCATORIA DE ARTÍCULOS ABIERTA</span>');

    return spans.join('');
  }

  function render(data) {
    var track = document.getElementById('ticker-track');
    if (!track) return;
    var html = buildItems(data);
    // se duplica el contenido para que el desplazamiento sea continuo
    track.innerHTML = html + html;
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
      // sin conexión a la API: se muestran valores de respaldo
      render(FALLBACK);
    });
})();
