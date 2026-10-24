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
});


/* Cierra el menú del celular al tocar cualquier parte fuera de él */
(function () {
  var boton = document.querySelector(".nav-toggle");
  var menu = document.querySelector(".nav-links");
  if (!boton || !menu) return;

  function abierto() { return menu.classList.contains("open"); }
  function esDelMenu(el) { return menu.contains(el) || boton.contains(el); }

  var ignorarClick = false;

  // Al tocar fuera: se cierra el menú con el mismo botón de siempre (así se actualiza todo lo suyo)
  document.addEventListener("pointerdown", function (e) {
    if (!abierto() || esDelMenu(e.target)) return;
    boton.click();
    ignorarClick = true;                                   // el toque solo cierra el menú: no activa lo que haya debajo
    setTimeout(function () { ignorarClick = false; }, 500);
  }, true);

  document.addEventListener("click", function (e) {
    if (ignorarClick && !boton.contains(e.target)) {
      e.preventDefault();
      e.stopPropagation();
      ignorarClick = false;
    }
  }, true);

  // También se cierra con la tecla Escape
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && abierto()) boton.click();
  });
})();

/* ==========================================================================
   reveal.js — SUE
   Hace que los bloques de cada página "vayan apareciendo" suavemente al
   bajar con el scroll (igual que en la página del 1.er Encuentro).
   - No hay que tocar el HTML: detecta solo los títulos, tarjetas, filas, etc.
   - También funciona con lo que se carga después (publicaciones y actividades).
   - Si el navegador pide "reducir movimiento" o falla el script, todo se ve normal.
   - No se aplica al simulador, a los artículos ni a la página del encuentro.
   ========================================================================== */
(function () {
  "use strict";

  var pagina = document.body && document.body.getAttribute("data-page");
  if (pagina === "simulador" || pagina === "encuentro") return;
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  // Bloques que aparecen (solo "hojas": nunca uno dentro de otro)
  var SELECTORES = [
    ".page-head .container > *", ".section-head > *", ".hero-grid > *",
    ".stat-strip", ".card", ".team-card", ".grupo-nombre", ".values-list > *",
    ".act-showcase", ".act-card", ".pub-row", ".pub-teaser", ".doc-teaser",
    ".pub-archive-head", ".filter-row", ".org-logos", ".info-block",
    ".contact-form", ".band .container > *", ".lede"
  ].join(",");

  var estilo = document.createElement("style");
  estilo.textContent =
    "html{scroll-padding-top:110px;}" +
    ".sue-rv{opacity:0;transform:translateY(26px);transition:opacity .7s ease,transform .7s ease;transition-delay:var(--rv-d,0ms);will-change:opacity,transform;}" +
    ".sue-rv.sue-rv-in{opacity:1;transform:none;}";
  document.head.appendChild(estilo);

  var visto = typeof WeakSet === "function" ? new WeakSet() : null;

  var io = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (en) {
      if (!en.isIntersecting) return;
      var el = en.target;
      io.unobserve(el);
      el.classList.add("sue-rv-in");
      // Al terminar, se quitan las clases para que los efectos propios
      // de cada elemento (hover, etc.) vuelvan a funcionar como siempre.
      setTimeout(function () {
        el.classList.remove("sue-rv", "sue-rv-in");
        el.style.removeProperty("--rv-d");
        el.style.removeProperty("will-change");
      }, 1000 + (parseInt(el.style.getPropertyValue("--rv-d"), 10) || 0));
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -5% 0px" });

  function preparar(raiz) {
    var lista = (raiz || document).querySelectorAll(SELECTORES);
    var porPadre = new Map();
    Array.prototype.forEach.call(lista, function (el) {
      if (visto && visto.has(el)) return;
      if (/^(SCRIPT|STYLE|LINK|TEMPLATE)$/.test(el.tagName)) return;
      // Si un ancestro ya aparece como bloque, este no se anima por separado
      var p = el.parentElement, dentro = false;
      while (p && p !== document.body) { if (p.classList && p.classList.contains("sue-rv")) { dentro = true; break; } p = p.parentElement; }
      if (dentro) return;
      if (visto) visto.add(el);
      var n = porPadre.get(el.parentElement) || 0;
      porPadre.set(el.parentElement, n + 1);
      el.style.setProperty("--rv-d", Math.min(n, 5) * 70 + "ms");
      el.classList.add("sue-rv");
      io.observe(el);
    });
  }

  function iniciar() {
    preparar(document);
    // Contenido que llega después (publicaciones, actividades, etc.)
    var pendiente = false;
    new MutationObserver(function () {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(function () { pendiente = false; preparar(document); });
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
