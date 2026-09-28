// Uso (dentro de demo/tests/): node fuzz-attack-cycle.js <semente> [prefixo_da_unidade]
// Demora 2-4 min. NÃO faz parte do npm test. Resultado em fuzz_issues_<semente>.txt
// Fuzz end-to-end do ciclo de ataque: conduz a UI real (jsdom) com inputs
// aleatórios, para todas as armas × vários alvos, e regista exceções,
// texto "NaN/undefined/[object", passos que encravam e estados impossíveis.
const { loadApp } = require("./load-app");
const seedArg = parseInt(process.argv[2] || "1", 10);
let seed = seedArg;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function ri(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }

const TARGETS = ["Termagants", "Intercessor Squad", "Psychophage", "Land Speeder", "Boyz", "Neurotyrant", "Warboss"];
const probe = loadApp();
const R = probe.__RAW_UNITS;
const combos = [];
for (const fk of Object.keys(R)) for (const ds of R[fk]) {
  for (const w of (ds.ranged_weapons || [])) combos.push([ds.name, "shooting", w.name]);
  for (const w of (ds.melee_weapons || [])) combos.push([ds.name, "fight", w.name]);
}
const issues = [];
let runs = 0, finished = 0;
function note(kind, ctx, msg) { issues.push(kind + " | " + ctx + " | " + msg); }

