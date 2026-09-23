/* ==========================================================================
   actividades-data.js — Actividades de la SUE
   Lee las actividades aprobadas desde una hoja de Google Sheets publicada
   como CSV (alimentada por un Google Form) y arma:
     1) un carrusel con las fotos de la actividad más reciente
     2) una grilla con todas las actividades (título, fecha, resumen)
   En index.html solo se muestra el carrusel (sin grilla).
   Ver TUTORIAL-actividades.md para la configuración.
   ========================================================================== */
(function () {
  "use strict";

  var CONFIG = {
    // Pega aquí el enlace CSV de la pestaña "Web"
    // (Hoja de cálculo → Archivo → Compartir → Publicar en la web → CSV).
    csvUrl: "",
    intervaloMs: 5500,     // tiempo entre fotos del carrusel
    anchoFoto: 1600,       // resolución de las fotos del carrusel
    anchoMiniatura: 800    // resolución de las miniaturas de la grilla
  };

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fmtFecha = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "long", year: "numeric" });

  function $(id) { return document.getElementById(id); }

  /* ---------- Lectura de datos ---------- */

  function normalizar(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  }

  // Busca la columna por nombre aproximado ("Título", "titulo", "Título de la actividad"…)
  function campo(fila, clave) {
    var claves = Object.keys(fila);
    for (var i = 0; i < claves.length; i++) {
      if (normalizar(claves[i]).indexOf(clave) !== -1) return String(fila[claves[i]] || "").trim();
    }
    return "";
  }

  function parseFecha(txt) {
    if (!txt) return null;
    var m = txt.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = txt.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    var d = new Date(txt);
    return isNaN(d) ? null : d;
  }

  function idDrive(url) {
    var m = url.match(/[?&]id=([\w-]{10,})/) || url.match(/\/d\/([\w-]{10,})/);
    return m ? m[1] : null;
  }

  // Google Forms guarda las fotos como enlaces de Drive separados por comas.
  function leerFotos(txt) {
    return String(txt || "").split(/[\s,]+/).filter(Boolean).map(function (u) {
      var id = idDrive(u);
      if (id) {
        return {
          src: function (w) { return "https://drive.google.com/thumbnail?id=" + id + "&sz=w" + w; },
          respaldo: function (w) { return "https://lh3.googleusercontent.com/d/" + id + "=w" + w; }
        };
      }
      if (/^https?:\/\//i.test(u)) return { src: function () { return u; }, respaldo: null };
      return null;
    }).filter(Boolean);
  }

  function procesar(filas) {
    var lista = filas.map(function (f) {
      var fechaTxt = campo(f, "fecha");
      return {
        titulo: campo(f, "titulo"),
        fecha: parseFecha(fechaTxt),
        descripcion: campo(f, "descripcion"),
        fotos: leerFotos(campo(f, "foto"))
      };
    }).filter(function (a) { return a.titulo; });

    lista.sort(function (a, b) {
      if (!a.fecha) return 1;
      if (!b.fecha) return -1;
      return b.fecha - a.fecha;
    });
    return lista;
  }

  /* ---------- Utilidades de render ---------- */

  function crearImg(foto, ancho, alt, prioridad) {
    var img = new Image();
    img.decoding = "async";
    img.loading = prioridad ? "eager" : "lazy";
    img.alt = alt;
    if (foto.respaldo) {
      img.addEventListener("error", function onErr() {
        img.removeEventListener("error", onErr);
        img.src = foto.respaldo(ancho);
      });
    }
    img.src = foto.src(ancho);
    return img;
  }

  function el(tag, clase, texto) {
    var n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto != null) n.textContent = texto;
    return n;
  }

  function textoFecha(d) { return d ? fmtFecha.format(d) : ""; }
  function isoFecha(d) {
    if (!d) return "";
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  /* ---------- Carrusel ---------- */

  var slides = [], idx = 0, timer = null;
  var pausaUsuario = reduceMotion, pausaTemporal = false;

  function cargarSlide(i) {
    var s = slides[i];
    if (!s || s.dataset.cargada) return;
    s.dataset.cargada = "1";
    s.appendChild(crearImg(s._foto, CONFIG.anchoFoto, s._alt, true));
  }

  function ir(n) {
    if (!slides.length) return;
    idx = (n + slides.length) % slides.length;
    slides.forEach(function (s, i) {
      var activa = i === idx;
      s.classList.toggle("is-active", activa);
      s.setAttribute("aria-hidden", activa ? "false" : "true");
    });
    cargarSlide(idx);
    cargarSlide((idx + 1) % slides.length);
    var dots = $("act-dots").children;
    for (var i = 0; i < dots.length; i++) dots[i].setAttribute("aria-current", i === idx ? "true" : "false");
    $("act-contador").textContent = slides.length > 1 ? "Foto " + (idx + 1) + " de " + slides.length : "";
  }

  function programar() {
    clearInterval(timer);
    timer = null;
    if (slides.length > 1 && !pausaUsuario && !pausaTemporal && !document.hidden) {
      timer = setInterval(function () { ir(idx + 1); }, CONFIG.intervaloMs);
    }
  }

  function actualizarBotonPausa() {
    var b = $("act-pausa");
    b.textContent = pausaUsuario ? "Reanudar" : "Pausar";
    b.setAttribute("aria-pressed", pausaUsuario ? "true" : "false");
  }

  function mostrarActividad(act, esUltima) {
    $("act-etiqueta").textContent = esUltima ? "Última actividad" : "Actividad";
    $("act-titulo").textContent = act.titulo;
    var f = $("act-fecha");
    f.textContent = textoFecha(act.fecha);
    f.setAttribute("datetime", isoFecha(act.fecha));
    $("act-desc").textContent = act.descripcion;

    var cont = $("act-slides"), dots = $("act-dots");
    cont.textContent = "";
    dots.textContent = "";
    slides = act.fotos.map(function (foto, i) {
      var s = el("div", "act-slide");
      s.setAttribute("role", "group");
      s.setAttribute("aria-roledescription", "diapositiva");
      s.setAttribute("aria-label", (i + 1) + " de " + act.fotos.length);
      s._foto = foto;
      s._alt = act.titulo + ", foto " + (i + 1);
      cont.appendChild(s);

      var d = el("button");
      d.type = "button";
      d.setAttribute("aria-label", "Ir a la foto " + (i + 1));
      d.addEventListener("click", function () { ir(i); programar(); });
      dots.appendChild(d);
      return s;
    });

    var stage = $("act-stage");
    stage.classList.toggle("is-empty", !slides.length);
    stage.classList.toggle("is-single", slides.length === 1);
    if (!slides.length) cont.appendChild(el("p", "act-sin-fotos", "Esta actividad aún no tiene fotos."));

    idx = 0;
    ir(0);
    actualizarBotonPausa();
    programar();
  }

  function iniciarControles() {
    var stage = $("act-stage");
    $("act-prev").addEventListener("click", function () { ir(idx - 1); programar(); });
    $("act-next").addEventListener("click", function () { ir(idx + 1); programar(); });
    $("act-pausa").addEventListener("click", function () {
      pausaUsuario = !pausaUsuario;
      actualizarBotonPausa();
      programar();
    });

    stage.addEventListener("mouseenter", function () { pausaTemporal = true; programar(); });
    stage.addEventListener("mouseleave", function () { pausaTemporal = false; programar(); });
    stage.addEventListener("focusin", function () { pausaTemporal = true; programar(); });
    stage.addEventListener("focusout", function (e) {
      if (!stage.contains(e.relatedTarget)) { pausaTemporal = false; programar(); }
    });
    stage.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { ir(idx - 1); programar(); }
      if (e.key === "ArrowRight") { ir(idx + 1); programar(); }
    });

    // Deslizar con el dedo en celular
    var x0 = null;
    stage.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener("touchend", function (e) {
      if (x0 == null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) { ir(dx < 0 ? idx + 1 : idx - 1); programar(); }
      x0 = null;
    });

    document.addEventListener("visibilitychange", programar);
  }

  /* ---------- Grilla ---------- */

  function tarjeta(act, esUltima) {
    var art = el("article", "act-card");

    if (act.fotos.length) {
      var media = el("div", "act-card-media");
      media.appendChild(crearImg(act.fotos[0], CONFIG.anchoMiniatura, "", false));
      if (act.fotos.length > 1) media.appendChild(el("span", "act-badge", act.fotos.length + " fotos"));
      art.appendChild(media);
    }

    var body = el("div", "act-card-body");
    if (act.fecha) {
      var t = el("time", null, textoFecha(act.fecha));
      t.setAttribute("datetime", isoFecha(act.fecha));
      body.appendChild(t);
    }
    body.appendChild(el("h3", null, act.titulo));
    var p = el("p", "act-card-desc", act.descripcion);
    body.appendChild(p);

    var acciones = el("div", "act-card-actions");
    var leer = el("button", "act-link", "Leer más");
    leer.type = "button";
    leer.hidden = true;
    leer.addEventListener("click", function () {
      var abierta = art.classList.toggle("is-expanded");
      leer.textContent = abierta ? "Mostrar menos" : "Leer más";
    });
    acciones.appendChild(leer);

    if (act.fotos.length) {
      var ver = el("button", "act-link", act.fotos.length > 1 ? "Ver fotos" : "Ver foto");
      ver.type = "button";
      ver.addEventListener("click", function () {
        mostrarActividad(act, esUltima);
        $("act-showcase").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      });
      acciones.appendChild(ver);
    }
    body.appendChild(acciones);
    art.appendChild(body);

    // Muestra "Leer más" solo si el resumen quedó recortado
    requestAnimationFrame(function () {
      if (p.scrollHeight > p.clientHeight + 2) leer.hidden = false;
    });
    return art;
  }

  /* ---------- Estados ---------- */

  // Muestra u oculta un elemento solo si existe en la página actual
  function mostrar(id, visible) {
    var n = $(id);
    if (n) n.hidden = !visible;
  }

  function estado(mensaje) {
    var e = $("act-estado");
    if (!e) return;
    e.textContent = mensaje;
    e.hidden = false;
  }

  function sinActividades() {
    mostrar("act-estado", false);
    mostrar("act-showcase", false);
    mostrar("act-archivo", false);
    mostrar("act-sin-datos", true);   // aviso en actividades.html
    mostrar("act-home", false);       // en el inicio se oculta la sección completa
  }

  function render(lista) {
    mostrar("act-estado", false);
    if (!lista.length) return sinActividades();

    mostrar("act-home", true);
    mostrar("act-showcase", true);
    mostrar("act-archivo", true);
    mostrarActividad(lista[0], true);

    var grid = $("act-grid");
    if (!grid) return;
    grid.textContent = "";
    lista.forEach(function (a, i) { grid.appendChild(tarjeta(a, i === 0)); });
  }

  function cargar() {
    if (!CONFIG.csvUrl) return sinActividades();
    if (!window.Papa) {
      console.error("Actividades: falta la librería PapaParse.");
      return sinActividades();
    }
    var url = CONFIG.csvUrl + (CONFIG.csvUrl.indexOf("?") === -1 ? "?" : "&") + "t=" + Date.now();
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: function (r) { render(procesar(r.data || [])); },
      error: function (err) {
        console.error("Actividades: no se pudo leer la hoja.", err);
        sinActividades();
      }
    });
  }

  function iniciar() {
    if (!$("act-stage")) return;
    iniciarControles();
    estado("Cargando actividades…");
    cargar();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
