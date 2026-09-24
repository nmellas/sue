/* ==========================================================================
   generar-publicaciones.mjs — SUE
   Crea una página estática por publicación (p/el-titulo.html) con su
   título, resumen y portada en las etiquetas Open Graph, para que WhatsApp,
   Instagram y LinkedIn muestren la vista previa de CADA publicación.

   Lo ejecuta GitHub Actions (.github/workflows/publicaciones.yml) cada hora.
   - Lee el enlace CSV desde publicaciones-data.js (CONFIG.CSV_URL).
   - Lee la dirección del sitio desde el <link rel="canonical"> de index.html.
   - Usa articulo.html como plantilla: la página generada muestra el mismo
     artículo, solo que con las etiquetas ya escritas.
   - Si se corrige un título, la dirección anterior se mantiene activa
     (historial en p/_direcciones.json), para no romper enlaces compartidos.
   ========================================================================== */
import { readFile, writeFile, rm, mkdir } from "node:fs/promises";

const RAIZ = new URL("../", import.meta.url);
const leer = (f) => readFile(new URL(f, RAIZ), "utf8");

/* ---------- Configuración tomada del propio sitio ---------- */
const datosJs = await leer("publicaciones-data.js");
const CSV_URL = process.env.CSV_URL || (datosJs.match(/CSV_URL:\s*"([^"]+)"/) || [])[1];
const index = await leer("index.html");
const BASE = ((index.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || "").replace(/index\.html$/, "");
if (!CSV_URL) throw new Error("No se encontró CSV_URL en publicaciones-data.js");
if (!BASE) throw new Error('No se encontró <link rel="canonical"> en index.html');

/* ---------- CSV (con comillas, comas y saltos de línea dentro de celdas) ---------- */
function parseCSV(texto) {
  const filas = []; let fila = []; let celda = ""; let q = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (q) {
      if (c === '"' && texto[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') q = false;
      else celda += c;
    } else if (c === '"') q = true;
    else if (c === ",") { fila.push(celda); celda = ""; }
    else if (c === "\n") { fila.push(celda); filas.push(fila); fila = []; celda = ""; }
    else if (c !== "\r") celda += c;
  }
  if (celda !== "" || fila.length) { fila.push(celda); filas.push(fila); }
  const [enc, ...resto] = filas;
  return resto
    .filter((f) => f.some((v) => v.trim() !== ""))           // igual que skipEmptyLines de PapaParse
    .map((f) => Object.fromEntries(enc.map((h, i) => [h, f[i] ?? ""])));
}

/* ---------- Misma lógica de columnas que el sitio ---------- */
const campo = (fila, candidatos) => {
  for (const c of candidatos) for (const k of Object.keys(fila))
    if (k.trim().toLowerCase() === c.toLowerCase() && fila[k].trim()) return fila[k].trim();
  return "";
};
const sinTildes = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const campoParecido = (fila, claves) => {
  for (const k of Object.keys(fila)) for (const c of claves)
    if (sinTildes(k).includes(c) && fila[k].trim()) return fila[k].trim();
  return "";
};
function imagenUrl(raw) {
  const u = String(raw).split(/[\s,]+/).filter(Boolean)[0] || "";
  const id = (u.match(/[?&]id=([\w-]{10,})/) || u.match(/\/d\/([\w-]{10,})/) || [])[1];
  if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
  return /^https?:\/\//i.test(u) ? u : "";
}
function slugify(titulo) {
  let s = String(titulo || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (s.length > 70) { s = s.slice(0, 70); const i = s.lastIndexOf("-"); if (i > 30) s = s.slice(0, i); }
  return s || "publicacion";
}
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const recortar = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);

/* ---------- Generación ---------- */
const res = await fetch(CSV_URL + (CSV_URL.includes("?") ? "&" : "?") + "t=" + Date.now());
if (!res.ok) throw new Error("No se pudo leer la hoja: " + res.status);
const filas = parseCSV(await res.text());
const plantilla = await leer("articulo.html");

// Historial de direcciones: clave estable (Marca temporal) → direcciones que ha tenido
let historial = {};
try { historial = JSON.parse(await leer("p/_direcciones.json")); } catch { historial = {}; }

await rm(new URL("p/", RAIZ), { recursive: true, force: true });
await mkdir(new URL("p/", RAIZ), { recursive: true });

let total = 0;
const usados = new Set();
const nuevoHistorial = {};
for (const [id, fila] of filas.entries()) {
  if (campo(fila, ["Estado"]).toLowerCase() !== "publicado") continue;

  const tituloBruto = campo(fila, ["Título", "Titulo"]);
  const titulo = tituloBruto || "Publicación";
  // Dirección legible, única (misma regla que el sitio)
  const base = slugify(tituloBruto);
  let slug = base, n = 2;
  while (usados.has(slug)) slug = `${base}-${n++}`;
  usados.add(slug);
  // Clave estable para reconocer la publicación aunque cambie su título o su fila
  const clave = campo(fila, ["Marca temporal", "Timestamp"]) || `fila-${id}`;
  const resumen = recortar(campo(fila, ["Resumen"]) || "Publicación de la Sociedad Universitaria de Economía.", 200);
  const tipo = campo(fila, ["Tipo"]) || "Artículo";
  const autor = campo(fila, ["Autor", "Autor(es)"]);
  const imagen = imagenUrl(campoParecido(fila, ["imagen", "portada", "grafico"])) || BASE + "og-image.jpg";
  const url = `${BASE}p/${slug}.html`;

  const etiquetas = [
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="SUE — Sociedad Universitaria de Economía">`,
    `<meta property="og:locale" content="es_CL">`,
    `<meta property="og:title" content="${esc(titulo)}">`,
    `<meta property="og:description" content="${esc(resumen)}">`,
    `<meta property="og:image" content="${esc(imagen)}">`,
    `<meta property="og:image:alt" content="${esc(titulo)}">`,
    autor ? `<meta property="article:author" content="${esc(autor)}">` : "",
    `<meta property="article:section" content="${esc(tipo)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].filter(Boolean).join("\n");

  let html = plantilla
    // rutas relativas funcionan desde la carpeta p/
    .replace(/<meta charset="UTF-8">/i, '<meta charset="UTF-8">\n<base href="../">')
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(titulo)} — SUE</title>`)
    .replace(/<meta name="description" content="[^"]*">/i, `<meta name="description" content="${esc(resumen)}">`)
    // quita las etiquetas genéricas de la plantilla
    .replace(/^.*(og:|twitter:|rel="canonical"|Vista previa al compartir).*\n/gim, "")
    .replace("</head>", `${etiquetas}\n<script>window.ARTICULO_ID = ${id}; window.ARTICULO_CLAVE = ${JSON.stringify(clave)};</script>\n</head>`);

  // Dirección actual + direcciones anteriores de esta misma publicación (mismo contenido,
  // con la dirección actual como canónica)
  const direcciones = [slug, ...((historial[clave] || []).filter((d) => d !== slug))];
  for (const d of direcciones) await writeFile(new URL(`p/${d}.html`, RAIZ), html);
  nuevoHistorial[clave] = direcciones;
  total++;
}
await writeFile(new URL("p/_direcciones.json", RAIZ), JSON.stringify(nuevoHistorial, null, 2) + "\n");
console.log(`Publicaciones generadas: ${total}`);
