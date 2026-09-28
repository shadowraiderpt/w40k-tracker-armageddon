// Warboss (Might Is Right, Boss' Ammo Runt, Lethal Hits non-MONSTER/VEHICLE)
// e Eradicator Squad (Total Obliteration, Multi-melta 1 por cada 3 modelos).
const { test, setFile, assert, assertEqual, run } = require("./tiny-test");
const { loadApp, addFullUnit, weaponByName, setupCycle, diceCallCount, addDummyTarget } = require("./helpers");
setFile("warboss-eradicator.test.js");

function weaponOf(win, unit, phase, name) { return win.weaponsForPhase(unit, phase).find(w => w.name === name); }
function bigNumber(wrap) { return wrap.querySelector(".threshold-number").textContent; }

// ---------- Eradicator Squad ----------
test("Eradicators vs Psychophage (MONSTER): mostra o lembrete de Total Obliteration", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Eradicator Squad with Heavy Bolters");
  const tgt = addFullUnit(win, "playerB", "Psychophage");
  const wrap = setupCycle(win, { attacker: atk, weaponIdx: weaponByName(win, atk, "shooting", "Melta rifle"), target: tgt, phaseKey: "shooting", modelsAttacking: 3 });
  assert(/Total Obliteration — podes re-rolar hit, wound e Damage\./.test(wrap.textContent), "lembrete devia aparecer contra MONSTER");
});

test("Eradicators vs Termagants (não M/V): o lembrete NÃO aparece", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Eradicator Squad with Heavy Bolters");
  const tgt = addFullUnit(win, "playerB", "Termagants");
  const wrap = setupCycle(win, { attacker: atk, weaponIdx: weaponByName(win, atk, "shooting", "Melta rifle"), target: tgt, phaseKey: "shooting", modelsAttacking: 3 });
  assert(!/Total Obliteration —/.test(wrap.textContent), "lembrete não devia aparecer contra Termagants");
});

test("Eradicators vs Land Speeder (VEHICLE): lembrete aparece também", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Eradicator Squad with Heavy Bolters");
  const tgt = addFullUnit(win, "playerB", "Land Speeder");
  const wrap = setupCycle(win, { attacker: atk, weaponIdx: weaponByName(win, atk, "shooting", "Bolt pistol"), target: tgt, phaseKey: "shooting", modelsAttacking: 3 });
  assert(/Total Obliteration —/.test(wrap.textContent));
});

test("Eradicators: dados 11e (sem heavy bolter nem Overlapping Detonations)", () => {
  const win = loadApp();
  const d = win.findDatasheet(win.__library, "Eradicator Squad with Heavy Bolters");
  const atk = addFullUnit(win, "playerA", "Eradicator Squad with Heavy Bolters");
  const shoot = win.weaponsForPhase(atk, "shooting").map(w => w.name);
  assertEqual(shoot.join(","), "Bolt pistol,Melta rifle,Multi-melta");
  const mr = weaponOf(win, atk, "shooting", "Melta rifle");
  assertEqual([mr.S, mr.AP, mr.D, mr.BS].join("/"), "9/-4/6/3+");
  assert(win.hasKeyword(mr, "MELTA 2") && win.hasKeyword(mr, "HEAVY"));
  assertEqual(atk.groups[0].stats.T, 6);
  assertEqual(JSON.stringify(d.pointsBySize), '{"3":90,"6":180}');
});

test("Multi-melta: 1 por cada 3 modelos (3 modelos → 1 pode disparar, 6 → 2)", () => {
  const win = loadApp();
  const atk3 = addFullUnit(win, "playerA", "Eradicator Squad with Heavy Bolters");
  assertEqual(win.maxModelsAttacking(atk3, weaponOf(win, atk3, "shooting", "Multi-melta")), 1);
  assertEqual(win.maxModelsAttacking(atk3, weaponOf(win, atk3, "shooting", "Melta rifle")), 3);
  const win2 = loadApp();
  const atk6 = addFullUnit(win2, "playerA", "Eradicator Squad with Heavy Bolters", { count: 6 });
  assertEqual(win2.maxModelsAttacking(atk6, weaponOf(win2, atk6, "shooting", "Multi-melta")), 2);
});

// ---------- Warboss: Might Is Right ----------
function fightCycle(win, wb, weaponName, tgt, charged) {
  return setupCycle(win, { attacker: wb, weaponIdx: weaponByName(win, wb, "fight", weaponName), target: tgt, phaseKey: "fight", modelsAttacking: 1, chargedThisTurn: charged });
}

