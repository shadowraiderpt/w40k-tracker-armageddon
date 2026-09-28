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

// --- Bug 4 (revisto, Pedido Mestre 28/09/2026): Alpha Warrior 11ª = enquanto
// lidera, as armas da unidade têm [SUSTAINED HITS 1] (o reroll de 1s do Command
// phase estava desatualizado e foi removido).
test("Bug4 (revisto): Alpha Warrior dá SUSTAINED HITS 1 às armas da unidade liderada pelo Winged Tyranid Prime", () => {
  const win = loadApp();
  const primeDs = win.findDatasheet(win.__library, "Winged Tyranid Prime");
  const gargDs = win.findDatasheet(win.__library, "Gargoyles");
  win.addUnitToPlayer("playerA", gargDs, { leaderDs: primeDs });
  const attacker = win.__state.setup.playerA.units[0];
  const target = addDummyTarget(win, "playerB");
  const fleshborer = win.weaponsForPhase(attacker, "shooting").find(w => w.name === "Fleshborer");
  assert(!win.hasKeyword(fleshborer, "SUSTAINED HITS"), "sem o Prime a arma base não tem SUSTAINED HITS");
  const buffed = win.conditionalWeaponKeywords(attacker, fleshborer, target);
  assert(win.hasKeyword(buffed, "SUSTAINED HITS 1"), "com o Prime a liderar, a arma devia ganhar SUSTAINED HITS 1");
  const talons = win.conditionalWeaponKeywords(attacker, win.weaponsForPhase(attacker, "fight").find(w => w.name === "Prime talons"), target);
  assert(win.hasKeyword(talons, "SUSTAINED HITS 1"), "também as armas do próprio Prime");
  // Gargoyles sem líder: sem bónus
  win.addUnitToPlayer("playerA", win.findDatasheet(win.__library, "Termagants"), {});
  const plain = win.__state.setup.playerA.units[1];
  const plainW = win.conditionalWeaponKeywords(plain, win.weaponsForPhase(plain, "shooting").find(w => w.name === "Fleshborer"), target);
  assert(!win.hasKeyword(plainW, "SUSTAINED HITS"), "sem o Prime, sem SUSTAINED HITS");
  // O cartão antigo do Command phase já não existe
  win.__state.game.activePlayerKey = "playerA";
  assert(!/Alpha Warrior/.test(win.renderCommandPhase().textContent), "o Command phase já não pergunta pelo Alpha Warrior");
});

// --- Bug 5: Might Is Right (Warboss) ---------------------------------------
test("Bug5 (revisto): Warboss já NÃO tem meleeHitBonus — Might Is Right passou a +3 A / +2 S ao carregar", () => {
  const win = loadApp();
  const warboss = addFullUnit(win, "playerA", "Warboss");
  assertEqual(win.unitAuraBonus(warboss, "meleeHitBonus"), 0);
});

// --- Bug 6 (revisto): Bigboss 11ª — sem Breakin' Heads/Two-handed big choppa ---
test("Bug6 (revisto): Bigboss tem Big Choppa [PRECISION] A5 S7 AP-2 D2 e Sumfin' to Prove (+1 hit melee da unidade)", () => {
  const win = loadApp();
  const bigboss = addFullUnit(win, "playerA", "Bigboss");
  const melee = win.weaponsForPhase(bigboss, "fight");
  assertEqual(melee.length, 1, "só a Big Choppa");
  const w = melee[0];
  assertEqual(w.name, "Big Choppa");
  assert(win.hasKeyword(w, "PRECISION") && !win.hasKeyword(w, "SUSTAINED HITS") && !win.hasKeyword(w, "CLEAVE"));
  assertEqual([w.A, w.WS, w.S, w.AP, w.D].join("/"), "5/3+/7/-2/2");
  assertEqual(win.unitAuraBonus(bigboss, "meleeHitBonus"), 1, "Sumfin' to Prove: +1 ao hit roll melee");
});

