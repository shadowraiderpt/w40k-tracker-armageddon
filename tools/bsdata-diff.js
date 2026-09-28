#!/usr/bin/env node
// tools/bsdata-diff.js — compara os dados da app (RAW_UNITS em index.html) com o
// BSData 11ª (github.com/BSData/wh40k-11e). NUNCA altera nada: só escreve
// tools/bsdata-diff-report.md. Corre-se à mão quando o Gonçalo decide atualizar:
//
//   node tools/bsdata-diff.js [pasta-do-BSData]
//
// Sem argumento, clona (--depth 1) para uma pasta temporária fora do repositório.
// Não faz parte do `npm test`.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const REPORT = path.join(__dirname, "bsdata-diff-report.md");
const REPO = "https://github.com/BSData/wh40k-11e.git";

// Catálogos a usar (facção -> ficheiros; o 1º que tiver a unidade ganha).
const CATALOGUES = {
  space_marines: ["Imperium - Space Marines.json"],
  orks: ["Orks.json"],
  tyranids: ["Tyranids.json", "Library - Tyranids.json"],
};
// Nomes da app -> nomes no BSData.
const NAME_MAP = {
  "Captain with Relic Shield": "Captain",
  "Wartrakk": "Wartrakks",
  "Screamer-Killer": "Screamer-killer",
};
// Entradas a ignorar (nome contém estas palavras).
const SKIP_RE = /crusade|enhancement|battle honour|battle scar|weapon modification|relic|trait/i;

// ---------------------------------------------------------------- BSData ----
function ensureBsdata(arg) {
  if (arg) return path.resolve(arg);
  const dir = path.join(os.tmpdir(), "bsdata_wh40k_11e");
  if (!fs.existsSync(path.join(dir, "Orks.json"))) {
    console.log("A clonar " + REPO + " para " + dir + " ...");
    execFileSync("git", ["clone", "--depth", "1", REPO, dir], { stdio: "inherit" });
  }
  return dir;
}
function loadCatalogue(dir, file) {
  return JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")).catalogue;
}
function walk(o, fn) {
  if (Array.isArray(o)) o.forEach(v => walk(v, fn));
  else if (o && typeof o === "object") { fn(o); Object.values(o).forEach(v => walk(v, fn)); }
}
function buildIndex(catalogues) {
  const idx = {};
  catalogues.forEach(c => walk(c, o => { if (o.id && !idx[o.id]) idx[o.id] = o; }));
  return idx;
}
function findUnitEntry(catalogues, name) {
  for (const c of catalogues) {
    const pools = [].concat(c.sharedSelectionEntries || [], c.selectionEntries || []);
    const hit = pools.find(e => e.name === name && (e.type === "unit" || e.type === "model"));
    if (hit) return hit;
  }
  return null;
}
// Recolhe perfis de forma recursiva (infoLinks/entryLinks resolvidos). As
// abilities só até profundidade 1.
function collect(entry, idx, depth, out, seen) {
  if (!entry || seen.has(entry.id) || SKIP_RE.test(entry.name || "")) return;
  seen.add(entry.id);
  (entry.profiles || []).forEach(p => addProfile(p, depth, out));
  (entry.infoLinks || []).forEach(l => {
    if (l.type === "profile" && idx[l.targetId] && !SKIP_RE.test(l.name || "")) addProfile(idx[l.targetId], depth, out, l.name);
  });
  const children = [].concat(entry.selectionEntries || []);
  (entry.selectionEntryGroups || []).forEach(g => collect(g, idx, depth, out, seen));
  (entry.entryLinks || []).forEach(l => {
    if (l.type === "selectionEntry" || l.type === "selectionEntryGroup") {
      const t = idx[l.targetId];
      if (t) children.push(t);
    }
  });
  children.forEach(ch => collect(ch, idx, depth + 1, out, seen));
}
function addProfile(p, depth, out, nameOverride) {
  const t = p.typeName;
  if (t === "Abilities" && depth > 1) return;
  if (!["Unit", "Ranged Weapons", "Melee Weapons", "Abilities"].includes(t)) return;
  const ch = {};
  (p.characteristics || []).forEach(c => { ch[c.name] = (c.$text || "").toString(); });
  out.push({ type: t, name: nameOverride || p.name, ch });
}