test("Might Is Right: com charge, Kustom choppa faz A6+3=9 e S7+2=9; sem charge A6/S7", () => {
  const win = loadApp();
  const wb = addFullUnit(win, "playerA", "Warboss");
  const tgt = addDummyTarget(win, "playerB");
  assertEqual(diceCallCount(fightCycle(win, wb, "Kustom choppa", tgt, true)), 9);
  assertEqual(diceCallCount(fightCycle(win, wb, "Kustom choppa", tgt, false)), 6);
  const raw = weaponOf(win, wb, "fight", "Kustom choppa");
  win.__state.cycle.chargedThisTurn = true;
  const w1 = win.chargeBonusWeapon(raw, win.__state.cycle, "fight");
  assertEqual(w1.A + "/" + w1.S, "9/9");
  const klaw = win.chargeBonusWeapon(weaponOf(win, wb, "fight", "Power klaw"), win.__state.cycle, "fight");
  assertEqual(klaw.A + "/" + klaw.S, "9/14");
  win.__state.cycle.chargedThisTurn = false;
  const w0 = win.chargeBonusWeapon(raw, win.__state.cycle, "fight");
  assertEqual(w0.A + "/" + w0.S, "6/7");
});

test("Might Is Right: pergunta se fez charge move antes dos hits e não dá +1 ao acertar", () => {
  const win = loadApp();
  const wb = addFullUnit(win, "playerA", "Warboss");
  const tgt = addDummyTarget(win, "playerB");
  const wrap = fightCycle(win, wb, "Kustom choppa", tgt, undefined);
  assert(/fez charge move este turno/.test(wrap.textContent), "devia perguntar pelo charge");
  const wrap2 = fightCycle(win, wb, "Kustom choppa", tgt, true);
  assertEqual(bigNumber(wrap2), "2+", "WS2+ sem bónus a acertar (o +1 antigo foi removido)");
});

test("Might Is Right só afeta armas do Warboss: Boyz liderados não ganham A/S", () => {
  const win = loadApp();
  const boyzDs = win.findDatasheet(win.__library, "Boyz");
  const wbDs = win.findDatasheet(win.__library, "Warboss");
  win.addUnitToPlayer("playerA", boyzDs, { leaderDs: wbDs });
  const unit = win.__state.setup.playerA.units[0];
  win.__state.cycle = win.__emptyCycle();
  win.__state.cycle.chargedThisTurn = true;
  const weapons = win.weaponsForPhase(unit, "fight");
  const boyzWeapon = weapons.find(w => w.sourceDatasheet === "Boyz");
  assert(boyzWeapon, "devia haver uma arma de melee dos Boyz");
  const out = win.chargeBonusWeapon(boyzWeapon, win.__state.cycle, "fight");
  assertEqual(out.A, boyzWeapon.A);
  assertEqual(out.S, boyzWeapon.S);
});

// ---------- Warboss: Boss' Ammo Runt ----------
function shootCycle(win, wb, weaponName, tgt) {
  return setupCycle(win, { attacker: wb, weaponIdx: weaponByName(win, wb, "shooting", weaponName), target: tgt, phaseKey: "shooting", modelsAttacking: 1, heavyStationary: false });
}

