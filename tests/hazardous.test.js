// HAZARDOUS (11ª edição, corrigido): falha em 1-2 (não só 1), 1 mortal
// wound à unidade (3 se TODOS os modelos forem MONSTER/VEHICLE), alocada
// pela regra normal (não obrigatoriamente ao portador), nunca destrói um
// modelo diretamente.
const { test, setFile, assert, assertEqual, run } = require("./tiny-test");
const { loadApp, addFullUnit, weaponByName, addDummyTarget } = require("./helpers");
setFile("hazardous.test.js");

function toHazardousStep(win, attacker, weaponName, target, phaseKey) {
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = attacker.id; c.weaponIdx = weaponByName(win, attacker, phaseKey, weaponName); c.targetId = target.id;
  c.step = 5; c.hits = 0; c.deadByGroup = {};
  return win.renderAttackCycle(phaseKey);
}

test("Resultado 2 conta como falha, resultado 3 passa (falha em 1-2, não só em 1)", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Librarian");
  const tgt = addDummyTarget(win, "playerB");
  const wrap = toHazardousStep(win, atk, "Smite - focused witchfire", tgt, "shooting");
  assert(/1-2/.test(wrap.textContent), "devia perguntar por resultados de 1-2, não só de 1");
  const btn2 = Array.from(wrap.querySelectorAll("button")).find(b => b.textContent === "2");
  const btn3 = Array.from(wrap.querySelectorAll("button")).find(b => b.textContent === "3");
  btn2.click();
  btn3.click();
  const wrapAfter = win.renderAttackCycle("shooting");
  const finalConfirm = Array.from(wrapAfter.querySelectorAll("button")).find(b => /Confirmar Hazardous/.test(b.textContent));
  finalConfirm.click();
  assertEqual(win.__state.cycle.hazardousFailCount, 1, "só o resultado de 2 devia contar como falha — o 3 passa");
});

test("Librarian anexado a Intercessor Squad: a mortal wound vai para um modelo da squad, nunca para o Librarian (character por último)", () => {
  const win = loadApp();
  const librarianDs = win.findDatasheet(win.__library, "Librarian");
  const intercessorDs = win.findDatasheet(win.__library, "Intercessor Squad");
  win.addUnitToPlayer("playerA", intercessorDs, { leaderDs: librarianDs });
  const atk = win.__state.setup.playerA.units[0];
  const tgt = addDummyTarget(win, "playerB");
  const wrap = toHazardousStep(win, atk, "Smite - focused witchfire", tgt, "shooting");
  win.__state.cycle.hazardousFailCount = 1;
  // O Psychic Hood (unidade a liderar) também cobre as MW do Hazardous da própria
  // unidade (Bug B) — este teste é sobre a alocação, por isso dá o FNP como resolvido.
  win.__state.cycle.hazardousFnpDone = true;
  const wrap2 = win.renderAttackCycle("shooting");
  assert(/ordem de alocação/i.test(wrap2.textContent), "Attached Unit (2 grupos) devia pedir a ordem de alocação");
  // aceita a ordem por defeito (já vem com não-character primeiro, character por último)
  const confirmOrderBtn = Array.from(wrap2.querySelectorAll("button")).find(b => /Confirmar ordem/.test(b.textContent));
  confirmOrderBtn.click();
  // O clique chama o render() global da app (que só re-renderiza a
  // fase/tab atual da UI) — força explicitamente outro renderAttackCycle
  // para garantir que o cálculo pós-ordem corre, tal como os outros
  // testes desta suite já fazem em vez de depender do render() global.
  win.renderAttackCycle("shooting");
  const realAtk = win.findRealUnit(atk.id);
  const leaderGroup = realAtk.groups.find(g => g.key === "leader");
  const mainGroup = realAtk.groups.find(g => g.key !== "leader");
  assertEqual(leaderGroup.liveCount, 1, "o Librarian (character) não devia perder nenhum modelo");
  assertEqual(leaderGroup.woundsRemainingOnCurrent, leaderGroup.stats.W, "o Librarian não devia sofrer dano nenhum");
  assertEqual(mainGroup.liveCount, mainGroup.initialCount, "1 mortal wound (W2 por modelo) ainda não chega para matar um Intercessor");
  assertEqual(mainGroup.woundsRemainingOnCurrent, mainGroup.stats.W - 1, "a mortal wound devia ir para um modelo da squad (Intercessors), não para o Librarian");
});

test("Unidade que não é toda MONSTER/VEHICLE (Vanguard Veteran, W2): 1 falha = 1 mortal wound só, não mata o modelo", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Vanguard Veteran Squad with Jump Packs");
  const tgt = addDummyTarget(win, "playerB");
  const wrap = toHazardousStep(win, atk, "Plasma pistol - supercharge", tgt, "shooting");
  win.__state.cycle.modelsAttacking = 1;
  win.__state.cycle.hazardousFailCount = 1;
  win.renderAttackCycle("shooting");
  const realAtk = win.findRealUnit(atk.id);
  assertEqual(realAtk.groups[0].liveCount, realAtk.groups[0].initialCount, "1 mortal wound não é suficiente para matar um modelo com W2");
  assertEqual(win.__state.cycle.hazardousResult.mwPerFail, 1, "unidade sem ser toda MONSTER/VEHICLE — só 1 MW por falha");
});

// --- Verificação direta do cálculo (hazardousAllMV / applyHazardousMortalWounds) --
// Nenhuma unidade MONSTER/VEHICLE do roster atual tem uma arma HAZARDOUS, por
// isso testa-se a função diretamente para confirmar a regra dos "3 MW se
// TODOS os modelos forem MONSTER/VEHICLE".
test("hazardousAllMV: Land Speeder (VEHICLE) conta como \"todos MONSTER/VEHICLE\", Vanguard Veteran não conta", () => {
  const win = loadApp();
  const landSpeeder = win.findRealUnit(addFullUnit(win, "playerA", "Land Speeder").id);
  const vanguard = win.findRealUnit(addFullUnit(win, "playerB", "Vanguard Veteran Squad with Jump Packs").id);
  assert(win.hazardousAllMV(landSpeeder), "Land Speeder é VEHICLE — devia contar como \"todos os modelos MONSTER/VEHICLE\"");
  assert(!win.hazardousAllMV(vanguard), "Vanguard Veteran não é MONSTER/VEHICLE");
});

test("applyHazardousMortalWounds: unidade toda MONSTER/VEHICLE dá 3 MW por falha, mas não mata se W for maior (dano normal, nunca destruição direta)", () => {
  const win = loadApp();
  const landSpeeder = win.findRealUnit(addFullUnit(win, "playerA", "Land Speeder").id); // W9, 1 modelo
  const result = win.applyHazardousMortalWounds(landSpeeder, null, 1);
  assertEqual(result.mwPerFail, 3);
  assertEqual(result.mwTotal, 3);
  assertEqual(landSpeeder.groups[0].liveCount, 1, "3 mortal wounds contra W9 não bastam para matar o modelo — nunca destrói diretamente");
  assertEqual(landSpeeder.groups[0].woundsRemainingOnCurrent, 6, "devia sobrar 9-3=6 wounds no modelo");
});

run();
