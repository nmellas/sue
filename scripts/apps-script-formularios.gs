/* ==========================================================================
   Aviso a GitHub cuando se usa un formulario — SUE
   Proyecto de Apps Script de la cuenta de la SUE ("Aviso formularios web SUE",
   en script.google.com). Cada vez que alguien envía el formulario de
   actividades o el de publicaciones (o se edita una de sus hojas, p. ej. al
   cambiar "Estado" a "Publicado"), avisa a GitHub y este:
     1) copia las fotos de Drive dentro de la web (img/actividades, img/publicaciones),
     2) regenera las páginas de publicaciones y el sitemap,
     3) publica el sitio.
   Todo queda en línea en 2 a 6 minutos. Sin esto, igual se actualiza cada hora.

   ── CÓMO SE ACTIVA (una sola vez) ─────────────────────────────────────────
   A. Clave de GitHub (token): github.com → Settings → Developer settings →
      Personal access tokens → Fine-grained tokens → Generate new token.
        - Repository access: Only select repositories → nmellas/sue
        - Permissions → Repository permissions → Contents: Read and write
        - Expiration: 1 año (al vencer hay que crear otra y repetir el paso B)
   B. En este proyecto: engranaje (Configuración del proyecto) → Propiedades
      del script → GITHUB_TOKEN = la clave del paso A.
   C. Ejecutar la función instalarActivadores (una vez). Google pide
      autorizar el script con la cuenta de la SUE.
   D. Ejecutar probarAviso: en github.com/nmellas/sue → Actions debe aparecer
      una ejecución nueva de "Páginas de publicaciones".
   ========================================================================== */

const REPO = "nmellas/sue";

// Hojas de respuestas de los formularios (cuenta de la SUE)
const HOJAS = {
  actividades: "1OKwZUslPUC0og_vnq-9LvFniO72c9Tfg1C6AqTAKmDE",   // Subir actividad SUE (respuestas)
  publicaciones: "1jxrl2VyvQoUEuqvq-NpD2VqOX76Am6DqH4Ae1nRyj5Q", // Formulario de publicación SUE (respuestas)
};

function avisarGitHub_(motivo) {
  const token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  if (!token) throw new Error("Falta la propiedad GITHUB_TOKEN (paso B).");

  // Si hay varios cambios seguidos, basta con un aviso por minuto:
  // la ejecución en GitHub espera y reintenta hasta ver los datos nuevos.
  const cache = CacheService.getScriptCache();
  if (cache.get("aviso-reciente")) return;
  cache.put("aviso-reciente", "1", 60);

  const r = UrlFetchApp.fetch("https://api.github.com/repos/" + REPO + "/dispatches", {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    payload: JSON.stringify({ event_type: "formulario", client_payload: { motivo: motivo } }),
    muteHttpExceptions: true,
  });
  if (r.getResponseCode() !== 204) {
    throw new Error("GitHub respondió " + r.getResponseCode() + ": " + r.getContentText());
  }
}

function alEnviarFormulario(e) { avisarGitHub_("formulario"); }
function alEditarHoja(e) { avisarGitHub_("edición de la hoja"); }
function probarAviso() { CacheService.getScriptCache().remove("aviso-reciente"); avisarGitHub_("prueba"); }

// Crea (o vuelve a crear) los activadores de las dos hojas
function instalarActivadores() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  Object.keys(HOJAS).forEach(function (nombre) {
    const hoja = SpreadsheetApp.openById(HOJAS[nombre]);
    ScriptApp.newTrigger("alEnviarFormulario").forSpreadsheet(hoja).onFormSubmit().create();
    ScriptApp.newTrigger("alEditarHoja").forSpreadsheet(hoja).onEdit().create();
  });
  Logger.log("Activadores creados: " + ScriptApp.getProjectTriggers().length);
}
