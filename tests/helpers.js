// Helpers partilhados pelos testes — montam o estado mínimo necessário para
// chegar ao passo de hits do ciclo de ataque sem passar pelo picker (que é
// só UI), usando sempre as funções REAIS do index.html (window.*).
const { loadApp } = require("./load-app");

function findDatasheetByName(win, name) {
  const ds = win.findDatasheet(win.__library, name);
  if (!ds) throw new Error('Datasheet "' + name + '" não encontrada na library.');
  return ds;
}

// Adiciona uma unidade a full-strength (todos os modelos vivos) a um
// jogador e devolve a instância REAL guardada em state.setup (não a cópia
// de allInstances()), para os testes poderem ler groups[].liveCount.
function addFullUnit(win, playerKey, datasheetName, opts) {
  const ds = findDatasheetByName(win, datasheetName);
  win.addUnitToPlayer(playerKey, ds, opts || {});
  const units = win.__state.setup[playerKey].units;
  return units[units.length - 1];
}

function weaponByName(win, instance, phaseKey, weaponName) {
  const weapons = win.weaponsForPhase(instance, phaseKey);
  const idx = weapons.findIndex(w => w.name === weaponName);
  if (idx === -1) {
    throw new Error('Arma "' + weaponName + '" não encontrada em ' + phaseKey + ' para ' + instance.datasheetNames.join("+") + ". Armas disponíveis: " + weapons.map(w => w.name).join(", "));
  }
  return idx;
}

// Prepara state.cycle para ir DIRETO ao passo de hits (step 1) de um dado
// ataque, saltando o picker (UI pura) — espelha exatamente os campos que o
// picker preenche antes de chamar renderAttackCycle.
function setupCycle(win, { attacker, weaponIdx, target, phaseKey, modelsAttacking, attacksRolled, heavyStationary, chargedThisTurn }) {
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = attacker.id;
  c.weaponIdx = weaponIdx;
  c.targetId = target.id;
  c.step = 1;
  if (modelsAttacking !== undefined) c.modelsAttacking = modelsAttacking;
  if (attacksRolled !== undefined) c.attacksRolled = attacksRolled;
  if (heavyStationary !== undefined) c.heavyStationary = heavyStationary;
  if (chargedThisTurn !== undefined) c.chargedThisTurn = chargedThisTurn;
  return win.renderAttackCycle(phaseKey);
}

// Extrai o texto "🎲 Lança N dado(s)." do card renderizado (renderNumberStep
// só o mostra quando rollsDice:true e max não é null) — é o número exato
// que o jogador vê no ecrã para saber quantos dados físicos lançar.
function diceCallCount(wrapEl) {
  const nodes = wrapEl.querySelectorAll(".dice-call");
  if (nodes.length === 0) return null;
  const text = nodes[nodes.length - 1].textContent;
  const m = text.match(/Lança (\d+) dado/);
  if (!m) throw new Error('Texto de dice-call inesperado: "' + text + '"');
  return parseInt(m[1], 10);
}

function stepTitle(wrapEl) {
  const h3 = wrapEl.querySelector("h3");
  return h3 ? h3.textContent : null;
}

// Alvo sintético, fora do BOX_LIMITS (que é global aos dois jogadores) —
// para testes que só chegam ao passo de hits (step 1) e nunca tocam em
// wound/save, evita colidir com o limite de miniaturas de QUALQUER
// datasheet real usada como atacante no mesmo teste ou numa varredura que
// testa todas as datasheets como atacante (attack-math-audit.test.js).
function addDummyTarget(win, playerKey) {
  const inst = {
    id: "dummy-target-" + playerKey,
    datasheetNames: ["__DummyTarget__"],
    faction: "Space Marines",
    label: "Dummy Target",
    points: 0,
    battleshocked: false,
    disrupted: false,
    groups: [{
      key: "main", label: "Dummy Target", datasheetName: "__DummyTarget__",
      stats: { M: "6\"", T: 4, SV: "3+", W: 20, LD: "6+", OC: 1 },
      liveCount: 20, initialCount: 20, woundsRemainingOnCurrent: 20,
    }],
  };
  win.__state.setup[playerKey].units.push(inst);
  return inst;
}

module.exports = { loadApp, findDatasheetByName, addFullUnit, weaponByName, setupCycle, diceCallCount, stepTitle, addDummyTarget };
