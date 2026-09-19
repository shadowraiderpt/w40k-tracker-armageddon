// Haruspex e Exocrine (Tyranids): dados, Damaged, Grisly Spectacle, Symbiotic Targeting.
const { test, setFile, assert, assertEqual, run } = require("./tiny-test");
const { loadApp, addFullUnit, weaponByName, addDummyTarget } = require("./helpers");
setFile("new-units.test.js");

test("Haruspex e Exocrine existem com os dados confirmados", () => {
  const win = loadApp();
  const h = win.findDatasheet(win.__library, "Haruspex");
  const e = win.findDatasheet(win.__library, "Exocrine");
  assertEqual(h.points, 125); assertEqual(e.points, 135);
  assertEqual(h.stats.T, 11); assertEqual(e.stats.T, 10);
  assertEqual(h.deadlyDemise, "D3"); assertEqual(e.deadlyDemise, "D3");
});

test("Damaged: com 5 wounds restantes o hit roll do Haruspex leva -1", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Haruspex");
  const tgt = addDummyTarget(win, "playerB");
  atk.groups[0].woundsRemainingOnCurrent = 5;
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = atk.id; c.weaponIdx = weaponByName(win, atk, "fight", "Ravenous maw"); c.targetId = tgt.id; c.step = 1; c.modelsAttacking = 1;
  let wrap = win.renderAttackCycle("fight");
  assert(/Precisas de 4\+ para acertar/.test(wrap.textContent), "WS3+ com -1 devia dar 4+");
  assert(/DAMAGED/.test(wrap.textContent));
  atk.groups[0].woundsRemainingOnCurrent = 6;
  wrap = win.renderAttackCycle("fight");
  assert(/Precisas de 3\+ para acertar/.test(wrap.textContent), "acima de 5 wounds não há penalização");
});

test("Grisly Spectacle: Haruspex destrói unidade e pede as unidades inimigas a 6\"", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Haruspex");
  const tgt = addFullUnit(win, "playerB", "Gretchin");
  const other = addFullUnit(win, "playerB", "Intercessor Squad");
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = atk.id; c.weaponIdx = weaponByName(win, atk, "fight", "Ravenous maw"); c.targetId = tgt.id;
  c.step = 5; c.hits = 1; c.deadByGroup = { main: tgt.groups[0].liveCount };
  const wrap = win.renderAttackCycle("fight");
  assert(/Grisly Spectacle/.test(wrap.textContent) && /Intercessor Squad/.test(wrap.textContent));
});

test("Grisly Spectacle não dispara se o alvo sobrevive", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Haruspex");
  const tgt = addFullUnit(win, "playerB", "Gretchin");
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = atk.id; c.weaponIdx = weaponByName(win, atk, "fight", "Ravenous maw"); c.targetId = tgt.id;
  c.step = 5; c.hits = 1; c.deadByGroup = { main: 2 };
  assert(!/Grisly Spectacle/.test(win.renderAttackCycle("fight").textContent));
});

test("Symbiotic Targeting: Exocrine acerta e Termagants ganham lembrete de reroll contra o mesmo alvo", () => {
  const win = loadApp();
  const exo = addFullUnit(win, "playerA", "Exocrine");
  const terma = addFullUnit(win, "playerA", "Termagants");
  const tgt = addDummyTarget(win, "playerB");
  win.__state.cycle = win.__emptyCycle();
  let c = win.__state.cycle;
  c.attackerId = exo.id; c.weaponIdx = weaponByName(win, exo, "shooting", "Bio-plasmic cannon"); c.targetId = tgt.id;
  c.step = 5; c.hits = 2; c.deadByGroup = {};
  win.renderAttackCycle("shooting");
  win.__state.cycle = win.__emptyCycle(); c = win.__state.cycle;
  c.attackerId = terma.id; c.weaponIdx = weaponByName(win, terma, "shooting", "Fleshborer"); c.targetId = tgt.id; c.step = 1; c.modelsAttacking = 10;
  assert(/Symbiotic Targeting ativo/.test(win.renderAttackCycle("shooting").textContent));
  win.__state.game.phase = "charge";
  assert(!/Symbiotic Targeting ativo/.test(win.renderAttackCycle("shooting").textContent), "fim da fase — deixa de valer");
});
run();