// -------------------------------------------------------------- app data ----
function loadAppData() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const a = html.indexOf("const RAW_UNITS = {");
  const b = html.indexOf("\n};", a);
  if (a < 0 || b < 0) throw new Error("RAW_UNITS não encontrado em index.html");
  return new Function(html.slice(a, b + 3) + "\nreturn RAW_UNITS;")();
}

// ------------------------------------------------------------ comparação ----
const norm = s => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9+\-]/g, "");
const normName = s => String(s || "").split(":")[0].toLowerCase().replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").replace(/astartes/g, "").replace(/[^a-z0-9]/g, "");
function statOf(unitProfile, k) {
  const m = { SV: "Sv", LD: "LD", InvSV: "InSv" };
  return (unitProfile.ch[m[k] || k] || "").replace(/\s+/g, "");
}
function kwBase(str) {
  return String(str || "").replace(/[\[\]]/g, "").split(",").map(x => x.trim()).filter(Boolean)
    .map(x => x.split(":")[0].trim().toUpperCase()).filter(x => x && x !== "-");
}
function fieldDiffs(appW, bsW, isMelee) {
  const d = [];
  const cmp = (label, a, b) => {
    const dash = x => (String(x == null ? "" : x).trim().toUpperCase() === "N/A" ? "-" : x);
    const na = norm(dash(a)), nb = norm(dash(b));
    if (na !== nb) d.push(label + ": " + a + " → " + b);
  };
  cmp("Range", appW.range, bsW.ch.Range);
  cmp("A", appW.A, bsW.ch.A);
  cmp(isMelee ? "WS" : "BS", isMelee ? appW.WS : appW.BS, isMelee ? bsW.ch.WS : bsW.ch.BS);
  cmp("S", appW.S, bsW.ch.S);
  cmp("AP", appW.AP, bsW.ch.AP);
  cmp("D", appW.D, bsW.ch.D);
  // [PISTOL] e [CLOSE-QUARTERS] são idênticos na 11ª.
  const cq = x => x === "PISTOL" ? "CLOSE-QUARTERS" : x;
  const a = kwBase((appW.keywords || []).join(", ")).map(x => cq(x.replace(/\s+\d+\+?$/, "").trim()));
  const b = kwBase(bsW.ch.Keywords).map(x => cq(x.replace(/\s+\d+\+?$/, "").trim()));
  const onlyApp = a.filter(x => !b.includes(x)), onlyBs = b.filter(x => !a.includes(x));
  if (onlyApp.length || onlyBs.length) d.push("keywords: " + (a.join(", ") || "—") + " → " + (String(bsW.ch.Keywords || "—")));
  // qualificadores do BSData (ex: "LETHAL HITS: non-MONSTER/VEHICLE") — só informativo
  // Só se a app ainda não tiver o campo estruturado correspondente.
  const q = String(bsW.ch.Keywords || "").split(",").map(x => x.trim().replace(/[\[\]]/g, "")).filter(x => x.includes(":"));
  q.forEach(x => {
    const base = x.split(":")[0].trim().toUpperCase();
    const covered = (base === "LETHAL HITS" && appW.lethalHitsExceptTargets) || (base === "DEVASTATING WOUNDS" && appW.devastatingWoundsOnlyTargets);
    if (!covered) d.push("qualificador em falta na app: " + x);
  });
  return d;
}
function matchWeapon(appW, list) {
  const n = normName(appW.name);
  let hit = list.find(w => normName(w.name) === n);
  if (!hit && appW.name.includes(" - ")) { // "Kombi-rokkit - Shoota" vs "Shoota"
    const tail = normName(appW.name.split(" - ").pop());
    hit = list.find(w => normName(w.name) === tail);
  }
  return hit;
}

