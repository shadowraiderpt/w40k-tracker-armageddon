// Bug 1 (playtest 16-17 Set 2026), auditoria completa: para TODAS as
// datasheets das 3 facções (armageddon_units.json / RAW_UNITS), cada arma
// com Attacks FIXO tem de pedir attacks_por_modelo × modelos_vivos dados —
// não só nos casos apanhados ao vivo (Termagants, Eradicators), mas em
// todas as unidades multi-modelo do jogo.
const { test, setFile, assertEqual, run } = require("./tiny-test");
const { loadApp, addFullUnit, weaponByName, setupCycle, diceCallCount, addDummyTarget } = require("./helpers");

setFile("attack-math-audit.test.js");

function auditWeapon(datasheetName, phaseKey, weaponName) {
  test("[audit] " + datasheetName + " — " + weaponName + " (" + phaseKey + ")", () => {
    const win = loadApp();
    const attacker = addFullUnit(win, "playerA", datasheetName);
    const target = addDummyTarget(win, "playerB");
    const weaponIdx = weaponByName(win, attacker, phaseKey, weaponName);
    const weapon = win.weaponsForPhase(attacker, phaseKey)[weaponIdx];
    const maxModels = win.maxModelsAttacking(attacker, weapon);
    assertEqual(typeof weapon.A, "number", "esta função de auditoria só cobre Attacks fixo — " + weaponName + " tem A:" + weapon.A);
    const isTorrent = phaseKey === "shooting" && win.hasKeyword(weapon, "TORRENT");
    const wrap = setupCycle(win, {
      attacker, weaponIdx, target, phaseKey, modelsAttacking: maxModels,
      heavyStationary: true, chargedThisTurn: true,
    });
    const expected = weapon.A * maxModels;
    if (isTorrent) {
      // TORRENT não rola hits (acerta sempre) — o campo é de valor único,
      // sem "dice-call"; o que importa é o teto (max) aceite no campo.
      const input = wrap.querySelector("input[type=number]");
      assertEqual(input && Number(input.max), expected, weaponName + ": " + maxModels + " modelos × A:" + weapon.A + " devia aceitar até " + expected);
    } else {
      assertEqual(diceCallCount(wrap), expected, weaponName + ": " + maxModels + " modelos × A:" + weapon.A + " devia pedir " + expected + " dados");
    }
  });
}

// Percorre as 3 facções e todas as datasheets, testando só as armas com
// Attacks fixo (as de Attacks aleatório já têm cobertura dedicada em
// attack-math.test.js, com as suas próprias regras de "1 roll por modelo").
function auditAllFixedAttackWeapons() {
  const win = loadApp();
  ["space_marines", "orks", "tyranids"].forEach(factionKey => {
    (win.__RAW_UNITS[factionKey] || []).forEach(ds => {
      (ds.ranged_weapons || []).forEach(w => {
        if (typeof w.A === "number") auditWeapon(ds.name, "shooting", w.name);
      });
      (ds.melee_weapons || []).forEach(w => {
        if (typeof w.A === "number") auditWeapon(ds.name, "fight", w.name);
      });
    });
  });
}

auditAllFixedAttackWeapons();
run();