// --- Bug 7 (mecanismo fnpAura, campo injetado) ------------------------------
// Pedido 28/09: o Hyper Regeneration do Psychophage não existe na 11ª + errata,
// por isso a datasheet já não tem fnpAura. O mecanismo (aura de FNP a outras
// unidades Tyranids amigas, sempre condicional/"ask") mantém-se no código e é
// testado injetando o campo na datasheet em memória.
function injectFnpAura(win) {
  win.findDatasheet(win.__library, "Psychophage").fnpAura = { value: 6, range: 6 };
}
test("Bug7 (mecanismo, campo injetado): fnpAura oferece FNP 6+ (tipo ask) a unidades Tyranids amigas, nunca ao próprio portador", () => {
  const win = loadApp();
  injectFnpAura(win);
  const psy = addFullUnit(win, "playerA", "Psychophage");
  const gauntsReal = addFullUnit(win, "playerA", "Neurogaunts");
  const gaunts = win.findInstance(gauntsReal.id);
  const fnp = win.feelNoPainFor(gaunts);
  assert(fnp && fnp.value === 6 && fnp.condition && fnp.condition.type === "ask", "Neurogaunts deviam ter uma FNP 6+ condicional (aura)");
  // o próprio Psychophage mantém o seu FNP 5+ e não recebe a aura de si próprio
  assertEqual(win.feelNoPainFor(win.findInstance(psy.id)).value, 5);
});

test("Bug7 (mecanismo, campo injetado): a fnpAura não se aplica a unidades não-Tyranids", () => {
  const win = loadApp();
  injectFnpAura(win);
  addFullUnit(win, "playerA", "Psychophage");
  const intercessorsReal = addFullUnit(win, "playerA", "Intercessor Squad");
  const intercessors = win.findInstance(intercessorsReal.id);
  assertEqual(win.feelNoPainFor(intercessors), null, "Space Marines não têm Feel No Pain nenhuma e não deviam ganhar a aura Tyranid");
});

test("Psychophage 11ª + errata: sem Hyper Regeneration/fnpAura (Neurogaunts sem FNP); mantém FNP 5+ e Deadly Demise 1; keywords MONSTER e SMOKE", () => {
  const win = loadApp();
  const ds = win.findDatasheet(win.__library, "Psychophage");
  assert(!ds.fnpAura && !ds.abilities.join(" ").includes("Hyper Regeneration"), "sem Hyper Regeneration");
  assertEqual(ds.deadlyDemise, 1);
  assert(ds.keywords.includes("MONSTER") && ds.keywords.includes("SMOKE"), "MONSTER + SMOKE");
  assertEqual(ds.source, "Wahapedia 11ª + errata");
  const psy = addFullUnit(win, "playerA", "Psychophage");
  assertEqual(win.feelNoPainFor(win.findInstance(psy.id)).value, 5, "FNP 5+ do próprio modelo");
  const gaunts = addFullUnit(win, "playerA", "Neurogaunts");
  assertEqual(win.feelNoPainFor(win.findInstance(gaunts.id)), null, "sem aura para os outros");
});

// --- Bug 8: Litany of Hate (Chaplain) --------------------------------------
// (Bug F, regra 2: Litany of Hate é "while this model is leading a unit" — sozinho não vale.)
test("Bug8 (revisto): Litany of Hate (meleeWoundBonus 1) só vale com o Chaplain a liderar; sozinho, 0", () => {
  const win = loadApp();
  const solo = addFullUnit(win, "playerA", "Chaplain with Jump Pack");
  assertEqual(win.unitAuraBonus(solo, "meleeWoundBonus"), 0, "sozinho não lidera");
  const win2 = loadApp();
  win2.addUnitToPlayer("playerA", win2.findDatasheet(win2.__library, "Vanguard Veteran Squad with Jump Packs"), { leaderDs: win2.findDatasheet(win2.__library, "Chaplain with Jump Pack") });
  const unit = win2.__state.setup.playerA.units[0];
  assertEqual(win2.unitAuraBonus(unit, "meleeWoundBonus"), 1, "anexado: +1 ao ferir");
  unit.groups.find(g => g.key !== "leader").liveCount = 0;
  assertEqual(win2.unitAuraBonus(unit, "meleeWoundBonus"), 1, "0 Vanguard vivos: o Chaplain continua a liderar");
  unit.groups.find(g => g.key === "leader").liveCount = 0;
  assertEqual(win2.unitAuraBonus(unit, "meleeWoundBonus"), 0, "Chaplain morto: sem Litany");
});

