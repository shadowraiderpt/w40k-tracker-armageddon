// Devastating Wounds: core_rules_reference.md diz explicitamente "máx. 1
// modelo morto por critical wound" — confirma que resolveGroupDamage já
// respeita isto (excesso de UMA instância nunca passa para a próxima nem
// para o modelo seguinte).
const { test, setFile, assert, assertEqual, run } = require("./tiny-test");
const { loadApp, addFullUnit, weaponByName, addDummyTarget } = require("./helpers");
setFile("devastating-wounds.test.js");

// Teste direto à função pura, com o cenário exato pedido: Damage 3 (fixo),
// alvo com W1, 3 modelos, 2 criticals → 2 mortos, não 3+ (o excesso de
// cada instância de 3 dano contra um modelo de 1 wound não passa ao
// próximo modelo).
test("resolveGroupDamage: 2 instâncias de Damage 3 contra 3 modelos de W1 matam exatamente 2, não 3+", () => {
  const win = loadApp();
  const group = { stats: { W: 1 }, liveCount: 3, woundsRemainingOnCurrent: 1 };
  const result = win.resolveGroupDamage(group, [3, 3], []);
  assertEqual(result.dead, 2, "cada instância de 3 dano só pode matar 1 modelo de W1 — o excesso (2 de dano) perde-se");
  assertEqual(result.liveAfter, 1, "devia sobrar 1 modelo vivo dos 3");
});

// Mesmo cenário, mas através do ciclo de ataque real (Talons and
// betentacled maw do Psychophage: DEVASTATING WOUNDS, Damage fixo 2)
// contra uma unidade de W1 — 2 criticals não deviam matar mais que 2.
test("Devastating Wounds via ciclo real: Psychophage (D2 fixo) com 2 críticos contra Gretchin (W1) mata exatamente 2", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Psychophage");
  const tgt = addFullUnit(win, "playerB", "Gretchin"); // W1, 10 modelos
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = atk.id; c.weaponIdx = weaponByName(win, atk, "fight", "Talons and betentacled maw"); c.targetId = tgt.id;
  c.step = 3; c.wounds = 2;
  win.renderAttackCycle("fight");
  // marca os 2 wounds como críticos
  c.critWounds = 2;
  const critInstances = Array(2).fill(2); // weapon.D = 2, fixo
  c.critInstances = critInstances;
  c.critInstancesByGroup = win.splitInstancesByGroup ? win.splitInstancesByGroup(tgt, critInstances) : null;
  win.allocateDamage(tgt, critInstances);
  assertEqual(win.__state.cycle.deadByGroup.main, 2, "2 críticos de D2 contra W1 devia matar exatamente 2, não mais");
});

run();
