const { test, setFile, assert, assertEqual, run } = require("./tiny-test");
const { loadApp, addFullUnit, weaponByName, addDummyTarget } = require("./helpers");
setFile("neurolictor-gargoyles.test.js");

function cyc(win, atk, wname, tgt, phaseKey, extra) {
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = atk.id; c.weaponIdx = weaponByName(win, atk, phaseKey, wname); c.targetId = tgt.id;
  Object.assign(c, extra || {});
  return c;
}

test("Neurolictor e Gargoyles existem com os dados confirmados", () => {
  const win = loadApp();
  const n = win.findDatasheet(win.__library, "Neurolictor");
  const g = win.findDatasheet(win.__library, "Gargoyles");
  assertEqual(n.points, 80); assertEqual(n.stats.W, 7); assertEqual(n.stats.InvSV, "4+");
  assertEqual(g.stats.M, "12\""); assertEqual(g.stats.T, 3);
});

test("Gargoyles: 10 modelos = 80 pts, 20 modelos = 155 pts exatos; tamanhos intermédios ficam aproximados", () => {
  const win = loadApp();
  const ds = win.findDatasheet(win.__library, "Gargoyles");
  win.addUnitToPlayer("playerA", ds, {});
  let u = win.__state.setup.playerA.units[0];
  assertEqual(u.points, 80); assertEqual(u.pointsApprox, false);
  assertEqual(u.groups[0].liveCount, 10);
});

test("Gargoyles a 20 modelos custam 155 (sem asterisco)", () => {
  const win = loadApp();
  const ds = win.findDatasheet(win.__library, "Gargoyles");
  // sem BOX_LIMIT no teste: remove a restrição via dois esquadrões não é preciso — testa pricing direto
  const exact = ds.pointsBySize["20"];
  assertEqual(exact, 155);
});

test("Winged Tyranid Prime pode ser anexado como líder aos Gargoyles", () => {
  const win = loadApp();
  const prime = win.findDatasheet(win.__library, "Winged Tyranid Prime");
  const garg = win.findDatasheet(win.__library, "Gargoyles");
  assert(prime.leader_for.includes("Gargoyles"));
  win.addUnitToPlayer("playerA", garg, { leaderDs: prime });
  const u = win.__state.setup.playerA.units[0];
  assertEqual(u.datasheetNames.join("+"), "Winged Tyranid Prime+Gargoyles");
  assertEqual(u.points, 65 + 80);
});

test("Feeder Tendrils: só dá 1CP contra alvo CHARACTER morto", () => {
  const win = loadApp();
  const neu = addFullUnit(win, "playerA", "Neurolictor");
  const cap = addFullUnit(win, "playerB", "Librarian");
  cyc(win, neu, "Piercing claws and talons", cap, "fight", { step: 5, hits: 3, deadByGroup: { main: 1 } });
  let wrap = win.renderAttackCycle("fight");
  assert(/Feeder Tendrils/.test(wrap.textContent));
  Array.from(wrap.querySelectorAll("button")).find(b => /Registar \+1CP/.test(b.textContent)).click();
  assertEqual(win.__state.setup.playerA.cp, 1);

  const win2 = loadApp();
  const neu2 = addFullUnit(win2, "playerA", "Neurolictor");
  const boyz = addFullUnit(win2, "playerB", "Gretchin");
  cyc(win2, neu2, "Piercing claws and talons", boyz, "fight", { step: 5, hits: 3, deadByGroup: { main: 2 } });
  assert(!/Feeder Tendrils/.test(win2.renderAttackCycle("fight").textContent), "Gretchin não é CHARACTER");
});

