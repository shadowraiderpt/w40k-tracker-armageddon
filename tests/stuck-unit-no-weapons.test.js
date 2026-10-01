// BUG bloqueante (01/10/2026): Attached Unit (Winged Tyranid Prime + Gargoyles),
// Shooting phase. Depois de usar o único tipo de arma (Fleshborer) via
// "resolver outro ataque com esta unidade" (não "terminar"), voltar a
// selecionar a unidade mostra "já usou todas as armas" mas não há forma de
// terminar a unidade nem de desfazer, porque a confirmação só existia no
// ecrã de Resultado do último ataque, já fechado.
const { test, setFile, assert, assertEqual, run } = require("./tiny-test");
const { loadApp, addFullUnit, weaponByName, declineHail } = require("./helpers");
setFile("stuck-unit-no-weapons.test.js");

function pickerWrap(win) {
  win.__state.tab = "turno";
  return win.renderAttackCycle("shooting");
}

// Resolve um ataque completo (passos 1-5) e clica em "resolver outro ataque"
// (NUNCA "terminar") — reproduz exatamente o estado em que a unidade fica
// presa: todas as armas usadas, mas ainda não marcada como "já atuou".
function resolveViaAnotherAttack(win, attacker, weaponName, target) {
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = attacker.id; c.weaponIdx = weaponByName(win, attacker, "shooting", weaponName); c.targetId = target.id;
  c.step = 5; c.hits = 0; c.deadByGroup = {}; c.woundsLeftByGroup = {};
  declineHail(win, attacker, target);
  const wrap = win.renderAttackCycle("shooting");
  const btn = Array.from(wrap.querySelectorAll("button")).find(b => /resolver outro ataque com esta unidade/i.test(b.textContent));
  assert(btn, "o botão 'resolver outro ataque' devia existir no ecrã de Resultado");
  btn.click();
}

test("Reprodução: Prime + Gargoyles, Shooting — depois de usar a única arma via 'outro ataque', a unidade fica selecionável mas sem saída", () => {
  const win = loadApp();
  win.addUnitToPlayer("playerA", win.findDatasheet(win.__library, "Gargoyles"), { leaderDs: win.findDatasheet(win.__library, "Winged Tyranid Prime") });
  const atk = win.__state.setup.playerA.units[0];
  const tgt = addFullUnit(win, "playerB", "Intercessor Squad");
  win.__state.game.activePlayerKey = "playerA";
  resolveViaAnotherAttack(win, atk, "Fleshborer", tgt);

  // A unidade continua no dropdown (não foi marcada "já atuou").
  assert(!win.actedSetForCurrentPhase().includes(String(atk.id)), "ainda não devia estar marcada como já atuou");

  win.__state.cycle = win.__emptyCycle();
  win.__state.cycle.attackerId = atk.id;
  const wrap = win.renderAttackCycle("shooting");
  assert(/já usou todas as armas/.test(wrap.textContent), "devia mostrar o aviso de armas esgotadas");

  const endBtn = Array.from(wrap.querySelectorAll("button")).find(b => /Terminar esta unidade/i.test(b.textContent));
  const undoBtn = Array.from(wrap.querySelectorAll("button")).find(b => /Desfazer último ataque/i.test(b.textContent));
  assert(endBtn, "devia haver um botão 'Terminar esta unidade' diretamente no picker, sem precisar do ecrã de Resultado já fechado");
  assert(undoBtn, "devia haver um botão 'Desfazer último ataque desta unidade' diretamente no picker");

  // "Terminar esta unidade" desbloqueia o avanço de fase (marca a unidade).
  endBtn.click();
  assert(win.actedSetForCurrentPhase().includes(String(atk.id)), "devia marcar a unidade como já atuou");
});

test("'Desfazer último ataque' repõe a arma disponível e os modelos mortos", () => {
  const win = loadApp();
  win.addUnitToPlayer("playerA", win.findDatasheet(win.__library, "Gargoyles"), { leaderDs: win.findDatasheet(win.__library, "Winged Tyranid Prime") });
  const atk = win.__state.setup.playerA.units[0];
  const tgt = addFullUnit(win, "playerB", "Intercessor Squad");
  win.__state.game.activePlayerKey = "playerA";
  // desta vez com mortes de verdade, para confirmar que o undo as repõe.
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = atk.id; c.weaponIdx = weaponByName(win, atk, "shooting", "Fleshborer"); c.targetId = tgt.id;
  c.step = 5; c.hits = 3; c.deadByGroup = { main: 2 }; c.woundsLeftByGroup = { main: tgt.groups.find(g => g.key === "main").stats.W };
  declineHail(win, atk, tgt);
  let wrap = win.renderAttackCycle("shooting");
  const anotherBtn = Array.from(wrap.querySelectorAll("button")).find(b => /resolver outro ataque com esta unidade/i.test(b.textContent));
  anotherBtn.click();

  const liveBeforeUndo = win.findRealUnit(tgt.id).groups.find(g => g.key === "main").liveCount;
  assertEqual(liveBeforeUndo, 8, "2 mortos de 10 iniciais");
  assert(win.isWeaponUsed(atk.id, win.weaponsForPhase(atk, "shooting").find(w => w.name === "Fleshborer")), "Fleshborer marcada como usada");

  win.__state.cycle = win.__emptyCycle();
  win.__state.cycle.attackerId = atk.id;
  wrap = win.renderAttackCycle("shooting");
  const undoBtn = Array.from(wrap.querySelectorAll("button")).find(b => /Desfazer último ataque/i.test(b.textContent));
  undoBtn.click();

  assertEqual(win.findRealUnit(tgt.id).groups.find(g => g.key === "main").liveCount, 10, "os 2 modelos mortos voltam");
  assert(!win.isWeaponUsed(atk.id, win.weaponsForPhase(atk, "shooting").find(w => w.name === "Fleshborer")), "Fleshborer volta a ficar disponível");
  const wrap2 = win.renderAttackCycle("shooting");
  assert(!/já usou todas as armas/.test(wrap2.textContent), "depois do undo, a arma volta a aparecer no dropdown");
});

test("Generalização (item 5): unidade sem NENHUMA arma para esta fase (melee-only, Shooting) também tem 'Terminar esta unidade', sem 'Desfazer' (nenhum ataque para desfazer)", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Von Ryan's Leapers");
  win.__state.cycle = win.__emptyCycle();
  win.__state.cycle.attackerId = atk.id;
  win.__state.game.activePlayerKey = "playerA";
  const wrap = win.renderAttackCycle("shooting");
  assert(/não tem armas de tiro/.test(wrap.textContent));
  const endBtn = Array.from(wrap.querySelectorAll("button")).find(b => /Terminar esta unidade/i.test(b.textContent));
  const undoBtn = Array.from(wrap.querySelectorAll("button")).find(b => /Desfazer último ataque/i.test(b.textContent));
  assert(endBtn, "mesmo sem nenhuma arma nesta fase, devia poder terminar a unidade sem fingir um ataque");
  assert(!undoBtn, "sem nenhum ataque desta unidade no log, não devia haver botão de desfazer");
  endBtn.click();
  assert(win.actedSetForCurrentPhase().includes(String(atk.id)));
});

run();
