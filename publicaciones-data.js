/* ============================================================
   PUBLICACIONES — SUE
   ------------------------------------------------------------
   Cómo funciona (para quien administra el sitio):
   1. Los miembros envían su artículo/paper/policy brief a través
      de un Google Form.
   2. Las respuestas del formulario caen automáticamente en una
      Google Sheet.
   3. La Coordinación de Investigación y Contenidos revisa las filas
      y escribe "Publicado" en la columna "Estado" de las que aprueba.
   4. Esa hoja se publica como CSV (Archivo → Compartir → Publicar
      en la Web → formato CSV) y el enlace se pega abajo en
      CONFIG.CSV_URL.
   5. Desde ese momento, esta página se actualiza sola.

   Encabezados que lee (exactos, sin importar mayúsculas):
   Estado, Tipo, Título, Autor, Fecha, Categoría, Resumen.
   ============================================================ */

var CONFIG = {
  // Enlace CSV publicado de la Google Sheet de respuestas.
  CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQjt6eQhpe3H-Xg5KY_TA8BMFXaSWR_JSDsI3Q1WxGESnFJ2ua14ekwptDkDLc2lJDVByhnm8A-uqe_/pub?gid=2048697698&single=true&output=csv",

  // Enlace del Google Form (uso interno; el sitio ya no muestra un botón público).
  FORM_URL: "https://docs.google.com/forms/d/e/1FAIpQLSe7qdoZAF3cw2brBkoNei5-PN8UnXJ4EA_RvGfvmnUh0x-bYg/viewform?usp=dialog"
};

// Sin publicaciones de ejemplo: si no hay nada publicado, la página
// muestra el aviso de "todavía no hay publicaciones".
var FALLBACK_PUBLICATIONS = [];

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
            '<a class="read" href="' + escapeHtml(pub.link || "#") + '">Leer →</a>' +
          "</div>"
        );
      })
      .join("");
  }

  function renderFilters(items) {
    var row = document.getElementById("filter-row");
    if (!row) return;
    if (!items.length) { row.innerHTML = ""; return; }

    var tipos = ["Todos"].concat(
      Array.from(new Set(items.map(function (p) { return p.tipo; })))
    );

    row.innerHTML = tipos
      .map(function (t, i) {
        return '<button type="button" class="filter-btn' + (i === 0 ? " active" : "") + '" data-tipo="' + escapeHtml(t) + '">' + escapeHtml(t) + "</button>";
      })
      .join("");

    row.querySelectorAll(".filter-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        row.querySelectorAll(".filter-btn").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        var tipo = btn.getAttribute("data-tipo");
        var filtered = tipo === "Todos" ? items : items.filter(function (p) { return p.tipo === tipo; });
        renderList(filtered);
      });
    });
  }

  function setup(items) {
    renderFilters(items);
    renderList(items);
  }

  // Busca una columna sin importar mayúsculas/minúsculas ni espacios
  // extra en el encabezado (misma lógica que usa articulo.html).
  function getField(row, candidates) {
    var keys = Object.keys(row);
    for (var i = 0; i < candidates.length; i++) {
      var target = candidates[i].trim().toLowerCase();
      for (var j = 0; j < keys.length; j++) {
        if (keys[j].trim().toLowerCase() === target) {
          var val = row[keys[j]];
          if (val && val.trim() !== "") return val.trim();
        }
      }
    }
    return "";
  }

  function parseCsvRows(csvText) {
    var parsed = window.Papa
      ? Papa.parse(csvText, { header: true, skipEmptyLines: true })
      : { data: [] };

    // Guardamos la posición original de cada fila (antes de filtrar)
    // porque articulo.html usa esa misma posición como su "id" en la URL.
    return parsed.data
      .map(function (row, originalIndex) {
        return { row: row, originalIndex: originalIndex };
      })
      .filter(function (entry) {
        return getField(entry.row, ["Estado"]).toLowerCase() === "publicado";
      })
      .map(function (entry) {
        var row = entry.row;
        return {
          tipo: getField(row, ["Tipo"]) || "Artículo",
          titulo: getField(row, ["Título", "Titulo"]) || "Sin título",
          autor: getField(row, ["Autor", "Autor(es)"]),
          fecha: getField(row, ["Fecha", "Marca temporal"]),
          categoria: getField(row, ["Categoría", "Categoria"]),
          resumen: getField(row, ["Resumen"]),
          link: "articulo.html?id=" + entry.originalIndex
        };
      })
      .reverse(); // las respuestas más nuevas quedan primero
  }

  function init() {
    if (!CONFIG.CSV_URL) {
      setup(FALLBACK_PUBLICATIONS);
      return;
    }

    fetch(CONFIG.CSV_URL + (CONFIG.CSV_URL.indexOf("?") > -1 ? "&" : "?") + "cachebust=" + Date.now())
      .then(function (res) {
        if (!res.ok) throw new Error("No se pudo leer la hoja de cálculo");
        return res.text();
      })
      .then(function (csvText) {
        setup(parseCsvRows(csvText));
      })
      .catch(function (err) {
        console.error("Publicaciones:", err);
        setup(FALLBACK_PUBLICATIONS);
      });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