// --- Bug 9 / 10: mecanismos mantidos no código mas sem datasheet 11ª que os use ---
// (Pedido Mestre 28/09/2026: Weirdboy já não tem 'Eadbanger/Waaagh! Energy nem o
// Painboy o Hold Still and Say Aargh — o texto novo do Waaagh! Energy está
// pendente.) Os testes injetam o campo na datasheet em memória para manter a
// cobertura do mecanismo (scalingWeaponByLedSquad, critMortalWounds).
function injectScaling(win) {
  win.findDatasheet(win.__library, "Weirdboy").scalingWeaponByLedSquad = { weapon: "Power Vomit", ledDatasheet: "Boyz", perModels: 5, sBonusPer: 1, dBonusPer: 1, hazardousAtModels: 10 };
}
test("Bug9 (mecanismo, campo injetado): escala S/D com o Nº de Boyz liderados (multiProfile somado corretamente) e ganha HAZARDOUS a 10+", () => {
  const win = loadApp();
  injectScaling(win);
  const weirdboyDs = win.findDatasheet(win.__library, "Weirdboy");
  const boyzDs = win.findDatasheet(win.__library, "Boyz");
  win.addUnitToPlayer("playerA", boyzDs, { leaderDs: weirdboyDs }); // default: 1 boss_nob + 9 boyz = 10
  const attacker = win.__state.setup.playerA.units[0];
  const rawWeapon = win.weaponsForPhase(attacker, "shooting").find(w => w.name === "Power Vomit");
  const scaled = win.conditionalWeaponKeywords(attacker, rawWeapon, addDummyTarget(win, "playerB"));
  assertEqual(scaled.S, 7, "10 modelos (2 steps de 5): S base 5 + 2");
  assertEqual(scaled.D, 4, "10 modelos: D base 2 + 2");
  assert(win.hasKeyword(scaled, "HAZARDOUS"), "com 10+ modelos a arma devia ganhar HAZARDOUS");
});

test("Bug9 (mecanismo, campo injetado): com menos de 5 Boyz liderados, não escala nem ganha HAZARDOUS extra", () => {
  const win = loadApp();
  injectScaling(win);
  const weirdboyDs = win.findDatasheet(win.__library, "Weirdboy");
  const boyzDs = win.findDatasheet(win.__library, "Boyz");
  win.addUnitToPlayer("playerA", boyzDs, { leaderDs: weirdboyDs, count: 4 });
  const attacker = win.__state.setup.playerA.units[0];
  const rawWeapon = win.weaponsForPhase(attacker, "shooting").find(w => w.name === "Power Vomit");
  const scaled = win.conditionalWeaponKeywords(attacker, rawWeapon, addDummyTarget(win, "playerB"));
  assertEqual(scaled.S, 5, "abaixo de 5 modelos não devia haver bónus nenhum");
});

test("Weirdboy 11ª: Copper Staff e Power Vomit; sem 'Eadbanger nem Waaagh! staff", () => {
  const win = loadApp();
  const wb = addFullUnit(win, "playerA", "Weirdboy");
  assertEqual(win.weaponsForPhase(wb, "shooting").map(w => w.name).join(","), "Power Vomit");
  assertEqual(win.weaponsForPhase(wb, "fight").map(w => w.name).join(","), "Copper Staff");
  const pv = win.weaponsForPhase(wb, "shooting")[0];
  ["BLAST", "HAZARDOUS", "PSYCHIC", "TORRENT"].forEach(k => assert(win.hasKeyword(pv, k), "Power Vomit devia ter " + k));
  assertEqual([pv.range, pv.A, pv.S, pv.AP, pv.D].join("/"), '12"/3/5/-3/2');
});

function injectCritMw(win) {
  win.findDatasheet(win.__library, "Painboy").melee_weapons.find(w => w.name === "'Urty syringe").critMortalWounds = { dice: "D6", excludeTargetKeyword: "VEHICLE" };
}
test("Bug10 (mecanismo, campo injetado): crítico com 'Urty syringe contra alvo não-VEHICLE aplica D6 mortal wounds extra", () => {
  const win = loadApp();
  injectCritMw(win);
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

test("Bug10 (mecanismo, campo injetado): contra VEHICLE, não pergunta nada", () => {
  const win = loadApp();
  injectCritMw(win);
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
