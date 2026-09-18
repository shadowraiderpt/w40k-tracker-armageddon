// Consolidado de correções, 17-18 Set 2026: bugs 1, 2, 3, 4 (Alpha Warrior),
// 5-10 e 12 do documento "Consolidado de correções — sessão de testes".
// Bug 11 (Indiscriminate Detonations, Wartrakk) e a feature B (toggle
// "engaged") ficam explicitamente por fazer, tal como o próprio documento
// classificou como menor prioridade/feature separada.
const { test, setFile, assert, assertEqual, run } = require("./tiny-test");
const { loadApp, addFullUnit, weaponByName, setupCycle, addDummyTarget } = require("./helpers");

setFile("session4-fixes.test.js");

function makeSyntheticTarget(win, playerKey, groups) {
  const target = {
    id: "synthetic-" + playerKey, datasheetNames: groups.map(g => g.datasheetName),
    faction: "Space Marines", label: "Synthetic", points: 0, battleshocked: false, disrupted: false,
    groups,
  };
  win.__state.setup[playerKey].units.push(target);
  return target;
}

// --- Bug 1: Toughness/Move usam o grupo certo, não groups[0] --------------
test("Bug1: wound roll usa a MAIOR Toughness entre os grupos vivos do alvo, não a do primeiro grupo", () => {
  const win = loadApp();
  const attacker = addFullUnit(win, "playerA", "Termagants");
  makeSyntheticTarget(win, "playerB", [
    { key: "leader", label: "Weak", datasheetName: "A", stats: { T: 3, SV: "3+", W: 2 }, liveCount: 1, initialCount: 1, woundsRemainingOnCurrent: 2 },
    { key: "squad", label: "Tough", datasheetName: "B", stats: { T: 8, SV: "3+", W: 1 }, liveCount: 5, initialCount: 5, woundsRemainingOnCurrent: 1 },
  ]);
  const weaponIdx = weaponByName(win, attacker, "shooting", "Fleshborer");
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = attacker.id; c.weaponIdx = weaponIdx; c.targetId = "synthetic-playerB"; c.step = 1; c.modelsAttacking = 10;
  win.renderAttackCycle("shooting");
  c.hits = 5; c.step = 2;
  const wrap = win.renderAttackCycle("shooting");
  assert(/Precisas de 5\+ para ferir/.test(wrap.textContent), 'S5 vs T8 (maior T) devia pedir 5+, não 3+ (S5 vs T3, o groups[0] errado): "' + wrap.querySelector("h3").textContent + '"');
});

