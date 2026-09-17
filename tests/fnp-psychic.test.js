// Bug 4 (playtest 16-17 Set 2026): o Psychic Hood do Librarian ("Feel No
// Pain 4+ vs ataques psíquicos") só pode disparar quando a ARMA ATACANTE
// tem mesmo a keyword [PSYCHIC] no perfil — nunca por o nome soar psíquico
// (ex: "Psychoclastic Torrent" do Psychophage não tem a keyword). Também
// confirma que isto não depende de QUAL modelo do alvo (Librarian anexado a
// Intercessor Squad) está a sofrer o dano — a ability é da unidade toda.
const { test, setFile, assert, run } = require("./tiny-test");
const { loadApp, addFullUnit, weaponByName, findDatasheetByName } = require("./helpers");

setFile("fnp-psychic.test.js");

const FNP_TITLE = /Feel No Pain .+ — quantos passaram\?/;

// Monta um ataque já em step 5 (resultado), com 1 morte já calculada num
// grupo do alvo — o mínimo para o bloco de Feel No Pain do step 5 decidir
// se pergunta o roll ou não. Evita todos os passos 1-4 (hits/wounds/saves),
// que são só UI, para testar diretamente a condição da ability.
function renderStep5With1Dead(win, { attackerDs, attackerPlayerKey, weaponName, phaseKey, target, deadGroupKey }) {
  const attackerDatasheet = findDatasheetByName(win, attackerDs);
  win.addUnitToPlayer(attackerPlayerKey, attackerDatasheet, {});
  const units = win.__state.setup[attackerPlayerKey].units;
  const attacker = units[units.length - 1];
  const weaponIdx = weaponByName(win, attacker, phaseKey, weaponName);

  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = attacker.id;
  c.weaponIdx = weaponIdx;
  c.targetId = target.id;
  c.step = 5;
  c.hits = 1;
  c.deadByGroup = { [deadGroupKey]: 1 };
  return win.renderAttackCycle(phaseKey);
}

function addLibrarianIntercessorTarget(win, playerKey) {
  const librarianDs = findDatasheetByName(win, "Librarian");
  const intercessorDs = findDatasheetByName(win, "Intercessor Squad");
  win.addUnitToPlayer(playerKey, intercessorDs, { leaderDs: librarianDs });
  const units = win.__state.setup[playerKey].units;
  return units[units.length - 1];
}

test("Psychophage ataca com Psychoclastic torrent (sem [PSYCHIC]) — Psychic Hood NÃO dispara", () => {
  const win = loadApp();
  const target = addLibrarianIntercessorTarget(win, "playerB");
  const mainGroupKey = target.groups.find(g => g.key !== "leader").key;
  const wrap = renderStep5With1Dead(win, {
    attackerDs: "Psychophage", attackerPlayerKey: "playerA",
    weaponName: "Psychoclastic torrent", phaseKey: "shooting",
    target, deadGroupKey: mainGroupKey,
  });
  assert(!FNP_TITLE.test(wrap.textContent), "Psychoclastic torrent não tem [PSYCHIC] — não devia oferecer o roll de Feel No Pain do Psychic Hood");
});

test("Weirdboy ataca com 'Eadbanger (tem [PSYCHIC]) — Psychic Hood dispara", () => {
  const win = loadApp();
  const target = addLibrarianIntercessorTarget(win, "playerB");
  const mainGroupKey = target.groups.find(g => g.key !== "leader").key;
  const wrap = renderStep5With1Dead(win, {
    attackerDs: "Weirdboy", attackerPlayerKey: "playerA",
    weaponName: "'Eadbanger", phaseKey: "shooting",
    target, deadGroupKey: mainGroupKey,
  });
  assert(FNP_TITLE.test(wrap.textContent), "'Eadbanger tem [PSYCHIC] — devia oferecer o roll de Feel No Pain do Psychic Hood");
});

test("A morte a cancelar pode ser no grupo do Librarian (líder) — Psychic Hood continua a aplicar-se à unidade toda", () => {
  const win = loadApp();
  const target = addLibrarianIntercessorTarget(win, "playerB");
  const wrap = renderStep5With1Dead(win, {
    attackerDs: "Weirdboy", attackerPlayerKey: "playerA",
    weaponName: "'Eadbanger", phaseKey: "shooting",
    target, deadGroupKey: "leader",
  });
  assert(FNP_TITLE.test(wrap.textContent), "a keyword [PSYCHIC] da arma é a única condição — não deve importar em qual grupo (líder ou tropa) caiu a morte");
});

run();
