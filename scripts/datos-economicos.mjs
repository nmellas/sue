/* ==========================================================================
   datos-economicos.mjs — SUE
   Descarga los indicadores de la economía chilena desde mindicador.cl (que
   replica los datos del Banco Central y del INE) y los guarda, ya resumidos
   por mes, en datos/economia.json para la página datos.html.

   Lo ejecuta GitHub Actions junto con las publicaciones. La primera vez
   descarga toda la historia; después solo vuelve a pedir los dos últimos
   años y conserva el resto desde el propio datos/economia.json.

   IPC: mindicador.cl a veces se atrasa en publicar el IPC. Como la UF se
   reajusta exactamente con el IPC (del día 10 de un mes al 9 del siguiente
   acumula el IPC del mes anterior), los meses que falten se calculan desde
   la UF: IPC(m) = UF(9 de m+2) / UF(9 de m+1) − 1. Coincide con el oficial.
   ========================================================================== */
import { readFile, writeFile, mkdir } from "node:fs/promises";

const RAIZ = new URL("../", import.meta.url);
const ARCHIVO = new URL("datos/economia.json", RAIZ);
const HOY = new Date();
const AÑO = HOY.getFullYear();
const hoyISO = new Date(HOY.getTime() - 3 * 3600e3).toISOString().slice(0, 10);   // hora de Chile aprox.

// Desde qué año pedir cada serie la primera vez
const INICIO = { ipc: 1976, uf: 1977, tpm: 2005, dolar: 2000, libra_cobre: 2012, imacec: 2005, tasa_desempleo: 2010 };

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
async function serie(indicador, año) {
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const r = await fetch(`https://mindicador.cl/api/${indicador}/${año}`, { headers: { "User-Agent": "sue-datos/1.0" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      return (j.serie || []).map((p) => [p.fecha.slice(0, 10), p.valor]);
    } catch (e) {
      if (intento === 3) { console.warn(`  ${indicador} ${año}: ${e.message}`); return null; }
      await espera(1500 * intento);
    }
  }
}

let previo = null;
try { previo = JSON.parse(await readFile(ARCHIVO, "utf8")); } catch { previo = null; }

/* ---------- Descarga: datos diarios agrupados por mes ---------- */
const bruto = {};   // { indicador: { "AAAA-MM": [[fecha, valor], ...] } }
for (const ind of Object.keys(INICIO)) {
  bruto[ind] = {};
  const desde = previo ? Math.max(INICIO[ind], AÑO - 1) : INICIO[ind];
  for (let año = desde; año <= AÑO; año++) {
    const s = await serie(ind, año);
    if (s) for (const p of s) (bruto[ind][p[0].slice(0, 7)] = bruto[ind][p[0].slice(0, 7)] || []).push(p);
    await espera(150);
  }
  for (const m of Object.keys(bruto[ind])) bruto[ind][m].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  console.log(`${ind}: ${Object.keys(bruto[ind]).length} meses descargados`);
}

const r = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
const mesSig = (m, n = 1) => {
  let [y, mm] = m.split("-").map(Number);
  mm += n; while (mm > 12) { mm -= 12; y++; } while (mm < 1) { mm += 12; y--; }
  return `${y}-${String(mm).padStart(2, "0")}`;
};
// Junta lo anterior con lo recién calculado (lo nuevo manda) y ordena por mes
function unir(anterior, nuevo) {
  const mapa = new Map((anterior || []).map((x) => [x[0], x]));
  for (const x of nuevo) mapa.set(x[0], x);
  return [...mapa.values()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}
const porMes = (ind, f) => Object.keys(bruto[ind]).sort().map((m) => [m, f(bruto[ind][m])]);

/* ---------- IPC mensual (oficial + calculado desde la UF) ---------- */
const oficial = new Map((previo?.ipc || []).filter((x) => x[2] === "oficial").map((x) => [x[0], x[1]]));
for (const [m, v] of porMes("ipc", (d) => d[0][1])) oficial.set(m, v);
const uf9 = {};
for (const [m, d] of Object.entries(bruto.uf)) { const p = d.find((x) => x[0].endsWith("-09")); if (p) uf9[m] = p[1]; }

const ipcNuevo = [...oficial].map(([m, v]) => [m, v, "oficial"]);
let m = mesSig([...oficial.keys()].sort().at(-1));
while (uf9[mesSig(m, 2)] && uf9[mesSig(m, 1)]) {
  ipcNuevo.push([m, r((uf9[mesSig(m, 2)] / uf9[mesSig(m, 1)] - 1) * 100, 2), "uf"]);
  m = mesSig(m);
}
// Los meses calculados que ahora tienen dato oficial se reemplazan
const ipc = unir((previo?.ipc || []).filter((x) => !oficial.has(x[0])), ipcNuevo);

/* ---------- Último valor con fecha hasta hoy (la UF se publica por adelantado) ---------- */
function ultimoDia(ind, anterior) {
  const todos = Object.values(bruto[ind]).flat().sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const p = todos.filter((x) => x[0] <= hoyISO).at(-1) || todos.at(-1);
  return p ? { fecha: p[0], valor: p[1] } : anterior;
}

const prom = (dec) => (d) => r(d.reduce((s, p) => s + p[1], 0) / d.length, dec);
const salida = {
  actualizado: HOY.toISOString(),
  fuente: "Banco Central de Chile e INE, vía mindicador.cl",
  ipc,                                                                     // [mes, variación % mensual, "oficial" | "uf"]
  tpm: unir(previo?.tpm, porMes("tpm", (d) => r(d.at(-1)[1], 2))),         // % al cierre de cada mes
  dolar: unir(previo?.dolar, porMes("dolar", prom(2))),                    // $ promedio mensual
  cobre: unir(previo?.cobre, porMes("libra_cobre", prom(3))),              // US$/lb promedio mensual
  imacec: unir(previo?.imacec, porMes("imacec", (d) => r(d[0][1], 1))),    // variación % a 12 meses
  desempleo: unir(previo?.desempleo, porMes("tasa_desempleo", (d) => r(d[0][1], 2))), // % trimestre móvil
  ultimo: {
    uf: ultimoDia("uf", previo?.ultimo?.uf),
    dolar: ultimoDia("dolar", previo?.ultimo?.dolar),
    tpm: ultimoDia("tpm", previo?.ultimo?.tpm),
    cobre: ultimoDia("libra_cobre", previo?.ultimo?.cobre),
  },
};

await mkdir(new URL("datos/", RAIZ), { recursive: true });
await writeFile(ARCHIVO, JSON.stringify(salida));
const calc = ipc.filter((x) => x[2] === "uf").map((x) => x[0]);
console.log(`IPC hasta ${ipc.at(-1)[0]}${calc.length ? ` (calculado desde la UF: ${calc[0]} a ${calc.at(-1)})` : ""}`);
