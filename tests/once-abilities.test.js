// Bug 6 (playtest 16-17 Set 2026): abilities "once per battle"/"once per
// battle round" (Captain: Finest Hour, Rites of Battle) não eram lembradas
// em lado nenhum — o jogador tinha de as gerir de cabeça. A app agora só
// LEMBRA que existem (com um checkbox "já usei"), nunca decide sozinha
// quando disparam nem aplica o efeito — como pedido explicitamente.
const { test, setFile, assert, assertEqual, run } = require("./tiny-test");
const { loadApp, addFullUnit } = require("./helpers");

setFile("once-abilities.test.js");

function textOf(node) { return node ? node.textContent : ""; }

test("Sem Captain em jogo, nenhuma fase mostra o cartão de once-abilities", () => {
  const win = loadApp();
  addFullUnit(win, "playerA", "Intercessor Squad"); // sem líder
  assertEqual(win.renderOnceAbilitiesCard("combat", "x"), null, "sem onceAbilities no campo, não deve haver cartão");
  assertEqual(win.renderOnceAbilitiesCard("stratagem", "x"), null, "sem onceAbilities no campo, não deve haver cartão");
});

test("Captain em jogo: Fight phase mostra Finest Hour (combat) e Rites of Battle (stratagem)", () => {
  const win = loadApp();
  addFullUnit(win, "playerA", "Intercessor Squad", { leaderDs: win.findDatasheet(win.__library, "Captain with Relic Shield") });
  const combatCard = win.renderOnceAbilitiesCard("combat", "Combate");
  const stratCard = win.renderOnceAbilitiesCard("stratagem", "Stratagems");
  assert(combatCard && /Finest Hour/.test(textOf(combatCard)), "devia listar Finest Hour no cartão de combate");
  assert(stratCard && /Rites of Battle/.test(textOf(stratCard)), "devia listar Rites of Battle no cartão de stratagems");
  assert(!/Rites of Battle/.test(textOf(combatCard)), "Rites of Battle é kind:stratagem, não devia aparecer no cartão de combate");
  assert(!/Finest Hour/.test(textOf(stratCard)), "Finest Hour é kind:combat, não devia aparecer no cartão de stratagems");
});

test("Marcar Finest Hour como usada (scope battle) mantém-se usada mesmo mudando de ronda", () => {
  const win = loadApp();
  addFullUnit(win, "playerA", "Intercessor Squad", { leaderDs: win.findDatasheet(win.__library, "Captain with Relic Shield") });
  const unit = win.__state.setup.playerA.units[0];
  const ds = win.findDatasheet(win.__library, "Captain with Relic Shield");
  const finestHourIdx = ds.onceAbilities.findIndex(a => a.kind === "combat");
  const key = win.onceAbilityKey(unit, ds, finestHourIdx);
  const ability = ds.onceAbilities[finestHourIdx];

  assertEqual(win.isOnceAbilityUsed(key, ability), false, "ainda não foi marcada");
  win.toggleOnceAbilityUsed(key, ability);
  assertEqual(win.isOnceAbilityUsed(key, ability), true, "depois de marcar, devia ficar usada");

  win.__state.game.round = 2; // nova ronda de batalha
  assertEqual(win.isOnceAbilityUsed(key, ability), true, "scope 'battle' não reseta com a ronda — só 1x por jogo inteiro");
});

test("Marcar Rites of Battle como usada (scope battle_round) reseta ao mudar de ronda", () => {
  const win = loadApp();
  addFullUnit(win, "playerA", "Intercessor Squad", { leaderDs: win.findDatasheet(win.__library, "Captain with Relic Shield") });
  const unit = win.__state.setup.playerA.units[0];
  const ds = win.findDatasheet(win.__library, "Captain with Relic Shield");
  const ritesIdx = ds.onceAbilities.findIndex(a => a.kind === "stratagem");
  const key = win.onceAbilityKey(unit, ds, ritesIdx);
  const ability = ds.onceAbilities[ritesIdx];

  win.toggleOnceAbilityUsed(key, ability);
  assertEqual(win.isOnceAbilityUsed(key, ability), true, "depois de marcar nesta ronda, devia ficar usada");

  win.__state.game.round = 2;
  assertEqual(win.isOnceAbilityUsed(key, ability), false, "scope 'battle_round' reseta ao mudar de ronda — pode voltar a usar-se");
});

test("O cartão de stratagems aparece na Command/Movement/Charge phase, não só na Fight", () => {
  const win = loadApp();
  addFullUnit(win, "playerA", "Intercessor Squad", { leaderDs: win.findDatasheet(win.__library, "Captain with Relic Shield") });
  const command = win.renderCommandPhase();
  const movement = win.renderMovementPhase();
  const charge = win.renderChargePhase();
  assert(/Rites of Battle/.test(textOf(command)), "Command phase devia lembrar Rites of Battle");
  assert(/Rites of Battle/.test(textOf(movement)), "Movement phase devia lembrar Rites of Battle");
  assert(/Rites of Battle/.test(textOf(charge)), "Charge phase devia lembrar Rites of Battle");
});

run();
