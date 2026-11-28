/* ==========================================================================
   guardar-fotos.mjs — SUE
   Copia dentro de la web las fotos que se suben por los formularios de Google
   (quedan en Drive), para que se sirvan desde suecon.cl: cargan más rápido,
   tienen nombres legibles y Google las indexa como imágenes del sitio.

   Lo ejecuta GitHub Actions (.github/workflows/publicaciones.yml) cada hora,
   antes de generar-publicaciones.mjs. El formulario no cambia en nada.

   - Lee las hojas de actividades (actividades-data.js → csvUrl) y de
     publicaciones (publicaciones-data.js → CSV_URL).
   - Por cada foto de Drive guarda dos versiones JPEG comprimidas:
       img/actividades/<titulo>-<n>.jpg      (1600 px de ancho)
       img/actividades/<titulo>-<n>-800.jpg  (800 px, para celulares y miniaturas)
     y lo mismo en img/publicaciones/ (portada y fotos del artículo).
   - Escribe fotos-drive.js con la lista (id de Drive → archivo local). Las
     páginas la usan para mostrar la copia local; si una foto todavía no se
     copia (o falla), siguen mostrándola directo desde Drive, como antes.
   - Las fotos que ya están copiadas no se vuelven a descargar, y las que se
     quitaron de la hoja se borran.
   ========================================================================== */
import { readFile, writeFile, mkdir, readdir, rm, access } from "node:fs/promises";

const RAIZ = new URL("../", import.meta.url);
const leer = (f) => readFile(new URL(f, RAIZ), "utf8");
const existe = (f) => access(new URL(f, RAIZ)).then(() => true, () => false);

const ANCHO = 1600, ANCHO_CHICO = 800;
const CARPETAS = { actividad: "img/actividades/", publicacion: "img/publicaciones/" };

/* ---------- Utilidades ---------- */
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
  const [cab, ...resto] = filas;
  return resto.filter((f) => f.some((x) => x.trim())).map((f) =>
    Object.fromEntries(cab.map((k, i) => [k.trim(), (f[i] || "").trim()])));
}
const sinTildes = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// Primera columna cuyo nombre contenga alguna de las palabras (sin tildes)
function campo(fila, palabras) {
  for (const p of palabras) for (const k of Object.keys(fila)) if (sinTildes(k).includes(p) && fila[k]) return fila[k];
  return "";
}
function slugify(t, max = 60) {
  let s = sinTildes(t).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (s.length > max) { s = s.slice(0, max); const i = s.lastIndexOf("-"); if (i > 20) s = s.slice(0, i); }
  return s || "foto";
}
const idsDrive = (txt) => [...String(txt || "").matchAll(/(?:[?&]id=|\/d\/)([\w-]{20,})/g)].map((m) => m[1]);

// Ancho y alto de un JPEG, leídos de su cabecera
function medidasJPEG(buf) {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1], largo = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m))
      return { alto: buf.readUInt16BE(i + 5), ancho: buf.readUInt16BE(i + 7) };
    i += 2 + largo;
  }
  return null;
}

async function descargar(id, ancho, destino) {
  if (await existe(destino)) return readFile(new URL(destino, RAIZ));
  const url = `https://lh3.googleusercontent.com/d/${id}=w${ancho}-rj-l82`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    const tipo = r.headers.get("content-type") || "";
    if (!r.ok || !tipo.startsWith("image/jpeg")) throw new Error(`${r.status} ${tipo}`);
    const buf = Buffer.from(await r.arrayBuffer());
    await writeFile(new URL(destino, RAIZ), buf);
    console.log("  descargada:", destino, Math.round(buf.length / 1024) + " KB");
    return buf;
  } finally { clearTimeout(t); }
}

async function leerHoja(url) {
  const r = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now());
  if (!r.ok) throw new Error("No se pudo leer la hoja: " + r.status);
  return parseCSV(await r.text());
}

/* ---------- Qué fotos hay ---------- */
const pedidos = [];   // { id, tipo, nombre, titulo }
const usados = new Set();
function agregar(tipo, id, nombreBase, titulo) {
  if (pedidos.some((p) => p.id === id)) return;
  let nombre = nombreBase, n = 2;
  while (usados.has(tipo + nombre)) nombre = `${nombreBase}-${n++}`;
  usados.add(tipo + nombre);
  pedidos.push({ id, tipo, nombre, titulo });
}

const actJs = await leer("actividades-data.js");
const actCsv = (actJs.match(/csvUrl:\s*"([^"]+)"/) || [])[1];
if (actCsv) {
  for (const f of await leerHoja(actCsv)) {
    const titulo = campo(f, ["titulo"]);
    if (!titulo) continue;
    idsDrive(campo(f, ["foto"])).forEach((id, i) => agregar("actividad", id, `${slugify(titulo)}-${i + 1}`, titulo));
  }
}

const pubJs = await leer("publicaciones-data.js");
const pubCsv = process.env.CSV_URL || (pubJs.match(/CSV_URL:\s*"([^"]+)"/) || [])[1];
if (pubCsv) {
  for (const f of await leerHoja(pubCsv)) {
    if (sinTildes(campo(f, ["estado"])) !== "publicado") continue;
    const titulo = campo(f, ["titulo"]) || "publicacion";
    const base = slugify(titulo);
    idsDrive(campo(f, ["portada", "imagen", "grafico"])).slice(0, 1)
      .forEach((id) => agregar("publicacion", id, `${base}-portada`, titulo));
    idsDrive(campo(f, ["contenido"]))
      .forEach((id, i) => agregar("publicacion", id, `${base}-${i + 1}`, titulo));
  }
}

/* ---------- Descarga ---------- */
for (const c of Object.values(CARPETAS)) await mkdir(new URL(c, RAIZ), { recursive: true });

const fotos = {};
const archivosUsados = new Set();
for (const p of pedidos) {
  const carpeta = CARPETAS[p.tipo];
  const grande = `${carpeta}${p.nombre}.jpg`, chica = `${carpeta}${p.nombre}-800.jpg`;
  try {
    const buf = await descargar(p.id, ANCHO, grande);
    await descargar(p.id, ANCHO_CHICO, chica);
    const m = medidasJPEG(buf) || {};
    fotos[p.id] = { src: grande, src800: chica, ancho: m.ancho || null, alto: m.alto || null, tipo: p.tipo, titulo: p.titulo };
    archivosUsados.add(grande); archivosUsados.add(chica);
  } catch (e) {
    console.warn("  no se pudo copiar", p.id, "→ se seguirá mostrando desde Drive:", e.message);
  }
}

// Borra las copias de fotos que ya no están en las hojas
for (const c of Object.values(CARPETAS)) {
  for (const f of await readdir(new URL(c, RAIZ))) {
    if (f.endsWith(".jpg") && !archivosUsados.has(c + f)) {
      await rm(new URL(c + f, RAIZ));
      console.log("  borrada:", c + f);
    }
  }
}

await writeFile(new URL("fotos-drive.js", RAIZ),
  "/* Generado por scripts/guardar-fotos.mjs: no editar a mano.\n" +
  "   Fotos de los formularios (Drive) copiadas dentro de la web. */\n" +
  "window.SUE_FOTOS = " + JSON.stringify(fotos, null, 1) + ";\n");
console.log(`Fotos copiadas: ${Object.keys(fotos).length} de ${pedidos.length}`);
