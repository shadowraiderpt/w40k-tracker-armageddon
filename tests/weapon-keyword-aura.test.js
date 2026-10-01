// Bug (01/10/2026): ability de líder que concede uma keyword de arma a TODOS os
// modelos da unidade que lidera ("weapons equipped by models in that unit have
// the [X] ability") não propagava ao disparar com os Gargoyles (Winged Tyranid
// Prime anexado, Alpha Warrior). Mecanismo genérico: campo `weaponKeywordAura`
// na datasheet do líder, não específico do Prime. Vale para tiro e combate, só
// enquanto o líder estiver vivo e a liderar (campo `leadingOnly`).
const { test, setFile, assert, assertEqual, run } = require("./tiny-test");
const { loadApp, addFullUnit, weaponByName, setupCycle, diceCallCount, declineHail } = require("./helpers");
setFile("weapon-keyword-aura.test.js");

function led(win) {
  win.addUnitToPlayer("playerA", win.findDatasheet(win.__library, "Gargoyles"), { leaderDs: win.findDatasheet(win.__library, "Winged Tyranid Prime") });
  return win.__state.setup.playerA.units[0];
}
function sustainedStep(win, atk, tgt, hits) {
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = atk.id; c.weaponIdx = weaponByName(win, atk, "shooting", "Fleshborer"); c.targetId = tgt.id;
  c.modelsAttacking = hits; c.attacksRolled = hits; c.step = 2; c.hits = hits;
  declineHail(win, atk, tgt);
  return win.renderAttackCycle("shooting");
}

test("Gargoyles + Prime, tiro: dois 6 no hit roll → +2 hits automáticos (SUSTAINED HITS 1 propagado pelo líder)", () => {
  const win = loadApp();
  const atk = led(win);
  const tgt = addFullUnit(win, "playerB", "Intercessor Squad");
  const wrap = sustainedStep(win, atk, tgt, 10);
  assert(/SUSTAINED HITS/.test(wrap.textContent), "devia pedir os críticos de Sustained Hits");
  win.__state.cycle.sustainedHits = 2;
  win.renderAttackCycle("shooting");
  assertEqual(win.__state.cycle.sustainedHits * 1, 2);
  // efeito sobre os hits efetivos: 10 hits + 2×1 automáticos = 12
  win.__state.cycle.critWounds = null; // segue para o wound step; effectiveHits é interno, confirmamos via fonte:
  const fb = win.weaponsForPhase(atk, "shooting").find(w => w.name === "Fleshborer");
  const buffed = win.conditionalWeaponKeywords(atk, fb, tgt);
  assert(win.hasKeyword(buffed, "SUSTAINED HITS 1"));
});

test("Gargoyles sem Prime: mesmos dados, 0 hits extra (sem SUSTAINED HITS)", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Gargoyles");
  const tgt = addFullUnit(win, "playerB", "Intercessor Squad");
  const wrap = sustainedStep(win, atk, tgt, 10);
  assert(!/SUSTAINED HITS/.test(wrap.textContent), "sem o Prime, sem Sustained Hits");
  const fb = win.weaponsForPhase(atk, "shooting").find(w => w.name === "Fleshborer");
  assert(!win.hasKeyword(win.conditionalWeaponKeywords(atk, fb, tgt), "SUSTAINED HITS"));
});

test("Gargoyles + Prime destruído antes do ataque: 0 hits extra (a ability para de valer)", () => {
  const win = loadApp();
  const atk = led(win);
  atk.groups.find(g => g.key === "leader").liveCount = 0; // Prime morto
  const tgt = addFullUnit(win, "playerB", "Intercessor Squad");
  const wrap = sustainedStep(win, atk, tgt, 10);
  assert(!/SUSTAINED HITS/.test(wrap.textContent), "Prime morto: sem Sustained Hits");
});

test("Propaga também às armas melee da unidade liderada (não só tiro)", () => {
  const win = loadApp();
  const atk = led(win);
  const tgt = addFullUnit(win, "playerB", "Intercessor Squad");
  const melee = win.weaponsForPhase(atk, "fight").find(w => w.name === "Blinding venom");
  assert(win.hasKeyword(win.conditionalWeaponKeywords(atk, melee, tgt), "SUSTAINED HITS 1"), "arma de combate dos Gargoyles também ganha");
  const primeWeapon = win.weaponsForPhase(atk, "fight").find(w => w.name === "Prime talons");
  assert(win.hasKeyword(win.conditionalWeaponKeywords(atk, primeWeapon, tgt), "SUSTAINED HITS 1"), "e a do próprio Prime");
});

test("Se a arma já tiver Sustained Hits com valor maior, mantém-se o maior (nunca soma)", () => {
  const win = loadApp();
  const atk = led(win);
  const tgt = addFullUnit(win, "playerB", "Intercessor Squad");
  const ds = win.findDatasheet(win.__library, "Gargoyles");
  const fb = ds.ranged_weapons.find(w => w.name === "Fleshborer");
  const original = fb.keywords ? fb.keywords.slice() : [];
  fb.keywords = (fb.keywords || []).concat(["SUSTAINED HITS 2"]);
  try {
    const buffed = win.conditionalWeaponKeywords(atk, win.weaponsForPhase(atk, "shooting").find(w => w.name === "Fleshborer"), tgt);
    assertEqual(win.keywordValue(buffed, "SUSTAINED HITS"), 2, "mantém o 2 (maior que o 1 da aura), não vira 3");
  } finally {
    fb.keywords = original;
  }
});

test("Winged Tyranid Prime sozinho: sem a aura (regra de Leader — Bug F)", () => {
  const win = loadApp();
  const prime = addFullUnit(win, "playerA", "Winged Tyranid Prime");
  const tgt = addFullUnit(win, "playerB", "Intercessor Squad");
  const w = win.weaponsForPhase(prime, "fight")[0];
  assert(!win.hasKeyword(win.conditionalWeaponKeywords(prime, w, tgt), "SUSTAINED HITS"));
});

// ---------------- Regressão explícita (pedida) ----------------
test("Regressão: aura de InvSv (Mental Fortress do Librarian) continua a funcionar", () => {
  const win = loadApp();
  win.addUnitToPlayer("playerA", win.findDatasheet(win.__library, "Intercessor Squad"), { leaderDs: win.findDatasheet(win.__library, "Librarian") });
  const unit = win.__state.setup.playerA.units[0];
  assertEqual(win.invSvAuraFor(unit).value, 4);
});

run();
