// Correções do teste de 28/09: nota [IGNORES COVER], rótulos dos ajustes manuais
// (cobertura só no BS; nunca no save) e Intercessor Close-combat weapon sem PRECISION.
const { test, setFile, assert, assertEqual, run } = require("./tiny-test");
const { loadApp, addFullUnit, weaponByName, declineHail } = require("./helpers");
setFile("labels-and-notes.test.js");

function step(win, atk, wname, tgt, phase, extra) {
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = atk.id; c.weaponIdx = weaponByName(win, atk, phase, wname); c.targetId = tgt.id;
  c.modelsAttacking = 1; c.attacksRolled = 3;
  Object.assign(c, extra || {});
  declineHail(win, atk, tgt);
  return win.renderAttackCycle(phase);
}

test("Nota [IGNORES COVER]: texto da 11ª (cobertura = −1 ao BS; não mexe no save)", () => {
  const win = loadApp();
  const notes = win.weaponKeywordNotes({ keywords: ["IGNORES COVER"] });
  assertEqual(notes.length, 1);
  assertEqual(notes[0].text, "Esta arma ignora a cobertura — não apliques o −1 ao BS por o alvo estar coberto (11ª: a cobertura não mexe no save).");
});

test("Rótulos: Hit (tiro), Wound e Save — a cobertura só aparece no BS", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Termagants");
  const tgt = addFullUnit(win, "playerB", "Intercessor Squad");
  const hit = step(win, atk, "Fleshborer", tgt, "shooting", { step: 1, modelsAttacking: 5 });
  assert(hit.textContent.includes("BS (cobertura = −1, Plunging Fire = +1), sem limite:"), "rótulo do BS no tiro");
  const wound = step(win, atk, "Fleshborer", tgt, "shooting", { step: 2, hits: 3 });
  assert(wound.textContent.includes("Ajuste manual (stratagems, abilities):"), "rótulo do Wound");
  assert(!/cobertura/i.test(wound.textContent.replace(/[^.]*STEALTH[^.]*\./i, "")), "sem 'cobertura' no passo de Wound");
  const save = step(win, atk, "Fleshborer", tgt, "shooting", { step: 3, hits: 3, wounds: 2 });
  assert(save.textContent.includes("Ajuste manual (stratagems, abilities — a cobertura NÃO entra aqui, já está no BS):"), "rótulo do Save");
});

test("Rótulo por defeito dos ajustes já não menciona cobertura", () => {
  const win = loadApp();
  const step1 = win.renderNumberStep({ title: "x", threshold: 4, stepKey: "t", max: 3, adjust: { value: 0, onChange: () => {} }, onConfirm: () => {} });
  assert(step1.textContent.includes("Ajuste manual (stratagems, abilities):"));
  assert(!/cobertura/i.test(step1.textContent));
});

test("Intercessor Squad: Close-combat weapon sem PRECISION (datasheet 11ª)", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Intercessor Squad");
  const w = win.weaponsForPhase(atk, "fight").find(x => x.name === "Close-combat weapon");
  assert(w && !win.hasKeyword(w, "PRECISION"), "sem PRECISION");
});

run();
