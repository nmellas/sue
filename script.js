document.addEventListener('DOMContentLoaded', function () {
  // Menú móvil
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var isOpen = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
  }

  // Marca activa en la navegación
  var current = document.body.getAttribute('data-page');
  document.querySelectorAll('.nav-links a').forEach(function (a) {
    if (a.getAttribute('data-page') === current) a.classList.add('active');
  });
var CONFIG = {
  CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTMkfD6_sIOPrrsX4kHJp2Xrwn5TbcA-okC831-t9ZJB2O0wRe4BvjBnC1SdOyzLrPQCWZbA9vek3AV/pub?gid=439785421&single=true&output=csv",
  FORM_URL: "https://docs.google.com/forms/d/e/1FAIpQLSeyn8K_IyiogET0SfjAN3QtnSD-OzMrl2S5O4TJTppPW0HG7w/viewform?usp=publish-editor"
};

var FALLBACK_PUBLICATIONS = [
  {
    tipo: "Policy Brief",
    titulo: "Recomendaciones para una reforma al sistema de becas estudiantiles",
    autor: "Comisión de Investigación",
    fecha: "Agosto 2026",
    resumen: "Tres propuestas concretas para mejorar la focalización de las becas de arancel.",
    link: "#"
  }
];

(function () {
  function escapeHtml(str) {
    return (str || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function renderList(items) {
    var list = document.getElementById("pub-list");
    var empty = document.getElementById("pub-empty");
    if (!list) return;

    if (!items.length) {
      list.innerHTML = "";
      if (empty) empty.style.display = "block";
      return;
    }
    if (empty) empty.style.display = "none";

    var total = items.length;
    list.innerHTML = items
      .map(function (pub, i) {
        return (
          '<div class="pub-row" data-tipo="' + escapeHtml(pub.tipo) + '">' +
            '<span class="idx">§' + (total - i) + '</span>' +
            "<div>" +
              '<span class="meta">' + escapeHtml(pub.tipo).toUpperCase() +
                (pub.autor ? " · " + escapeHtml(pub.autor) : "") +
                (pub.fecha ? " · " + escapeHtml(pub.fecha) : "") +
              "</span>" +
              "<h3>" + escapeHtml(pub.titulo) + "</h3>" +
              "<p>" + escapeHtml(pub.resumen) + "</p>" +
            "</div>" +
            '<a class="read" href="' + escapeHtml(pub.link) + '">Leer →</a>' +
          "</div>"
        );
      })
      .join("");
  }

  function renderFilters(items) {
    var row = document.getElementById("filter-row");
    if (!row) return;
    var tipos = ["Todos"].concat(Array.from(new Set(items.map(p => p.tipo))));

    row.innerHTML = tipos
      .map((t, i) => `<button type="button" class="filter-btn${i === 0 ? " active" : ""}" data-tipo="${escapeHtml(t)}">${escapeHtml(t)}</button>`)
      .join("");

    row.querySelectorAll(".filter-btn").forEach(btn => {
      btn.addEventListener("click", function () {
        row.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        var tipo = btn.getAttribute("data-tipo");
        var filtered = tipo === "Todos" ? items : items.filter(p => p.tipo === tipo);
        renderList(filtered);
      });
    });
  }

  function parseCsvRows(csvText) {
    var parsed = window.Papa ? Papa.parse(csvText, { header: true, skipEmptyLines: true }) : { data: [] };
    
    return parsed.data
      .map((row, originalIndex) => ({ ...row, _id: originalIndex })) // Guarda el índice real de la fila
      .filter(row => (row["Estado"] || "").trim().toLowerCase() === "publicado")
      .map(row => ({
        tipo: row["Tipo"] || "Artículo",
        titulo: row["Título"] || row["Titulo"] || "Sin título",
        autor: row["Autor"] || row["Autor(es)"] || "",
        fecha: row["Fecha"] || row["Marca temporal"] || "",
        categoria: row["Categoría"] || "",
        resumen: row["Resumen"] || "",
        link: "articulo.html?id=" + row._id
      }))
      .reverse();
  }

  function init() {
    var formLinks = document.querySelectorAll("[data-form-link]");
    if (CONFIG.FORM_URL) {
      formLinks.forEach(a => a.setAttribute("href", CONFIG.FORM_URL));
    }

    if (!CONFIG.CSV_URL) {
      renderFilters(FALLBACK_PUBLICATIONS);
      renderList(FALLBACK_PUBLICATIONS);
      return;
    }

    fetch(CONFIG.CSV_URL)
      .then(res => res.text())
      .then(csvText => {
        var items = parseCsvRows(csvText);
        var dataset = items.length ? items : FALLBACK_PUBLICATIONS;
        renderFilters(dataset);
        renderList(dataset);
      })
      .catch(() => {
        renderFilters(FALLBACK_PUBLICATIONS);
        renderList(FALLBACK_PUBLICATIONS);
      });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
  
});