const only = process.argv[3];
let win = null, errs = [], winFor = null;
for (const [aName, phase, wName] of combos) {
  if (only && !aName.startsWith(only)) continue;
  if (winFor !== aName) { win = loadApp(); win.render = () => {}; winFor = aName; errs = []; win.addEventListener("error", e => errs.push(String(e.message || e.error))); }
  for (const tName of TARGETS) {
    if (tName === aName) continue;
    win.__state.setup.playerA.units = []; win.__state.setup.playerB.units = [];
    errs.length = 0;
    const ctx = aName + " [" + wName + "] -> " + tName;
    let attacker, target;
    try {
      win.addUnitToPlayer("playerA", win.findDatasheet(win.__library, aName), {});
      win.addUnitToPlayer("playerB", win.findDatasheet(win.__library, tName), {});
      attacker = win.__state.setup.playerA.units.slice(-1)[0];
      target = win.__state.setup.playerB.units.slice(-1)[0];
    } catch (e) { note("SETUP", ctx, e.message); continue; }
    const weapons = win.weaponsForPhase(attacker, phase);
    const wi = weapons.findIndex(w => w.name === wName);
    if (wi < 0) { note("NOWEAPON", ctx, "arma não aparece em weaponsForPhase"); continue; }
    win.__state.cycle = win.__emptyCycle();
    const c = win.__state.cycle;
    c.attackerId = attacker.id; c.weaponIdx = wi; c.targetId = target.id; c.step = 1;
    runs++;
    let lastSig = "", stuck = 0, done = false;
    let c2 = c;
    for (let it = 0; it < 60; it++) {
      if (win.__state.cycle !== c2) break; // outro ciclo começou (fight-back) — este terminou
      let wrap;
      try { wrap = win.renderAttackCycle(phase); }
      catch (e) { note("EXC", ctx, "render step " + c.step + ": " + e.message + " @@ " + (e.stack||"").split("\n").slice(1,3).join(" ") + " @@ " + JSON.stringify({hits:c.hits,w:c.wounds,crit:c.critWounds,fs:c.failedSaves,dbg:c.deadByGroup,md:c.manualDamage,fnp:c.fnpSuccesses,dd:c.deadlyDemiseAsked})); break; }
      const txt = wrap.textContent;
      const bad = txt.match(/NaN|undefined|\[object|Infinity/);
      if (bad) note("TEXT", ctx, "step " + c.step + ": '" + bad[0] + "' em: ..." + txt.slice(Math.max(0, bad.index - 80), bad.index + 40).replace(/\s+/g, " ") + "...");
      // passo seguinte
      const sel = [...wrap.querySelectorAll("select")].find(s => s.value === "" && s.options.length > 1);
      try {
        if (sel) {
          sel.value = sel.options[ri(1, sel.options.length - 1)].value;
          sel.dispatchEvent(new win.Event("change"));
        } else {
          const inp = [...wrap.querySelectorAll("input[type=number]")].pop();
          const btns = [...wrap.querySelectorAll("button.primary")];
          if (!btns.length || c.step >= 5) { done = true; break; }
          if (inp) {
            const max = inp.max !== "" ? Number(inp.max) : 6;
            const min = inp.min !== "" ? Number(inp.min) : 0;
            const r0 = rnd(); inp.value = String(r0 < 0.2 ? min : (r0 < 0.35 ? Math.max(min, max) : ri(min, Math.max(min, max))));
            inp.dispatchEvent(new win.Event("input"));
          }
          btns[btns.length - 1].dispatchEvent(new win.MouseEvent("click"));
        }
      } catch (e) { note("EXC", ctx, "ação step " + c.step + ": " + e.message); break; }
      const sig = c.step + "|" + txt.length + "|" + JSON.stringify([c.hits, c.wounds, c.failedSaves, c.deadByGroup, c.fnpSuccesses]);
      if (sig === lastSig) { if (++stuck > 3) { note("STUCK", ctx, "encravado no step " + c.step + ": " + txt.slice(0, 160).replace(/\s+/g, " ")); break; } } else stuck = 0;
      lastSig = sig;
    }
    errs.forEach(e => note("WINERR", ctx, e));
    // invariantes
    if (c.hits != null && c.wounds != null && c.wounds > c.hits + (c.sustainedHits || 0) * 3 + 50) note("INV", ctx, "wounds>hits");
    if (c.deadByGroup) for (const g of target.groups) {
      const d = c.deadByGroup[g.key] || 0;
      if (d < 0) note("INV", ctx, "mortes negativas em " + g.key);
      if (d > g.initialCount) note("INV", ctx, "mortes " + d + " > modelos " + g.initialCount + " em " + g.key);
    }
    for (const g of target.groups) if (g.liveCount < 0 || g.liveCount > g.initialCount) note("INV", ctx, "liveCount fora de limites " + g.liveCount);
    if (c.step >= 5) finished++;
    // ORÁCULO: dano fixo, sem FNP, sem melta/manual — mortes esperadas pela
    // alocação sequencial das instâncias (cada save falhado = D, excesso perde-se)
    try {
      const weapon = weapons[wi];
      const fnp = win.feelNoPainFor(target);
      if (c.step >= 5 && typeof weapon.D === "number" && c.failedSaves != null && !c.manualDamage && !fnp && !win.hasKeyword(weapon, "MELTA") && c.deadByGroup && !c.critMwRoll) {
        const order = (c.allocOrder && c.allocOrder.length) ? c.allocOrder : target.groups.map(g => g.key);
        const inst = [].concat(...(c.critInstances ? [c.critInstances] : []), Array(c.failedSaves).fill(weapon.D));
        const exp = {}; let i = 0;
        for (const key of order) {
          const g = target.groups.find(x => x.key === key); let live = g.liveCount, wl = g.woundsRemainingOnCurrent != null ? g.woundsRemainingOnCurrent : g.stats.W, dead = 0;
          while (i < inst.length && live > 0) { const d = inst[i++]; if (d >= wl) { live--; dead++; wl = g.stats.W; } else wl -= d; }
          exp[key] = dead;
        }
        for (const key of order) if ((exp[key] || 0) !== (c.deadByGroup[key] || 0)) note("ORACLE", ctx, "mortes " + key + ": app=" + c.deadByGroup[key] + " esperado=" + exp[key] + " fs=" + c.failedSaves + " crit=" + JSON.stringify(c.critInstances));
      }
    } catch (e) { note("ORACLE-EXC", ctx, e.message); }
  }
}
const uniq = [...new Set(issues)];
console.log("runs=" + runs + " chegaram ao resultado=" + finished + " issues=" + uniq.length);
const byKind = {};
uniq.forEach(i => { const k = i.split(" | ")[0]; byKind[k] = (byKind[k] || 0) + 1; });
console.log(JSON.stringify(byKind));
require("fs").writeFileSync(require("path").join(__dirname, "fuzz_issues_" + seedArg + ".txt"), uniq.join("\n"));
