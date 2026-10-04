/* ==========================================================================
   contacto.js — Formulario de contacto de la SUE
   Envía los datos al backend (Google Apps Script de la cuenta de la SUE),
   que manda el correo a contacto@suecon.cl.
   Ver TUTORIAL-contacto.md.
   ========================================================================== */
(function () {
  "use strict";

  var CONFIG = {
    // ⚠️ Pega aquí la URL de la App web (termina en /exec).
    // Si reemplazas este archivo, conserva TU url: sin ella el formulario solo abre el programa de correo.
    endpoint: "https://script.google.com/macros/s/AKfycbxpJzGg30UALlaVzoqMquVlRfNrA1CpOzaZVYwmLeDQ3P0u_dkt4gSMde3j91FTjcYY/exec",
    correoSue: "contacto@suecon.cl"
  };

  var form = document.getElementById("sue-contacto");
  if (!form) return;

  var estado = document.getElementById("sue-contacto-estado");
  var boton = form.querySelector("button[type=submit]");
  var textoBoton = boton.textContent;
  var t0 = Date.now();

  // Muestra un mensaje bajo el botón. tipo: "ok" | "error" | "" (neutro)
  function mostrar(tipo, texto) {
    estado.className = "form-msg " + (tipo === "ok" ? "is-ok" : tipo === "error" ? "is-error" : "");
    estado.removeAttribute("style");
    estado.textContent = "";
    if (tipo === "ok") {
      // Confirmación destacada (estilos en línea: no dependen del CSS ni de su caché)
      estado.style.cssText = "padding:14px 16px;border:1px solid #1f7a3d;border-left:4px solid #1f7a3d;border-radius:6px;background:#eef7f0;color:#1f4d2e;line-height:1.5;";
      var titulo = document.createElement("strong");
      titulo.style.cssText = "display:block;font-size:16px;margin-bottom:2px;";
      titulo.textContent = "✓ ¡Mensaje enviado con éxito!";
      estado.appendChild(titulo);
    }
    estado.appendChild(document.createTextNode(texto));
    estado.hidden = false;
    if (tipo === "ok" && estado.scrollIntoView) estado.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function enviando(activo) {
    boton.disabled = activo;
    boton.textContent = activo ? "Enviando…" : textoBoton;
    form.setAttribute("aria-busy", activo ? "true" : "false");
  }

  // Tras un envío exitoso el botón queda un momento en "✓ Enviado" para evitar reenvíos por error
  function confirmarEnBoton() {
    boton.disabled = true;
    boton.textContent = "✓ Enviado";
    form.setAttribute("aria-busy", "false");
    setTimeout(function () { enviando(false); }, 4000);
  }

  // Si el backend no está configurado, abre el programa de correo con todo prellenado
  function abrirCorreo(datos) {
    var cuerpo = datos.get("mensaje") + "\n\n— " + datos.get("nombre") + " (" + datos.get("correo") + ")";
    mostrar("", "Abriendo tu programa de correo para enviar el mensaje a " + CONFIG.correoSue + "…");
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

    // Se guardan antes de vaciar el formulario, para personalizar la confirmación
    var primerNombre = String(datos.get("nombre") || "").trim().split(/\s+/)[0];
    var correo = String(datos.get("correo") || "").trim();
    var exito = false;

    enviando(true);
    mostrar("", "Enviando tu mensaje…");

    fetch(CONFIG.endpoint, {
      method: "POST",
      body: new URLSearchParams(datos) // formato simple: evita bloqueos entre dominios
    })
      .then(function (res) { return res.json(); })
      .then(function (r) {
        if (r && r.ok) {
          exito = true;
          form.reset();
          t0 = Date.now();
          mostrar("ok", "Gracias" + (primerNombre ? ", " + primerNombre : "") + ". Recibimos tu mensaje y te responderemos a " + correo + " lo antes posible.");
        } else {
          mostrar("error", (r && r.mensaje) || "No pudimos enviar el mensaje. Intenta de nuevo.");
        }
      })
      .catch(function (err) {
        console.error("Contacto:", err);
        mostrar("error", "No pudimos enviar el mensaje. Intenta de nuevo o escríbenos directo a " + CONFIG.correoSue + ".");
      })
      .then(function () { if (exito) confirmarEnBoton(); else enviando(false); });
  });
})();
