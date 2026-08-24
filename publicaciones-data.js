/* ============================================================
   PUBLICACIONES — SUE
   ------------------------------------------------------------
   Cómo funciona (para quien administra el sitio):
   1. Los miembros envían su artículo/paper/policy brief a través
      de un Google Form (ver guía de configuración entregada aparte).
   2. Las respuestas del formulario caen automáticamente en una
      Google Sheet.
   3. La comisión de publicaciones revisa las filas y escribe
      "Publicado" en la columna "Estado" de las que aprueba.
   4. Esa hoja se publica como CSV (Archivo → Compartir → Publicar
      en la Web → formato CSV) y el enlace se pega abajo en
      CONFIG.CSV_URL.
   5. Desde ese momento, esta página se actualiza sola: nadie
      vuelve a tocar código para publicar algo nuevo.

   Mientras CONFIG.CSV_URL esté vacío, la página muestra un set
   de publicaciones de ejemplo para que el sitio no se vea vacío.
   ============================================================ */

var CONFIG = {
  // Pega aquí el enlace CSV publicado de la Google Sheet de respuestas.
  // Ejemplo: "https://docs.google.com/spreadsheets/d/e/XXXXX/pub?output=csv"
  CSV_URL: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTMkfD6_sIOPrrsX4kHJp2Xrwn5TbcA-okC831-t9ZJB2O0wRe4BvjBnC1SdOyzLrPQCWZbA9vek3AV/pub?gid=439785421&single=true&output=csv",

  // Pega aquí el enlace del Google Form para que el botón
  // "Enviar mi publicación" funcione.
  FORM_URL: "https://docs.google.com/forms/d/e/1FAIpQLSeyn8K_IyiogET0SfjAN3QtnSD-OzMrl2S5O4TJTppPW0HG7w/viewform?usp=dialog"
};

// Publicaciones de ejemplo (se usan solo si CONFIG.CSV_URL está vacío)
var FALLBACK_PUBLICATIONS = [
  {
    tipo: "Policy Brief",
    titulo: "Recomendaciones para una reforma al sistema de becas estudiantiles",
    autor: "Comisión de Investigación",
    fecha: "Agosto 2026",
    categoria: "Política pública",
    resumen: "Tres propuestas concretas para mejorar la focalización de las becas de arancel, basadas en datos propios sobre deserción por motivos económicos.",
    link: "#"
  },
  {
    tipo: "Artículo",
    titulo: "Inflación, expectativas y el costo de vida estudiantil",
    autor: "El Índice · Nº 62",
    fecha: "Agosto 2026",
    categoria: "Macroeconomía",
    resumen: "Cómo la variación de precios de los últimos dos años ha modificado el presupuesto mensual de un estudiante promedio.",
    link: "#"
  },
  {
    tipo: "Documento de trabajo",
    titulo: "Informalidad laboral juvenil: una revisión de causas y políticas",
    autor: "Comisión de Investigación",
    fecha: "Junio 2026",
    categoria: "Economía laboral",
    resumen: "Un repaso de la literatura reciente sobre informalidad entre jóvenes, con una propuesta de indicadores para el seguimiento local.",
    link: "#"
  },
  {
    tipo: "Artículo",
    titulo: "¿Qué explica el precio de la vivienda cerca del campus?",
    autor: "El Índice · Nº 60",
    fecha: "Abril 2026",
    categoria: "Desarrollo",
    resumen: "Un análisis de oferta y demanda aplicado al mercado de arriendo estudiantil en los barrios aledaños a la universidad.",
    link: "#"
  },
  {
    tipo: "Documento de trabajo",
    titulo: "Comercio regional y cadenas de valor: el caso de la agroindustria",
    autor: "Comisión de Investigación",
    fecha: "Febrero 2026",
    categoria: "Desarrollo",
    resumen: "Un estudio exploratorio sobre la integración de pequeños productores agrícolas a cadenas de exportación regionales.",
    link: "#"
  },
  {
    tipo: "Artículo",
    titulo: "Política monetaria explicada para no economistas",
    autor: "El Índice · Nº 58",
    fecha: "Diciembre 2025",
    categoria: "Finanzas",
    resumen: "Una guía breve sobre cómo las decisiones del banco central afectan las decisiones cotidianas de consumo y ahorro.",
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
            '<a class="read" href="' + escapeHtml(pub.link || "#") + '">Leer →</a>' +
          "</div>"
        );
      })
      .join("");
  }

  function renderFilters(items) {
    var row = document.getElementById("filter-row");
    if (!row) return;
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
    var formLink = document.querySelectorAll("[data-form-link]");
    if (CONFIG.FORM_URL) {
      formLink.forEach(function (a) { a.setAttribute("href", CONFIG.FORM_URL); });
    }

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
        var items = parseCsvRows(csvText);
        setup(items.length ? items : FALLBACK_PUBLICATIONS);
      })
      .catch(function () {
        setup(FALLBACK_PUBLICATIONS);
      });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
