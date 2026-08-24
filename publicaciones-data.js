
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
    resumen: "Tres propuestas concretas para mejorar la focalización de las becas de arancel.",
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
@@ -47,7 +119,7 @@ var FALLBACK_PUBLICATIONS = [
              "<h3>" + escapeHtml(pub.titulo) + "</h3>" +
              "<p>" + escapeHtml(pub.resumen) + "</p>" +
            "</div>" +
            '<a class="read" href="' + escapeHtml(pub.link) + '">Leer →</a>' +
            '<a class="read" href="' + escapeHtml(pub.link || "#") + '" target="_blank" rel="noopener">Leer →</a>' +
          "</div>"
        );
      })
@@ -57,64 +129,76 @@ var FALLBACK_PUBLICATIONS = [
  function renderFilters(items) {
    var row = document.getElementById("filter-row");
    if (!row) return;
    var tipos = ["Todos"].concat(Array.from(new Set(items.map(p => p.tipo))));
    var tipos = ["Todos"].concat(
      Array.from(new Set(items.map(function (p) { return p.tipo; })))
    );

    row.innerHTML = tipos
      .map((t, i) => `<button type="button" class="filter-btn${i === 0 ? " active" : ""}" data-tipo="${escapeHtml(t)}">${escapeHtml(t)}</button>`)
      .map(function (t, i) {
        return '<button type="button" class="filter-btn' + (i === 0 ? " active" : "") + '" data-tipo="' + escapeHtml(t) + '">' + escapeHtml(t) + "</button>";
      })
      .join("");

    row.querySelectorAll(".filter-btn").forEach(btn => {
    row.querySelectorAll(".filter-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        row.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        row.querySelectorAll(".filter-btn").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        var tipo = btn.getAttribute("data-tipo");
        var filtered = tipo === "Todos" ? items : items.filter(p => p.tipo === tipo);
        var filtered = tipo === "Todos" ? items : items.filter(function (p) { return p.tipo === tipo; });
        renderList(filtered);
      });
    });
  }

function parseCsvRows(csvText) {
  var parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;
  
  return parsed
    .map((row, originalIndex) => ({ ...row, _id: originalIndex })) // Guarda el número de fila original
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
  function setup(items) {
    renderFilters(items);
    renderList(items);
  }

  function parseCsvRows(csvText) {
    var parsed = window.Papa
      ? Papa.parse(csvText, { header: true, skipEmptyLines: true })
      : { data: [] };
    return parsed.data
      .filter(function (row) {
        return (row["Estado"] || "").trim().toLowerCase() === "publicado";
      })
      .map(function (row) {
        return {
          tipo: row["Tipo"] || "Artículo",
          titulo: row["Título"] || row["Titulo"] || "Sin título",
          autor: row["Autor"] || row["Autor(es)"] || "",
          fecha: row["Fecha"] || row["Marca temporal"] || "",
          categoria: row["Categoría"] || row["Categoria"] || "",
          resumen: row["Resumen"] || "",
          link: row["Enlace"] || row["Enlace al documento"] || "#"
        };
      })
      .reverse(); // las respuestas más nuevas quedan primero
  }

  function init() {
    var formLinks = document.querySelectorAll("[data-form-link]");
    var formLink = document.querySelectorAll("[data-form-link]");
    if (CONFIG.FORM_URL) {
      formLinks.forEach(a => a.setAttribute("href", CONFIG.FORM_URL));
      formLink.forEach(function (a) { a.setAttribute("href", CONFIG.FORM_URL); });
    }

    if (!CONFIG.CSV_URL) {
      renderFilters(FALLBACK_PUBLICATIONS);
      renderList(FALLBACK_PUBLICATIONS);
      setup(FALLBACK_PUBLICATIONS);
      return;
    }

    fetch(CONFIG.CSV_URL)
      .then(res => res.text())
      .then(csvText => {
    fetch(CONFIG.CSV_URL + (CONFIG.CSV_URL.indexOf("?") > -1 ? "&" : "?") + "cachebust=" + Date.now())
      .then(function (res) {
        if (!res.ok) throw new Error("No se pudo leer la hoja de cálculo");
        return res.text();
      })
      .then(function (csvText) {
        var items = parseCsvRows(csvText);
        var dataset = items.length ? items : FALLBACK_PUBLICATIONS;
        renderFilters(dataset);
        renderList(dataset);
        setup(items.length ? items : FALLBACK_PUBLICATIONS);
      })
      .catch(() => {
        renderFilters(FALLBACK_PUBLICATIONS);
        renderList(FALLBACK_PUBLICATIONS);
      .catch(function () {
        setup(FALLBACK_PUBLICATIONS);
      });
  }