test("Bug1: Advance roll usa o MENOR Move entre os grupos vivos, não o do primeiro grupo", () => {
  const win = loadApp();
  const attacker = { id: "synthetic-move", datasheetNames: ["A", "B"], label: "Mixed", points: 0, battleshocked: false, disrupted: false,
    groups: [
      { key: "leader", label: "Fast", datasheetName: "A", stats: { M: "12\"", T: 4, SV: "3+", W: 2 }, liveCount: 1, initialCount: 1, woundsRemainingOnCurrent: 2 },
      { key: "squad", label: "Slow", datasheetName: "B", stats: { M: "6\"", T: 4, SV: "3+", W: 1 }, liveCount: 5, initialCount: 5, woundsRemainingOnCurrent: 1 },
    ] };
  win.__state.setup.playerA.units.push(attacker);
  win.__state.game.advanceRoll = { unitId: attacker.id, die: 4 };
  const wrap = win.renderMovementPhase();
  assert(/Move total: 6" \+ 4 = 10"/.test(wrap.textContent), 'devia usar o Move mais baixo (6"), não o do líder (12"): "' + (wrap.textContent.match(/Move total:[^"]*"/) || [""])[0] + '"');
});

// --- Bug 2 (K): perfis alternativos partilham "já usado" -------------------
test("Bug2: perfis alternativos da mesma arma (profileOf) bloqueiam-se mutuamente", () => {
  const win = loadApp();
  const librarian = addFullUnit(win, "playerA", "Librarian");
  const intercessors = addFullUnit(win, "playerB", "Intercessor Squad");
  const vanguard = addFullUnit(win, "playerB", "Vanguard Veteran Squad with Jump Packs");

  win.markWeaponUsed(librarian.id, win.weaponsForPhase(librarian, "shooting").find(w => w.name === "Smite - witchfire"));
  assert(win.isWeaponUsed(librarian.id, win.weaponsForPhase(librarian, "shooting").find(w => w.name === "Smite - focused witchfire")), "Smite focused devia ficar bloqueada depois de usar Smite witchfire");

  win.markWeaponUsed(intercessors.id, win.weaponsForPhase(intercessors, "shooting").find(w => w.name === "Grenade launcher - frag"));
  assert(win.isWeaponUsed(intercessors.id, win.weaponsForPhase(intercessors, "shooting").find(w => w.name === "Grenade launcher - krak")), "Grenade launcher krak devia ficar bloqueada depois de usar frag");

  win.markWeaponUsed(vanguard.id, win.weaponsForPhase(vanguard, "shooting").find(w => w.name === "Plasma pistol - standard"));
  assert(win.isWeaponUsed(vanguard.id, win.weaponsForPhase(vanguard, "shooting").find(w => w.name === "Plasma pistol - supercharge")), "Plasma pistol supercharge devia ficar bloqueada depois de usar standard");
});

// --- Bug 3: Overlapping Detonations tinha a condição invertida ------------
test("Bug3: Overlapping Detonations dá BLAST 1 contra alvos que NÃO são MONSTER/VEHICLE (não o contrário)", () => {
  const win = loadApp();
  const attacker = addFullUnit(win, "playerA", "Eradicator Squad with Heavy Bolters");
  const rawWeapon = win.weaponsForPhase(attacker, "shooting").find(w => w.name === "Heavy bolter");

  const infantryTarget = addFullUnit(win, "playerB", "Gretchin");
  assert(win.hasKeyword(win.conditionalWeaponKeywords(attacker, rawWeapon, infantryTarget), "BLAST"), "alvo INFANTRY (não MONSTER/VEHICLE) devia ganhar BLAST 1");

  const monsterTarget = addFullUnit(win, "playerB", "Neurotyrant");
  assert(!win.hasKeyword(win.conditionalWeaponKeywords(attacker, rawWeapon, monsterTarget), "BLAST"), "alvo MONSTER não devia ganhar BLAST 1");
});

// --- Bug 4: Alpha Warrior reescrito (buff a outra unidade no Command phase) --
test("Bug4: Alpha Warrior pergunta no Command phase, aplica-se à unidade escolhida e não repete a pergunta na mesma instância de fase", () => {
  const win = loadApp();
  const prime = addFullUnit(win, "playerA", "Winged Tyranid Prime");
  const gaunts = addFullUnit(win, "playerA", "Neurogaunts");
  win.__state.game.activePlayerKey = "playerA";

  let wrap = win.renderCommandPhase();
  assert(/Alpha Warrior/.test(wrap.textContent), "devia aparecer o cartão de Alpha Warrior no Command phase do dono do Prime");
  const sel = Array.from(wrap.querySelectorAll("select")).find(s => Array.from(s.options).some(o => o.textContent.includes("Não usar este Command phase")));
  assert(Array.from(sel.options).some(o => String(o.value) === String(gaunts.id)), "o dropdown devia listar os Neurogaunts como alvo possível");
  sel.value = String(gaunts.id);
  sel.onchange({ target: sel });
  assertEqual(String(win.__state.game.alphaWarriorTargetId), String(gaunts.id), "devia guardar a unidade escolhida");

  wrap = win.renderCommandPhase();
  assert(!/Alpha Warrior/.test(wrap.textContent), "não devia voltar a perguntar dentro da mesma instância de Command phase");

  const target = addDummyTarget(win, "playerB");
  const weaponIdx = weaponByName(win, gaunts, "fight", "Chitinous claws and teeth");
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = gaunts.id; c.weaponIdx = weaponIdx; c.targetId = target.id; c.step = 1; c.modelsAttacking = 1;
  const cycleWrap = win.renderAttackCycle("fight");
  assert(/Alpha Warrior ativo/.test(cycleWrap.textContent), "devia mostrar o lembrete de reroll de 1s no ciclo de ataque da unidade buffada");

  win.__state.game.round = 2;
  wrap = win.renderCommandPhase();
  assert(/Alpha Warrior/.test(wrap.textContent), "no próximo Command phase (nova ronda), a pergunta deve voltar a aparecer");
});

// --- Bug 5: Might Is Right (Warboss) ---------------------------------------
test("Bug5: Warboss tem meleeHitBonus 1 (+1 to hit em melee, permanente)", () => {
  const win = loadApp();
  const warboss = addFullUnit(win, "playerA", "Warboss");
  assertEqual(win.unitAuraBonus(warboss, "meleeHitBonus"), 1);
});

// --- Bug 6: Breakin' Heads (Bigboss) ---------------------------------------
test("Bug6: Two-handed big choppa do Bigboss tem [SUSTAINED HITS 1]", () => {
  const win = loadApp();
  const bigboss = addFullUnit(win, "playerA", "Bigboss");
  const w = win.weaponsForPhase(bigboss, "fight").find(x => x.name === "Two-handed big choppa");
  assert(win.hasKeyword(w, "SUSTAINED HITS"), "Two-handed big choppa devia ter SUSTAINED HITS");
});

// --- Bug 7: Hyper Regeneration (Psychophage) -------------------------------
test("Bug7: Hyper Regeneration oferece FNP 6+ (tipo ask) a unidades Tyranids amigas, nunca ao próprio Psychophage", () => {
  const win = loadApp();
  addFullUnit(win, "playerA", "Psychophage");
  const gauntsReal = addFullUnit(win, "playerA", "Neurogaunts");
  const gaunts = win.findInstance(gauntsReal.id);
  const fnp = win.feelNoPainFor(gaunts);
  assert(fnp && fnp.value === 6 && fnp.condition && fnp.condition.type === "ask", "Neurogaunts deviam ter uma FNP 6+ condicional (aura do Psychophage)");
});

test("Bug7: a aura de Hyper Regeneration não se aplica a unidades não-Tyranids", () => {
  const win = loadApp();
  addFullUnit(win, "playerA", "Psychophage");
  const intercessorsReal = addFullUnit(win, "playerA", "Intercessor Squad");
  const intercessors = win.findInstance(intercessorsReal.id);
  assertEqual(win.feelNoPainFor(intercessors), null, "Space Marines não têm Feel No Pain nenhuma e não deviam ganhar a aura Tyranid");
});

// --- Bug 8: Litany of Hate (Chaplain) --------------------------------------
test("Bug8: Chaplain with Jump Pack tem meleeWoundBonus 1 (+1 to wound em melee, permanente)", () => {
  const win = loadApp();
  const chaplain = addFullUnit(win, "playerA", "Chaplain with Jump Pack");
  assertEqual(win.unitAuraBonus(chaplain, "meleeWoundBonus"), 1);
});

// --- Bug 9: Waaagh! Energy (Weirdboy) --------------------------------------
test("Bug9: 'Eadbanger escala S/D com o Nº de Boyz liderados (multiProfile somado corretamente) e ganha HAZARDOUS a 10+", () => {
  const win = loadApp();
  const weirdboyDs = win.findDatasheet(win.__library, "Weirdboy");
  const boyzDs = win.findDatasheet(win.__library, "Boyz");
  win.addUnitToPlayer("playerA", boyzDs, { leaderDs: weirdboyDs }); // default: 1 boss_nob + 9 boyz = 10
  const attacker = win.__state.setup.playerA.units[0];
  const rawWeapon = win.weaponsForPhase(attacker, "shooting").find(w => w.name === "'Eadbanger");
  const scaled = win.conditionalWeaponKeywords(attacker, rawWeapon, addDummyTarget(win, "playerB"));
  assertEqual(scaled.S, 8, "10 modelos (2 steps de 5) devia dar S base 6 + 2 = 8");
  assertEqual(scaled.D, 3, "10 modelos devia dar D base 1 + 2 = 3");
  assert(win.hasKeyword(scaled, "HAZARDOUS"), "com 10+ modelos a arma devia ganhar HAZARDOUS");
});

test("Bug9: com menos de 5 Boyz liderados, a 'Eadbanger não escala nem ganha HAZARDOUS", () => {
  const win = loadApp();
  const weirdboyDs = win.findDatasheet(win.__library, "Weirdboy");
  const boyzDs = win.findDatasheet(win.__library, "Boyz");
  win.addUnitToPlayer("playerA", boyzDs, { leaderDs: weirdboyDs, count: 4 });
  const attacker = win.__state.setup.playerA.units[0];
  const rawWeapon = win.weaponsForPhase(attacker, "shooting").find(w => w.name === "'Eadbanger");
  const scaled = win.conditionalWeaponKeywords(attacker, rawWeapon, addDummyTarget(win, "playerB"));
  assertEqual(scaled.S, 6, "abaixo de 5 modelos não devia haver bónus nenhum");
  assert(!win.hasKeyword(scaled, "HAZARDOUS"), "abaixo de 10 modelos não devia ganhar HAZARDOUS");
});

// --- Bug 10: Hold Still and Say Aargh (Painboy) ----------------------------
test("Bug10: crítico com 'Urty syringe contra alvo não-VEHICLE aplica D6 mortal wounds extra", () => {
  const win = loadApp();
  const attacker = addFullUnit(win, "playerA", "Painboy");
  const target = addFullUnit(win, "playerB", "Gretchin");
  const liveBefore = target.groups[0].liveCount;
  const weaponIdx = weaponByName(win, attacker, "fight", "'Urty syringe");
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = attacker.id; c.weaponIdx = weaponIdx; c.targetId = target.id;
  c.step = 5; c.hits = 1; c.wounds = 1; c.deadByGroup = {};
  let wrap = win.renderAttackCycle("fight");
  assert(/6 não modificado/.test(wrap.textContent), "devia perguntar quantos wounds foram críticos");
  c.critMwCritCount = 1;
  wrap = win.renderAttackCycle("fight");
  c.critMwRoll = 4;
  const btn = Array.from(wrap.querySelectorAll("button")).find(b => b.textContent.includes("Confirmar mortal wounds"));
  btn.click();
  assertEqual(win.findRealUnit(target.id).groups[0].liveCount, liveBefore - 4, "devia aplicar 4 mortal wounds extra ao alvo");
});

test("Bug10: contra VEHICLE, não pergunta nada de Hold Still and Say Aargh", () => {
  const win = loadApp();
  const attacker = addFullUnit(win, "playerA", "Painboy");
  const target = addFullUnit(win, "playerB", "Land Speeder");
  const weaponIdx = weaponByName(win, attacker, "fight", "'Urty syringe");
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = attacker.id; c.weaponIdx = weaponIdx; c.targetId = target.id;
  c.step = 5; c.hits = 1; c.wounds = 1; c.deadByGroup = {};
  const wrap = win.renderAttackCycle("fight");
  assert(!/6 não modificado/.test(wrap.textContent), "VEHICLE está excluído, não devia perguntar nada");
});

// --- Bug 12: maxModels — nem toda arma está disponível para o grupo todo --
test("Bug12: Grenade launcher e Chainsword do Intercessor Squad estão limitadas a 1 modelo (sargento)", () => {
  const win = loadApp();
  const attacker = addFullUnit(win, "playerA", "Intercessor Squad");
  const gl = win.weaponsForPhase(attacker, "shooting").find(w => w.name === "Grenade launcher - frag");
  const cs = win.weaponsForPhase(attacker, "fight").find(w => w.name === "Chainsword");
  assertEqual(win.maxModelsAttacking(attacker, gl), 1);
  assertEqual(win.maxModelsAttacking(attacker, cs), 1);
});

test("Bug12: Vanguard Veteran Squad — Heavy bolt pistol até 4 modelos, Plasma pistol só 1", () => {
  const win = loadApp();
  const attacker = addFullUnit(win, "playerA", "Vanguard Veteran Squad with Jump Packs");
  const hbp = win.weaponsForPhase(attacker, "shooting").find(w => w.name === "Heavy bolt pistol");
  const pp = win.weaponsForPhase(attacker, "shooting").find(w => w.name === "Plasma pistol - standard");
  assertEqual(win.maxModelsAttacking(attacker, hbp), 4);
  assertEqual(win.maxModelsAttacking(attacker, pp), 1);
});

run();
