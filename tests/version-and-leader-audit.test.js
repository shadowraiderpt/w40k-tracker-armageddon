// Pedido 01/10/2026: remover o comentário/campos órfãos do Alpha Warrior antigo,
// acrescentar keywords do Winged Tyranid Prime (Wahapedia 11ª) e mostrar a
// versão da app no rodapé.
const { test, setFile, assert, assertEqual, run } = require("./tiny-test");
const { loadApp, addFullUnit } = require("./helpers");
setFile("version-and-leader-audit.test.js");

test("Winged Tyranid Prime: keywords FLY, GREAT DEVOURER, SYNAPSE, VANGUARD INVADER (Wahapedia 11ª)", () => {
  const win = loadApp();
  const ds = win.findDatasheet(win.__library, "Winged Tyranid Prime");
  ["INFANTRY", "CHARACTER", "FLY", "GREAT DEVOURER", "SYNAPSE", "VANGUARD INVADER"].forEach(k =>
    assert(ds.keywords.includes(k), "falta " + k));
});

test("Campos órfãos do Alpha Warrior antigo (reroll de 1s) já não existem em state.game", () => {
  const win = loadApp();
  assert(!("alphaWarriorAskedInstance" in win.__state.game), "alphaWarriorAskedInstance devia ter sido removido");
  assert(!("alphaWarriorTargetId" in win.__state.game), "alphaWarriorTargetId devia ter sido removido");
});

test("Rodapé mostra 'Versão: ' + APP_VERSION", () => {
  const win = loadApp();
  const footer = win.document.querySelector(".app-footer");
  assert(footer, "devia haver um rodapé");
  assertEqual(footer.textContent, "Versão: " + win.APP_VERSION);
});

run();
