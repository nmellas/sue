/* ==========================================================================
   contacto.js — Formulario de contacto de la SUE
   Envía los datos al backend (Google Apps Script de la cuenta de la SUE),
   que manda el correo a sociedaduniversitariadeconomia@gmail.com.
   Ver TUTORIAL-contacto.md.
   ========================================================================== */
(function () {
  "use strict";

  var CONFIG = {
    // Pega aquí la URL de la App web (termina en /exec)
    endpoint: "https://script.google.com/macros/s/AKfycbxpJzGg30UALlaVzoqMquVlRfNrA1CpOzaZVYwmLeDQ3P0u_dkt4gSMde3j91FTjcYY/exec",
    correoSue: "sociedaduniversitariadeconomia@gmail.com"
  };

  var form = document.getElementById("sue-contacto");
  if (!form) return;

  var estado = document.getElementById("sue-contacto-estado");
  var boton = form.querySelector("button[type=submit]");
  var textoBoton = boton.textContent;
  var t0 = Date.now();

  function mostrar(tipo, texto) {
    estado.className = "form-msg " + (tipo === "ok" ? "is-ok" : tipo === "error" ? "is-error" : "");
    estado.textContent = texto;
    estado.hidden = false;
  }

  function enviando(activo) {
    boton.disabled = activo;
    boton.textContent = activo ? "Enviando…" : textoBoton;
    form.setAttribute("aria-busy", activo ? "true" : "false");
  }

  // Si el backend no está configurado, abre el programa de correo con todo prellenado
  function abrirCorreo(datos) {
    var cuerpo = datos.get("mensaje") + "\n\n— " + datos.get("nombre") + " (" + datos.get("correo") + ")";
    window.location.href = "mailto:" + CONFIG.correoSue +
      "?subject=" + encodeURIComponent(datos.get("asunto")) +
      "&body=" + encodeURIComponent(cuerpo);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    // Validación del navegador (campos obligatorios y formato de correo)
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var datos = new FormData(form);
    datos.set("t0", String(t0));

    if (!CONFIG.endpoint) {
      abrirCorreo(datos);
      return;
    }

    enviando(true);
    mostrar("", "Enviando tu mensaje…");

    fetch(CONFIG.endpoint, {
      method: "POST",
      body: new URLSearchParams(datos) // formato simple: evita bloqueos entre dominios
    })
      .then(function (res) { return res.json(); })
      .then(function (r) {
        if (r && r.ok) {
          form.reset();
          t0 = Date.now();
          mostrar("ok", r.mensaje || "¡Gracias! Recibimos tu mensaje.");
        } else {
          mostrar("error", (r && r.mensaje) || "No pudimos enviar el mensaje. Intenta de nuevo.");
        }
      })
      .catch(function (err) {
        console.error("Contacto:", err);
        mostrar("error", "No pudimos enviar el mensaje. Intenta de nuevo o escríbenos directo a " + CONFIG.correoSue + ".");
      })
      .then(function () { enviando(false); });
  });
})();
