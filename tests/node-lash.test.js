// Node Lash (Neurotyrant, "while this model is leading a unit"): +1 ao hit roll da
// unidade liderada; +1 ao wound roll também se o alvo estiver Battle-shocked
// (pergunta ao jogador). Entra nas somas limitadas a ±1. Sozinho não faz nada.
// Setup Support sozinho: aviso (não remove).
const { test, setFile, assert, assertEqual, run } = require("./tiny-test");
const { loadApp, addFullUnit, weaponByName } = require("./helpers");
setFile("node-lash.test.js");

function led(win) {
  win.addUnitToPlayer("playerA", win.findDatasheet(win.__library, "Neurogaunts"), { leaderDs: win.findDatasheet(win.__library, "Neurotyrant") });
  return win.__state.setup.playerA.units[0];
}
function cycle(win, atk, wname, tgt, extra) {
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = atk.id; c.weaponIdx = weaponByName(win, atk, "fight", wname); c.targetId = tgt.id;
  Object.assign(c, extra || {});
  return c;
}
const big = w => w.querySelector(".threshold-number").textContent;

test("Neurotyrant + Neurogaunts vs alvo normal: +1 ao acertar (WS4+ → 3+), 0 ao ferir", () => {
  const win = loadApp();
  const atk = led(win);
  const tgt = addFullUnit(win, "playerB", "Intercessor Squad");
  cycle(win, atk, "Chitinous claws and teeth", tgt, { step: 1, modelsAttacking: 5 });
  let wrap = win.renderAttackCycle("fight");
  assert(/Battle-shocked\?/.test(wrap.textContent), "pergunta se o alvo está Battle-shocked");
  const sel = wrap.querySelector("select");
  sel.value = "no"; sel.onchange({ target: sel });
  wrap = win.renderAttackCycle("fight");
  assertEqual(big(wrap), "3+", "WS4+ com Node Lash +1");
  assert(/NODE LASH: \+1 ao acertar/.test(wrap.textContent));
  cycle(win, atk, "Chitinous claws and teeth", tgt, { step: 2, hits: 5, modelsAttacking: 5, nodeLashWound: false });
  wrap = win.renderAttackCycle("fight");
  assertEqual(big(wrap), "5+", "S3 vs T4 = 5+, sem bónus ao ferir");
  assert(!/NODE LASH/.test(wrap.textContent));
});

test("Neurotyrant + Neurogaunts vs alvo Battle-shocked: +1 ao acertar e +1 ao ferir (5+ → 4+)", () => {
  const win = loadApp();
  const atk = led(win);
  const tgt = addFullUnit(win, "playerB", "Intercessor Squad");
  cycle(win, atk, "Chitinous claws and teeth", tgt, { step: 1, modelsAttacking: 5 });
  let wrap = win.renderAttackCycle("fight");
  const sel = wrap.querySelector("select");
  sel.value = "yes"; sel.onchange({ target: sel });
  assertEqual(big(win.renderAttackCycle("fight")), "3+");
  cycle(win, atk, "Chitinous claws and teeth", tgt, { step: 2, hits: 5, modelsAttacking: 5, nodeLashWound: true });
  wrap = win.renderAttackCycle("fight");
  assertEqual(big(wrap), "4+", "5+ com Node Lash +1");
  assert(/NODE LASH: \+1 ao ferir/.test(wrap.textContent));
});

test("Node Lash entra nas somas ±1: +1 manual e +1 Node Lash no hit somam +2 mas aplica-se +1", () => {
  const win = loadApp();
  const atk = led(win);
  const tgt = addFullUnit(win, "playerB", "Intercessor Squad");
  cycle(win, atk, "Chitinous claws and teeth", tgt, { step: 1, modelsAttacking: 5, nodeLashWound: false, hitAdjust: 1 });
  const wrap = win.renderAttackCycle("fight");
  assertEqual(big(wrap), "3+", "WS4+ só sobe 1 (limite ±1)");
  assert(/LIMITE ±1: modificadores ao hit roll somam \+2 → aplicado \+1/.test(wrap.textContent));
});

test("Neurotyrant sozinho: sem Node Lash (nem pergunta, nem bónus)", () => {
  const win = loadApp();
  const nt = addFullUnit(win, "playerA", "Neurotyrant");
  const tgt = addFullUnit(win, "playerB", "Intercessor Squad");
  cycle(win, nt, "Neurotyrant claws and lashes", tgt, { step: 1, modelsAttacking: 1 });
  const wrap = win.renderAttackCycle("fight");
  assert(!/Battle-shocked\?/.test(wrap.textContent) && !/NODE LASH/.test(wrap.textContent));
  assertEqual(big(wrap), "3+", "WS3+ sem bónus");
});

test("Estado gravado com um Support sozinho: aviso na unidade, sem remover; anexado não avisa", () => {
  const win = loadApp();
  const solo = addFullUnit(win, "playerA", "Ancient");          // addUnitToPlayer não o impede (o picker sim)
  assertEqual(win.supportAloneWarning(solo), "Support sozinho — inválido na 11ª");
  assert(win.__state.setup.playerA.units.length === 1, "não foi removido");
  win.__state.tab = "setup"; win.render();
  assert(/Support sozinho — inválido na 11ª/.test(win.document.getElementById("root").textContent), "aviso visível no setup");
  const win2 = loadApp();
  win2.addUnitToPlayer("playerA", win2.findDatasheet(win2.__library, "Intercessor Squad"), { supportDs: win2.findDatasheet(win2.__library, "Ancient") });
  assertEqual(win2.supportAloneWarning(win2.__state.setup.playerA.units[0]), null);
  const leader = addFullUnit(win2, "playerB", "Warboss");
  assertEqual(win2.supportAloneWarning(leader), null, "um Leader pode estar sozinho");
});

run();
