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
