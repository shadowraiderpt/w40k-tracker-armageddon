// Bug 11 (Indiscriminate Detonations, Wartrakk) e Feature B (toggle "engaged").
const { test, setFile, assert, assertEqual, run } = require("./tiny-test");
const { loadApp, addFullUnit, weaponByName, addDummyTarget } = require("./helpers");
setFile("engaged-and-suppress.test.js");

function cycle(win, attacker, weaponName, target, phaseKey, extra) {
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = attacker.id; c.weaponIdx = weaponByName(win, attacker, phaseKey, weaponName); c.targetId = target.id;
  Object.assign(c, extra || {});
  return c;
}

// --- Bug 11 ---
test("Wartrakk acerta: alvo fica suprimido e leva -1 ao acertar; limpa no Command phase do dono do Wartrakk", () => {
  const win = loadApp();
  const wart = addFullUnit(win, "playerA", "Wartrakk");
  const tgt = addFullUnit(win, "playerB", "Termagants");
  const c = cycle(win, wart, "Kustom shoota", tgt, "shooting", { step: 5, hits: 2, deadByGroup: {} });
  win.renderAttackCycle("shooting");
  assertEqual(win.findRealUnit(tgt.id).suppressedBy, "playerA");

  // o alvo suprimido ataca com -1
  const bt = addFullUnit(win, "playerA", "Intercessor Squad");
  const c2 = cycle(win, tgt, "Fleshborer", bt, "shooting", { step: 1, modelsAttacking: 1 });
  let wrap = win.renderAttackCycle("shooting");
  assert(/Precisas de 5\+ para acertar/.test(wrap.textContent) && /SUPPRESSED/.test(wrap.textContent), "BS4+ com -1 = 5+");

  // turno de B (não limpa), depois volta a A (limpa)
  win.__state.game.phase = "fight"; win.__state.game.activePlayerKey = "playerA";
  win.advancePhase();
  assertEqual(win.findRealUnit(tgt.id).suppressedBy, "playerA", "no turno do próprio suprimido ainda vale");
  win.__state.game.phase = "fight";
  win.advancePhase();
  assertEqual(win.findRealUnit(tgt.id).suppressedBy, null, "no início do Command phase do dono do Wartrakk limpa");
});

test("Wartrakk sem hits não suprime", () => {
  const win = loadApp();
  const wart = addFullUnit(win, "playerA", "Wartrakk");
  const tgt = addFullUnit(win, "playerB", "Termagants");
  cycle(win, wart, "Kustom shoota", tgt, "shooting", { step: 5, hits: 0, deadByGroup: {} });
  win.renderAttackCycle("shooting");
  assert(!win.findRealUnit(tgt.id).suppressedBy);
});

// --- Feature B ---
function setEngaged(win, unit, enemy) { win.findRealUnit(unit.id).engagedWithUnitId = enemy.id; }
function weaponOptions(win, attacker, phaseKey) {
  win.__state.cycle = win.__emptyCycle();
  win.__state.cycle.attackerId = attacker.id;
  win.__state.game.activePlayerKey = "playerA";
  const wrap = win.renderPicker(win.allInstances(), phaseKey);
  const sels = Array.from(wrap.querySelectorAll("select"));
  const wsel = sels.find(s => Array.from(s.options).some(o => /\(A:/.test(o.textContent)));
  return wsel ? Array.from(wsel.options).map(o => o.textContent) : [];
}

test("Engaged (não MONSTER/VEHICLE): só armas [CLOSE-QUARTERS] e só o alvo engaged", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Intercessor Squad");
  const enemy = addFullUnit(win, "playerB", "Gretchin");
  const other = addFullUnit(win, "playerB", "Boyz");
  setEngaged(win, atk, enemy);
  const opts = weaponOptions(win, atk, "shooting").join("|");
  assert(/Bolt pistol/.test(opts), "pistola é CLOSE-QUARTERS");
  assert(!/Bolt rifle/.test(opts) && !/Grenade launcher/.test(opts), "não-CQ bloqueadas");
  const wrap = win.renderPicker(win.allInstances(), "shooting");
  const tsel = Array.from(wrap.querySelectorAll("select")).find(s => s.previousSibling && /Unidade alvo/.test(s.previousSibling.textContent));
  const targets = Array.from(tsel.options).map(o => o.textContent).filter(t => t.includes("Jogador"));
  assertEqual(targets.length, 1); assert(/Gretchin/.test(targets[0]));
});

test("Sem engaged: tudo disponível", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Intercessor Squad");
  addFullUnit(win, "playerB", "Gretchin");
  const opts = weaponOptions(win, atk, "shooting").join("|");
  assert(/Bolt rifle/.test(opts) && /Bolt pistol/.test(opts));
});

test("MONSTER/VEHICLE engaged: todas as armas, -1 ao acertar nas não-CQ, BLAST bloqueado contra o engaged", () => {
  const win = loadApp();
  const exo = addFullUnit(win, "playerA", "Exocrine");
  const enemy = addFullUnit(win, "playerB", "Gretchin");
  const far = addFullUnit(win, "playerB", "Boyz");
  setEngaged(win, exo, enemy);
  assert(/Bio-plasmic cannon/.test(weaponOptions(win, exo, "shooting").join("|")), "MONSTER mantém a arma");
  cycle(win, exo, "Bio-plasmic cannon", far, "shooting", { step: 1, modelsAttacking: 1, heavyStationary: false, attacksRolled: 3 });
  const wrap = win.renderAttackCycle("shooting");
  assert(/ENGAGED/.test(wrap.textContent) && /Precisas de 4\+ para acertar/.test(wrap.textContent), "BS3+ com -1 engaged = 4+");
  // BLAST contra o engaged: botão desativado
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = exo.id; c.weaponIdx = weaponByName(win, exo, "shooting", "Bio-plasmic cannon"); c.targetId = enemy.id;
  const pick = win.renderPicker(win.allInstances(), "shooting");
  const start = Array.from(pick.querySelectorAll("button")).find(b => /Iniciar ciclo/.test(b.textContent));
  assert(start.disabled, "BLAST contra unidade engaged tem de estar bloqueado");
});

test("Não engaged: modelo único não combina arma CQ com não-CQ na mesma fase", () => {
  const win = loadApp();
  const cap = addFullUnit(win, "playerA", "Librarian"); // Bolt pistol (CQ) + Smite (não CQ)
  addFullUnit(win, "playerB", "Gretchin");
  win.markWeaponUsed(cap.id, win.weaponsForPhase(cap, "shooting").find(w => w.name === "Bolt pistol"));
  const opts = weaponOptions(win, cap, "shooting").join("|");
  assert(!/Smite/.test(opts), "usou pistola CQ — Smite bloqueado");
});

run();