function compareUnit(appU, entry, idx) {
  const out = [];
  const profiles = [];
  collect(entry, idx, 0, profiles, new Set());
  const unit = profiles.find(p => p.type === "Unit");
  if (!unit) return ["(sem perfil Unit no BSData)"];
  const appStats = appU.stats || (appU.multiProfile && appU.multiProfile.find(p => p.key !== "boss_nob").stats) || {};
  ["M", "T", "SV", "W", "LD", "OC", "InvSV"].forEach(k => {
    const a = String(appStats[k] == null ? "" : appStats[k]).replace(/\s+/g, "");
    const b = statOf(unit, k);
    if (norm(a) !== norm(b)) out.push("stat " + k + ": " + (a || "—") + " → " + (b || "—"));
  });
  const uniq = (arr, type) => { const seen = {}; return arr.filter(p => p.type === type && !seen[p.name + JSON.stringify(p.ch)] && (seen[p.name + JSON.stringify(p.ch)] = 1)); };
  [["ranged_weapons", "Ranged Weapons", false], ["melee_weapons", "Melee Weapons", true]].forEach(([key, type, melee]) => {
    const bs = uniq(profiles, type);
    const used = new Set();
    (appU[key] || []).forEach(w => {
      const hit = matchWeapon(w, bs);
      if (!hit) { out.push("arma (" + (melee ? "melee" : "ranged") + ") só na app: " + w.name); return; }
      used.add(hit);
      fieldDiffs(w, hit, melee).forEach(x => out.push("arma " + w.name + " — " + x));
    });
    bs.filter(w => !used.has(w)).forEach(w => out.push("arma (" + (melee ? "melee" : "ranged") + ") só no BSData: " + w.name));
  });
  // abilities (por nome; "Core:/Faction:" da app são só agrupamentos descritivos)
  const appAbilities = (appU.abilities || []).filter(a => !/^(Core|Faction):/.test(a)).map(a => a.split(":")[0]).map(normName);
  const bsAbilities = uniq(profiles, "Abilities").map(p => p.name).filter(n => !SKIP_RE.test(n) && !/^(Leader|Support)$/i.test(n));
  bsAbilities.forEach(n => { if (!appAbilities.includes(normName(n))) out.push("ability só no BSData: " + n); });
  (appU.abilities || []).filter(a => !/^(Core|Faction):/.test(a)).forEach(a => {
    const n = normName(a.split(":")[0]);
    if (!bsAbilities.some(b => normName(b) === n)) out.push("ability só na app: " + a.split(":")[0]);
  });
  // pontos
  const pts = (entry.costs || []).find(c => c.name === "pts");
  if (pts && Number(pts.value) !== appU.points) out.push("pontos: " + appU.points + " → " + pts.value);
  return out;
}

// ------------------------------------------------------------------ main ----
function main() {
  const dir = ensureBsdata(process.argv[2]);
  const app = loadAppData();
  const lines = [
    "# Relatório bsdata-diff",
    "",
    "> O BSData é mantido pela comunidade; confirmar no Wahapedia/datasheet oficial antes de aplicar. As abilities com mecânica própria na app têm de ser revistas à mão.",
    "",
    "Gerado em " + new Date().toISOString().slice(0, 10) + " a partir de `" + dir + "`. Formato: `campo: app → BSData`. Só diferenças.",
    "",
  ];
  let total = 0;
  Object.keys(CATALOGUES).forEach(fac => {
    const cats = CATALOGUES[fac].map(f => loadCatalogue(dir, f));
    const idx = buildIndex(cats);
    (app[fac] || []).forEach(u => {
      const bsName = NAME_MAP[u.name] || u.name;
      const entry = findUnitEntry(cats, bsName);
      let diffs;
      if (!entry) diffs = ["(não encontrada no BSData como \"" + bsName + "\")"];
      else diffs = compareUnit(u, entry, idx);
      const real = diffs;
      if (diffs.length) {
        lines.push("## " + u.name + " (" + fac + ")", "");
        diffs.forEach(d => lines.push("- " + d));
        lines.push("");
        total += real.length;
      }
    });
  });
  lines.push("---", "", "Total de diferenças: " + total, "");
  fs.writeFileSync(REPORT, lines.join("\n"), "utf8");
  console.log("bsdata-diff: " + total + " diferença(s) → " + path.relative(process.cwd(), REPORT));
}
main();
