// Bugs 1, 2, 3 (playtest 16-17 Set 2026): o total de dados de hit roll
// pedido ao jogador tem de escalar com attacks_por_modelo × modelos_vivos,
// e um Attacks aleatório (D6/D3) tem de ser resolvido por um roll PRÓPRIO
// (um por modelo, se a unidade tiver vários) antes de se pedir os hits —
// nunca tratado como se fosse sempre o valor máximo da notação de dados.
const { test, setFile, assertEqual, assert, run } = require("./tiny-test");
const { loadApp, addFullUnit, weaponByName, setupCycle, diceCallCount, stepTitle, addDummyTarget } = require("./helpers");

setFile("attack-math.test.js");

function freshTargetOnB(win) {
  return addDummyTarget(win, "playerB");
}

// --- BUG 1: Attacks fixo, unidade grande (A:1 × 10 modelos) ---------------
test("Termagants (10/10, Fleshborer A:1) pede 10 dados de hit roll", () => {
  const win = loadApp();
  // Squad ajustável (default seria 20, o máximo do BOX_LIMIT) — o jogo real
  // usou um esquadrão de 10, tal como reportado no bug.
  const attacker = addFullUnit(win, "playerA", "Termagants", { count: 10 });
  assertEqual(attacker.groups.reduce((s, g) => s + g.liveCount, 0), 10, "squad inicial devia ter 10 modelos vivos");
  const target = freshTargetOnB(win);
  const weaponIdx = weaponByName(win, attacker, "shooting", "Fleshborer");
  const wrap = setupCycle(win, { attacker, weaponIdx, target, phaseKey: "shooting", modelsAttacking: 10 });
  assertEqual(diceCallCount(wrap), 10, "10 modelos × A:1 devia pedir 10 dados");
});

// --- BUG 1: Attacks fixo >1, unidade pequena (A:3 × 3 modelos) ------------
test("Eradicator Squad (3/3, Heavy bolter A:3) pede 9 dados de hit roll", () => {
  const win = loadApp();
  const attacker = addFullUnit(win, "playerA", "Eradicator Squad with Heavy Bolters");
  assertEqual(attacker.groups.reduce((s, g) => s + g.liveCount, 0), 3, "squad inicial devia ter 3 modelos vivos");
  const target = freshTargetOnB(win);
  const weaponIdx = weaponByName(win, attacker, "shooting", "Heavy bolter");
  const wrap = setupCycle(win, { attacker, weaponIdx, target, phaseKey: "shooting", modelsAttacking: 3, heavyStationary: true });
  assertEqual(diceCallCount(wrap), 9, "3 modelos × A:3 devia pedir 9 dados (não 3)");
});

// Regressão adicional ao bug 1: reduzir modelsAttacking (ex: 2 dos 3
// Eradicators fora de alcance) tem de reduzir os dados pedidos também.
test("Eradicator Squad com só 2/3 a disparar pede 6 dados (não 9)", () => {
  const win = loadApp();
  const attacker = addFullUnit(win, "playerA", "Eradicator Squad with Heavy Bolters");
  const target = freshTargetOnB(win);
  const weaponIdx = weaponByName(win, attacker, "shooting", "Heavy bolter");
  const wrap = setupCycle(win, { attacker, weaponIdx, target, phaseKey: "shooting", modelsAttacking: 2, heavyStationary: true });
  assertEqual(diceCallCount(wrap), 6, "2 modelos × A:3 devia pedir 6 dados");
});

// --- BUG 2: Attacks aleatório, 1 modelo (A:D6) -----------------------------
// Antes de pedir os hits, a app tem de pedir um roll PRÓPRIO de 1D6 (não 6
// dados) para determinar quantos ataques a arma faz desta vez.
test("Librarian (1 modelo, Smite - witchfire A:D6) pede primeiro para rolar 1D6 de Attacks, não 6 dados de hit direto", () => {
  const win = loadApp();
  const attacker = addFullUnit(win, "playerA", "Librarian");
  const target = freshTargetOnB(win);
  const weaponIdx = weaponByName(win, attacker, "shooting", "Smite - witchfire");
  const wrap = setupCycle(win, { attacker, weaponIdx, target, phaseKey: "shooting", modelsAttacking: 1 });
  assert(/[Aa]ttacks/.test(stepTitle(wrap)), 'esperava um passo a pedir o roll de Attacks antes dos hits, apareceu: "' + stepTitle(wrap) + '"');
  assertEqual(diceCallCount(wrap), 1, "determinar Attacks de 1 modelo com A:D6 é 1 dado (não 6)");
});

test("Librarian: depois de rolar 5 no D6 de Attacks, o passo de hits pede exatamente 5 dados", () => {
  const win = loadApp();
  const attacker = addFullUnit(win, "playerA", "Librarian");
  const target = freshTargetOnB(win);
  const weaponIdx = weaponByName(win, attacker, "shooting", "Smite - witchfire");
  const wrap = setupCycle(win, { attacker, weaponIdx, target, phaseKey: "shooting", modelsAttacking: 1, attacksRolled: 5 });
  assertEqual(diceCallCount(wrap), 5, "com Attacks resolvido em 5, o hit roll tem de pedir 5 dados");
});

// --- BUG 3: Attacks aleatório + vários modelos (A:D6 × 5 modelos) ---------
test("Barbgaunts (5/5, Barblauncher A:D6) pede 5 rolls de D6 de Attacks — um por modelo, não um só", () => {
  const win = loadApp();
  const attacker = addFullUnit(win, "playerA", "Barbgaunts");
  assertEqual(attacker.groups.reduce((s, g) => s + g.liveCount, 0), 5, "squad inicial devia ter 5 modelos vivos");
  const target = freshTargetOnB(win);
  const weaponIdx = weaponByName(win, attacker, "shooting", "Barblauncher");
  const wrap = setupCycle(win, { attacker, weaponIdx, target, phaseKey: "shooting", modelsAttacking: 5, heavyStationary: true });
  assert(/[Aa]ttacks/.test(stepTitle(wrap)), 'esperava um passo a pedir o roll de Attacks, apareceu: "' + stepTitle(wrap) + '"');
  // 5 modelos, cada um rola o seu D6 de Attacks — o máximo teórico da soma
  // é 5×6=30, não 6 (o bug tratava D6 como um valor só, ignorando os
  // modelos a mais).
  assertEqual(diceCallCount(wrap), 5, "5 modelos a rolar 1D6 cada = 5 dados físicos a lançar (o total depois é somado)");
});

test("Barbgaunts: 5 modelos rolam D6 e somam 22 attacks → hit roll pede exatamente 22 dados", () => {
  const win = loadApp();
  const attacker = addFullUnit(win, "playerA", "Barbgaunts");
  const target = freshTargetOnB(win);
  const weaponIdx = weaponByName(win, attacker, "shooting", "Barblauncher");
  const wrap = setupCycle(win, { attacker, weaponIdx, target, phaseKey: "shooting", modelsAttacking: 5, attacksRolled: 22, heavyStationary: true });
  assertEqual(diceCallCount(wrap), 22, "total de attacks somado (22) tem de ser o nº de dados pedido no hit roll");
});

run();