test("Boss' Ammo Runt: pergunta ao disparar; Sim dá +1 (BS5+ → 4+), gasta o uso e não volta a perguntar", () => {
  const win = loadApp();
  const wb = addFullUnit(win, "playerA", "Warboss");
  const tgt = addDummyTarget(win, "playerB");
  const wrap = shootCycle(win, wb, "Kustom shoota", tgt);
  assert(/Ammo Runt/.test(wrap.textContent), "devia perguntar");
  const sel = wrap.querySelector("select");
  sel.value = "yes"; sel.onchange({ target: sel });
  const wrap2 = win.renderAttackCycle("shooting");
  assertEqual(bigNumber(wrap2), "4+", "BS5+ com Ammo Runt → 4+");
  assert(/AMMO RUNT/.test(wrap2.textContent), "chip visível");
  // nova ativação: uso da batalha já gasto — não pergunta nem dá bónus
  win.__state.game.ammoRuntChoice = {};
  const wrap3 = win.renderAttackCycle("shooting");
  assert(!/Usar Boss' Ammo Runt/.test(wrap3.textContent), "depois de usado não volta a perguntar");
  assertEqual(bigNumber(wrap3), "5+");
});

test("Boss' Ammo Runt: Não usar não gasta o uso e não dá bónus", () => {
  const win = loadApp();
  const wb = addFullUnit(win, "playerA", "Warboss");
  const tgt = addDummyTarget(win, "playerB");
  const wrap = shootCycle(win, wb, "Kustom shoota", tgt);
  const sel = wrap.querySelector("select");
  sel.value = "no"; sel.onchange({ target: sel });
  assertEqual(bigNumber(win.renderAttackCycle("shooting")), "5+");
  const wbDs = win.findDatasheet(win.__library, "Warboss");
  assert(!win.isOnceAbilityUsed(win.onceAbilityKey(wb, wbDs, 0), wbDs.onceAbilities[0]));
});

test("Boss' Ammo Runt entra na soma ±1 (com ajuste manual +1 continua a ser só +1)", () => {
  const win = loadApp();
  const wb = addFullUnit(win, "playerA", "Warboss");
  const tgt = addDummyTarget(win, "playerB");
  const wrap = shootCycle(win, wb, "Kustom shoota", tgt);
  const sel = wrap.querySelector("select");
  sel.value = "yes"; sel.onchange({ target: sel });
  win.__state.cycle.hitAdjust = 1;
  const wrap2 = win.renderAttackCycle("shooting");
  assertEqual(bigNumber(wrap2), "4+", "Ammo Runt +1 e manual +1 somam +2 mas o limite ±1 dá 4+");
  assert(/LIMITE ±1/.test(wrap2.textContent), "aviso de corte");
});

// ---------- Warboss: Lethal Hits só contra non-MONSTER/VEHICLE ----------
test("Kustom shoota: LETHAL HITS com exceção MONSTER/VEHICLE (representação e lógica)", () => {
  const win = loadApp();
  const wb = addFullUnit(win, "playerA", "Warboss");
  const w = weaponOf(win, wb, "shooting", "Kustom shoota");
  assert(win.hasKeyword(w, "LETHAL HITS"));
  assertEqual(JSON.stringify(w.lethalHitsExceptTargets), '["MONSTER","VEHICLE"]');
});

// Chega ao passo de hits e vê se aparece o texto do Lethal Hits (passo 2).
function lethalHintShown(win, wb, target) {
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = wb.id; c.weaponIdx = weaponByName(win, wb, "shooting", "Kustom shoota"); c.targetId = target.id;
  c.modelsAttacking = 1; c.step = 2; c.hits = 4; c.attacksRolled = 4;
  win.__state.game.ammoRuntChoice[win.phaseInstanceKey() + "-" + wb.id] = "no";
  const wrap = win.renderAttackCycle("shooting");
  return /Lethal Hits ativo/.test(wrap.textContent);
}
test("Kustom shoota: passo dos Lethal Hits aparece contra Termagants, não contra Psychophage nem Land Speeder", () => {
  const win = loadApp();
  const wb = addFullUnit(win, "playerA", "Warboss");
  assert(lethalHintShown(win, wb, addFullUnit(win, "playerB", "Termagants")), "Termagants: ativo");
  assert(!lethalHintShown(win, wb, addFullUnit(win, "playerB", "Psychophage")), "MONSTER: inativo");
  assert(!lethalHintShown(win, wb, addFullUnit(win, "playerB", "Land Speeder")), "VEHICLE: inativo");
});

test("Warboss: T6, Kombi-rokkit e Kombi-skorcha com os perfis do utilizador", () => {
  const win = loadApp();
  const wb = addFullUnit(win, "playerA", "Warboss");
  assertEqual(wb.groups[0].stats.T, 6);
  const rokkit = weaponOf(win, wb, "shooting", "Kombi-rokkit - Busta Rokkit");
  assertEqual([rokkit.A, rokkit.S, rokkit.AP, rokkit.D, rokkit.BS, rokkit.range].join("/"), '1/10/-2/3/5+/24"');
  const skorcha = weaponOf(win, wb, "shooting", "Kombi-skorcha - Skorcha");
  assert(win.hasKeyword(skorcha, "BLAST") && win.hasKeyword(skorcha, "TORRENT"));
  assertEqual([skorcha.A, skorcha.S, skorcha.range].join("/"), '3/5/12"');
  const choppa = weaponOf(win, wb, "fight", "Kustom choppa");
  assertEqual(choppa.S, 7);
  assert(win.hasKeyword(choppa, "CLEAVE 2"));
});

run();
