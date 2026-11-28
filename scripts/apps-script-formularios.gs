/* ==========================================================================
   Aviso a GitHub cuando se usa un formulario — SUE
   Va en las HOJAS DE RESPUESTAS de los formularios (actividades y
   publicaciones). Cada vez que alguien envía el formulario (o se edita la
   hoja, p. ej. al cambiar "Estado" a "Publicado"), avisa a GitHub y este:
     1) copia las fotos de Drive dentro de la web (img/actividades, img/publicaciones),
     2) regenera las páginas de publicaciones y el sitemap,
     3) publica el sitio.
   Todo queda en línea en 2 a 6 minutos. Sin esto, igual se actualiza cada hora.

   ── CÓMO ACTIVARLO (una sola vez) ─────────────────────────────────────────
   A. Crear la clave de GitHub (token):
      github.com → foto de perfil → Settings → Developer settings →
      Personal access tokens → Fine-grained tokens → Generate new token.
        - Token name: "SUE formularios"
        - Expiration: 1 año (anota la fecha: al vencer hay que crear otro)
        - Repository access: Only select repositories → nmellas/sue
        - Permissions → Repository permissions → Contents: Read and write
      Copia el token (empieza con github_pat_…). No lo compartas.

   B. En CADA hoja de respuestas (la de actividades y la de publicaciones):
      1. Extensiones → Apps Script. Borra lo que haya y pega este archivo.
      2. Engranaje (Configuración del proyecto) → Propiedades del script →
         Agregar propiedad: GITHUB_TOKEN = el token del paso A → Guardar.
      3. Reloj (Activadores) → Agregar activador:
           - Función: alEnviarFormulario
           - Fuente del evento: De la hoja de cálculo
           - Tipo de evento: Al enviar el formulario
         (Opcional) Otro activador igual con la función alEditarHoja y
         tipo "Al editar", para que también se actualice al editar la hoja.
         Google pedirá autorizar el script: acepta con tu cuenta.
      4. Para probar: elige la función probarAviso arriba y presiona Ejecutar.
         En github.com/nmellas/sue → Actions debería aparecer una ejecución
         nueva de "Páginas de publicaciones".
   ========================================================================== */

const REPO = "nmellas/sue";

function avisarGitHub_(motivo) {
  const token = PropertiesService.getScriptProperties().getProperty("GITHUB_TOKEN");
  if (!token) throw new Error("Falta la propiedad GITHUB_TOKEN (paso B.2).");

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
