// Pedido "desfazer parcial (sem reset total do jogo)": duas ferramentas
// novas, cada uma resolvendo um cenário concreto do jogador sem apagar o
// resto da partida.
// A) "Reabrir esta unidade nesta fase" — desmarca só o "já terminou",
//    nunca mexe no dano/armas já resolvidas.
// B) "Desfazer último ataque" — restaura o alvo, desmarca a arma como
//    usada e (se aplicável) reabre a unidade — só para o attackLog[0].
const { test, setFile, assert, assertEqual, run } = require("./tiny-test");
const { loadApp, addFullUnit, weaponByName, addDummyTarget } = require("./helpers");

setFile("undo-and-reopen.test.js");

function clickButtonWithText(root, text) {
  const btn = Array.from(root.querySelectorAll("button")).find(b => b.textContent === text);
  if (!btn) throw new Error('Botão "' + text + '" não encontrado. Botões existentes: ' + Array.from(root.querySelectorAll("button")).map(b => b.textContent).join(" | "));
  btn.click();
}

// --- A) Reabrir unidade -----------------------------------------------
test("Unidade marcada como já atuou desaparece do dropdown, aparece na lista de reabrir, e o botão devolve-a ao normal", () => {
  const win = loadApp();
  const attacker = addFullUnit(win, "playerA", "Intercessor Squad");
  addDummyTarget(win, "playerB");
  win.markUnitActedThisPhase(attacker.id);

  win.__state.cycle = win.__emptyCycle();
  const wrap1 = win.renderPicker(win.allInstances(), "shooting");
  const options = Array.from(wrap1.querySelectorAll("select")[0].querySelectorAll("option")).map(o => o.textContent);
  assert(!options.some(t => t.includes("Intercessor Squad")), "unidade já atuou — não devia aparecer no dropdown de atacante");
  assert(/Reabrir esta unidade nesta fase/.test(wrap1.textContent), "devia listar a unidade na secção de reabrir");

  clickButtonWithText(wrap1, "Reabrir esta unidade nesta fase");

  const wrap2 = win.renderPicker(win.allInstances(), "shooting");
  const options2 = Array.from(wrap2.querySelectorAll("select")[0].querySelectorAll("option")).map(o => o.textContent);
  assert(options2.some(t => t.includes("Intercessor Squad")), "depois de reabrir, a unidade devia voltar a aparecer no dropdown");
});

// --- B) Desfazer último ataque ------------------------------------------
function resolveAttackAndEndUnit(win, attacker, target, weaponName, phaseKey, deadCount) {
  const weaponIdx = weaponByName(win, attacker, phaseKey, weaponName);
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = attacker.id;
  c.weaponIdx = weaponIdx;
  c.targetId = target.id;
  c.step = 5;
  c.hits = 1;
  c.deadByGroup = { main: deadCount };
  const wrap = win.renderAttackCycle(phaseKey);
  clickButtonWithText(wrap, "Confirmar e terminar esta unidade nesta fase");
}

test("Desfazer último ataque restaura o alvo, desmarca a arma usada e reabre a unidade atacante", () => {
  const win = loadApp();
  const attacker = addFullUnit(win, "playerA", "Intercessor Squad");
  const target = addFullUnit(win, "playerB", "Gretchin");
  const liveBefore = target.groups.find(g => g.key === "main").liveCount;

  resolveAttackAndEndUnit(win, attacker, target, "Bolt rifle", "shooting", 2);

  const realTarget = win.findRealUnit(target.id);
  assertEqual(realTarget.groups.find(g => g.key === "main").liveCount, liveBefore - 2, "o ataque devia ter matado 2 modelos");
  assert(win.isWeaponUsed(attacker.id, win.weaponsForPhase(attacker, "shooting").find(w => w.name === "Bolt rifle")), "Bolt rifle devia estar marcada como usada");
  assert(win.actedSetForCurrentPhase().includes(String(attacker.id)), "a unidade devia estar marcada como já atuou");
  assertEqual(win.__state.attackLog.length, 1, "devia ter 1 entrada no histórico");

  win.undoLastAttack();

  assertEqual(win.findRealUnit(target.id).groups.find(g => g.key === "main").liveCount, liveBefore, "o desfazer devia repor os modelos vivos de antes do ataque");
  assert(!win.isWeaponUsed(attacker.id, win.weaponsForPhase(attacker, "shooting").find(w => w.name === "Bolt rifle")), "Bolt rifle devia voltar a estar disponível");
  assert(!win.actedSetForCurrentPhase().includes(String(attacker.id)), "a unidade devia voltar a poder ser escolhida nesta fase");
  assertEqual(win.__state.attackLog.length, 0, "a entrada desfeita devia sair do histórico");
});

test("O botão de desfazer só aparece na entrada mais recente do histórico", () => {
  const win = loadApp();
  const attacker = addFullUnit(win, "playerA", "Intercessor Squad");
  const target = addFullUnit(win, "playerB", "Gretchin");

  resolveAttackAndEndUnit(win, attacker, target, "Bolt rifle", "shooting", 1);
  // Reabre para poder atacar outra vez com a mesma unidade (arma diferente)
  const arr = win.actedSetForCurrentPhase();
  arr.splice(arr.indexOf(String(attacker.id)), 1);
  resolveAttackAndEndUnit(win, attacker, target, "Grenade launcher - krak", "shooting", 1);

  win.__state.ui.estadoHistoryOpen = true;
  const historyWrap = win.renderAttackHistory();
  const undoButtons = Array.from(historyWrap.querySelectorAll("button")).filter(b => b.textContent.includes("Desfazer"));
  assertEqual(undoButtons.length, 1, "só a entrada mais recente pode ter o botão de desfazer");

  const entries = historyWrap.querySelectorAll(".unit-instance");
  assertEqual(entries.length, 2, "devia haver 2 entradas no histórico");
  assert(entries[0].textContent.includes("Grenade launcher - krak"), "a entrada mais recente (topo) é o 2º ataque");
  assert(entries[0].querySelector("button") && entries[0].querySelector("button").textContent.includes("Desfazer"), "o botão de desfazer está na entrada do topo");
  assert(!entries[1].querySelector("button"), "a entrada mais antiga não devia ter botão de desfazer");
});

run();
