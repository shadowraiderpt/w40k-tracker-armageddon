// Bug A (Pedido Mestre 28/09/2026): CRASH com DEVASTATING WOUNDS e 0 wounds —
// "Cannot read properties of null (reading 'main')" no ecrã de resultado
// (c.deadByGroup nunca era calculado quando c.wounds === 0). Cobre TODAS as
// armas com DEVASTATING WOUNDS dos dados (descobertas automaticamente).
const { test, setFile, assert, assertEqual, run } = require("./tiny-test");
const { loadApp, addFullUnit, weaponByName } = require("./helpers");
setFile("bug-a-devastating-zero.test.js");

const TARGETS = ["Intercessor Squad", "Termagants", "Land Speeder"];

function devWoundsWeapons() {
  const win = loadApp();
  const out = [];
  Object.keys(win.__RAW_UNITS).forEach(f => win.__RAW_UNITS[f].forEach(u => {
    [["ranged_weapons", "shooting"], ["melee_weapons", "fight"]].forEach(([k, phase]) => {
      (u[k] || []).forEach(w => {
        if ((w.keywords || []).some(x => /^DEVASTATING WOUNDS/.test(x))) out.push({ unit: u.name, weapon: w.name, phase });
      });
    });
  }));
  return out;
}

devWoundsWeapons().forEach(({ unit, weapon, phase }) => {
  TARGETS.forEach(targetName => {
    if (targetName === unit) return;
    test("Bug A: " + unit + " — " + weapon + " vs " + targetName + " com 0 wounds não rebenta e dá 0 mortos", () => {
      const win = loadApp();
      const atk = addFullUnit(win, "playerA", unit);
      const tgt = addFullUnit(win, "playerB", targetName);
      win.__state.cycle = win.__emptyCycle();
      const c = win.__state.cycle;
      c.attackerId = atk.id; c.weaponIdx = weaponByName(win, atk, phase, weapon); c.targetId = tgt.id;
      c.modelsAttacking = 1; c.step = 3; c.hits = 0; c.wounds = 0;
      // Hazardous / Blast etc. podem pedir passos antes do resultado — o que
      // importa é que nenhum render lance exceção e que nunca haja mortos.
      for (let i = 0; i < 3; i++) win.renderAttackCycle(phase);
      const dead = Object.values(c.deadByGroup || {}).reduce((a, b) => a + b, 0);
      assertEqual(dead, 0, "0 wounds → 0 mortos");
    });
  });
});

run();