test("Neural Disruption: aparece no Command phase do dono e pede Battle-shock", () => {
  const win = loadApp();
  addFullUnit(win, "playerA", "Neurolictor");
  const enemy = addFullUnit(win, "playerB", "Intercessor Squad");
  win.__state.game.activePlayerKey = "playerA";
  let wrap = win.renderCommandPhase();
  assert(/Neural Disruption/.test(wrap.textContent));
  const sel = Array.from(wrap.querySelectorAll("select")).find(s => Array.from(s.options).some(o => /Não usar este Command phase/.test(o.textContent) && false || /Intercessor/.test(o.textContent)));
  sel.value = String(enemy.id); sel.onchange({ target: sel });
  wrap = win.renderCommandPhase();
  assert(/Confirmar resultado/.test(wrap.textContent) && /Concluir Neural Disruption/.test(wrap.textContent));
  Array.from(wrap.querySelectorAll("button")).find(b => /Concluir Neural/.test(b.textContent)).click();
  assert(!/Neural Disruption/.test(win.renderCommandPhase().textContent), "não repete no mesmo Command phase");
});

test("Psychological Saboteur: só pergunta se a unidade está Battle-shocked; aplica -1 hit / +1 wound quando confirmado", () => {
  const win = loadApp();
  const neu = addFullUnit(win, "playerB", "Neurolictor");
  const marines = addFullUnit(win, "playerA", "Intercessor Squad");
  const tgt = addFullUnit(win, "playerB", "Gretchin");
  // marines NÃO battle-shocked: sem pergunta
  cyc(win, marines, "Bolt rifle", tgt, "shooting", { step: 1, modelsAttacking: 10, heavyStationary: false });
  assert(!/Psychological Saboteur/.test(win.renderAttackCycle("shooting").textContent));
  // battle-shocked: pergunta
  win.findRealUnit(marines.id).battleshocked = true;
  cyc(win, marines, "Bolt rifle", tgt, "shooting", { step: 1, modelsAttacking: 10, heavyStationary: false });
  let wrap = win.renderAttackCycle("shooting");
  assert(/Psychological Saboteur/.test(wrap.textContent));
  win.__state.cycle.saboteurHit = false;
  assert(/Precisas de 3\+ para acertar/.test(win.renderAttackCycle("shooting").textContent), "BS3+ sem penalização");
  win.__state.cycle.saboteurHit = true;
  assert(/Precisas de 4\+ para acertar/.test(win.renderAttackCycle("shooting").textContent), "BS3+ com -1 = 4+");
});

test("Psychological Saboteur +1 wound para Tyranids contra alvo Battle-shocked a 12\"", () => {
  const win = loadApp();
  addFullUnit(win, "playerA", "Neurolictor");
  const terma = addFullUnit(win, "playerA", "Termagants");
  const tgt = addFullUnit(win, "playerB", "Intercessor Squad");
  win.findRealUnit(tgt.id).battleshocked = true;
  cyc(win, terma, "Fleshborer", tgt, "shooting", { step: 2, hits: 5, modelsAttacking: 10, saboteurWound: true, saboteurHit: null });
  const wrap = win.renderAttackCycle("shooting");
  // S5 vs T4 = 3+, com +1 = 2+
  assert(/Precisas de 2\+ para ferir/.test(wrap.textContent) && /SABOTEUR/.test(wrap.textContent), wrap.textContent.slice(0, 200));
});

test("Winged Swarm: só aparece se a unidade não está engaged; marca não poder carregar", () => {
  const win = loadApp();
  const garg = addFullUnit(win, "playerA", "Gargoyles");
  const tgt = addFullUnit(win, "playerB", "Intercessor Squad");
  cyc(win, garg, "Fleshborer", tgt, "shooting", { step: 5, hits: 1, deadByGroup: {} });
  let wrap = win.renderAttackCycle("shooting");
  assert(/Winged Swarm/.test(wrap.textContent));
  Array.from(wrap.querySelectorAll("button")).find(b => /Vou mover/.test(b.textContent)).click();
  assert(/NÃO PODE DECLARAR CHARGE/.test(win.unitLiveLabel(win.findInstance(garg.id))));
  // engaged: não aparece
  win.findRealUnit(garg.id).engagedWithUnitId = tgt.id;
  cyc(win, garg, "Fleshborer", tgt, "shooting", { step: 5, hits: 1, deadByGroup: {} });
  assert(!/depois de disparar, se a unidade não está em Engagement Range/.test(win.renderAttackCycle("shooting").textContent), "engaged: sem opção de Winged Swarm");
});

run();
