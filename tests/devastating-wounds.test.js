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
  // marca os 2 wounds como críticos — D2 é fixo, por isso resolve-se sozinho
  // sem pedir nada (mesmo caminho de código de antes desta correção).
  c.critWounds = 2;
  win.renderAttackCycle("fight");
  assertEqual(win.__state.cycle.deadByGroup.main, 2, "2 críticos de D2 contra W1 devia matar exatamente 2, não mais");
});

// --- Bug corrigido: Devastating Wounds com Damage VARIÁVEL ------------------
// Antes, Array(n).fill(weapon.D) enchia o array com a STRING da notação
// ("D3") em vez de pedir o valor rolado — a comparação numérica em
// resolveGroupDamage falhava sempre e nenhum modelo morria. Agora cada
// critical wound pede o seu próprio dado, tal como já acontecia para saves
// falhados normais com Damage variável.
function toCritDamageStep(win, attacker, weaponName, target, phaseKey, wounds, critWounds) {
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = attacker.id; c.weaponIdx = weaponByName(win, attacker, phaseKey, weaponName); c.targetId = target.id;
  c.step = 3; c.wounds = wounds;
  win.renderAttackCycle(phaseKey);
  c.critWounds = critWounds;
  return win.renderAttackCycle(phaseKey);
}

test("Smite - focused witchfire (D3 variável): pede o dano de CADA crítico, nunca a string da notação", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Librarian");
  const tgt = addFullUnit(win, "playerB", "Gretchin"); // W1
  const wrap = toCritDamageStep(win, atk, "Smite - focused witchfire", tgt, "shooting", 2, 2);
  assert(/critical wound/.test(wrap.textContent), 'devia pedir o dano de cada "critical wound", não "save falhado": ' + wrap.textContent.slice(0, 300));
  assert(!/save falhado/i.test(wrap.textContent), "não há save nenhum envolvido em Devastating Wounds — o texto não pode falar em save falhado");
});

test("Smite - focused witchfire: 2 críticos (D3) contra Gretchin (W1, 10 modelos) — qualquer valor ≥1 mata exatamente 1 por crítico", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Librarian");
  const tgt = addFullUnit(win, "playerB", "Gretchin");
  const wrap = toCritDamageStep(win, atk, "Smite - focused witchfire", tgt, "shooting", 2, 2);
  const inputs = Array.from(wrap.querySelectorAll("input[type=number]"));
  assertEqual(inputs.length, 2, "devia pedir 2 valores, um por crítico");
  inputs[0].value = "2"; inputs[0].oninput({ target: inputs[0] });
  inputs[1].value = "3"; inputs[1].oninput({ target: inputs[1] });
  Array.from(wrap.querySelectorAll("button")).find(b => /Confirmar dano dos críticos/.test(b.textContent)).click();
  assertEqual(win.__state.cycle.deadByGroup.main, 2, "2 críticos, cada um ≥1 contra W1, devia matar exatamente 2");
});

test("Smite - focused witchfire: 2 críticos (D3) contra alvo multi-wound (Land Speeder, W9) — dano acumula-se no MESMO modelo, não passa para outro", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Librarian");
  const tgt = addFullUnit(win, "playerB", "Land Speeder"); // W9, 1 modelo
  const wrap = toCritDamageStep(win, atk, "Smite - focused witchfire", tgt, "shooting", 2, 2);
  const inputs = Array.from(wrap.querySelectorAll("input[type=number]"));
  inputs[0].value = "2"; inputs[0].oninput({ target: inputs[0] }); // 2 de 9
  inputs[1].value = "3"; inputs[1].oninput({ target: inputs[1] }); // +3 = 5 de 9, ainda vivo
  Array.from(wrap.querySelectorAll("button")).find(b => /Confirmar dano dos críticos/.test(b.textContent)).click();
  assertEqual(win.__state.cycle.deadByGroup.main, 0, "2+3=5 de 9 wounds não é suficiente para matar o Land Speeder");
  assertEqual(win.__state.cycle.woundsLeftByGroup.main, 4, "devia sobrar 9-5=4 wounds no modelo");
});

run();
