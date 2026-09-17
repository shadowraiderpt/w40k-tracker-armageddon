// Bug 7 (playtest 16-17 Set 2026): numa Attached Unit (Captain + Ancient +
// Intercessor Squad) era fácil clicar "Confirmar e terminar esta unidade
// nesta fase" sem ter resolvido a arma de todos os modelos anexados — sem
// forma de corrigir depois. A app agora mostra uma checklist "Armas já
// resolvidas: X ✓ / Y ☐" no picker e outra vez, como aviso, mesmo antes do
// botão de terminar.
const { test, setFile, assert, assertEqual, run } = require("./tiny-test");
const { loadApp, addFullUnit, weaponByName, setupCycle, addDummyTarget } = require("./helpers");

setFile("weapon-checklist.test.js");

function addAttachedUnit(win, playerKey) {
  const captainDs = win.findDatasheet(win.__library, "Captain with Relic Shield");
  const ancientDs = win.findDatasheet(win.__library, "Ancient");
  const intercessorDs = win.findDatasheet(win.__library, "Intercessor Squad");
  win.addUnitToPlayer(playerKey, intercessorDs, { leaderDs: captainDs, supportDs: ancientDs });
  const units = win.__state.setup[playerKey].units;
  return units[units.length - 1];
}

test("Unidade de 1 datasheet só: sem checklist (nada para desambiguar)", () => {
  const win = loadApp();
  const attacker = addFullUnit(win, "playerA", "Intercessor Squad");
  assertEqual(win.unitWeaponChecklistText(attacker, "shooting"), null);
});

test("Attached Unit (Captain+Ancient+Intercessors): checklist lista as 3 datasheets, todas por resolver", () => {
  const win = loadApp();
  const attacker = addAttachedUnit(win, "playerA");
  const text = win.unitWeaponChecklistText(attacker, "shooting");
  assert(text, "devia haver checklist para uma Attached Unit");
  assert(/Captain with Relic Shield ☐/.test(text), 'Captain ainda não disparou: "' + text + '"');
  assert(/Ancient ☐/.test(text), 'Ancient ainda não disparou: "' + text + '"');
  assert(/Intercessor Squad ☐/.test(text), 'Intercessors ainda não dispararam: "' + text + '"');
});

test("Depois de resolver a arma do Captain, só o Captain aparece ✓ — Ancient e Intercessors continuam ☐", () => {
  const win = loadApp();
  const attacker = addAttachedUnit(win, "playerA");
  const target = addDummyTarget(win, "playerB");
  const weaponIdx = weaponByName(win, attacker, "shooting", "Heavy bolt pistol"); // arma do Captain
  setupCycle(win, { attacker, weaponIdx, target, phaseKey: "shooting", modelsAttacking: 1 });
  win.markWeaponUsed(attacker.id, win.weaponsForPhase(attacker, "shooting")[weaponIdx]);

  const text = win.unitWeaponChecklistText(attacker, "shooting");
  assert(/Captain with Relic Shield ✓/.test(text), 'Captain já disparou: "' + text + '"');
  assert(/Ancient ☐/.test(text), 'Ancient continua por resolver: "' + text + '"');
  assert(/Intercessor Squad ☐/.test(text), 'Intercessors continuam por resolver: "' + text + '"');
});

test("Datasheet sem arma nesta fase (Ancient só tem armas de shooting e fight, mas se não tivesse nenhuma) fica marcada '—', não ☐", () => {
  // Ancient tem Bolt pistol/Bolt rifle (shooting) e Close-combat weapon
  // (fight) — para testar o caso "sem arma nesta fase" simulamos a fase de
  // fight só com o Captain e o Ancient, que TÊM arma de combate; o caso
  // real de "—" é para uma datasheet 100% sem entrada em ranged_weapons ou
  // melee_weapons — aqui confirmamos que nenhuma das 3 fica marcada assim
  // por engano quando têm mesmo arma disponível.
  const win = loadApp();
  const attacker = addAttachedUnit(win, "playerA");
  const text = win.unitWeaponChecklistText(attacker, "fight");
  assert(!/—/.test(text), 'todas as 3 datasheets têm arma de combate — nenhuma devia ficar "—": "' + text + '"');
});

test("O picker (step 0) mostra a checklist assim que a Attached Unit é escolhida como atacante", () => {
  const win = loadApp();
  const attacker = addAttachedUnit(win, "playerA");
  addDummyTarget(win, "playerB");
  win.__state.cycle = win.__emptyCycle();
  win.__state.cycle.attackerId = attacker.id;
  const wrap = win.renderPicker(win.allInstances(), "shooting");
  assert(/Armas já resolvidas nesta fase/.test(wrap.textContent), "o picker devia mostrar a checklist com a unidade já escolhida");
});

test("O ecrã de Resultado avisa outra vez, antes do botão de terminar, se ainda faltam armas", () => {
  const win = loadApp();
  const attacker = addAttachedUnit(win, "playerA");
  const target = addDummyTarget(win, "playerB");
  const weaponIdx = weaponByName(win, attacker, "shooting", "Heavy bolt pistol");
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = attacker.id; c.weaponIdx = weaponIdx; c.targetId = target.id;
  c.step = 5; c.hits = 0; c.deadByGroup = {};
  const wrap = win.renderAttackCycle("shooting");
  assert(/ainda não está marcada como resolvida/.test(wrap.textContent), "devia avisar que a arma atual (Captain) ainda não foi marcada, com Ancient/Intercessors por resolver");
});

run();
