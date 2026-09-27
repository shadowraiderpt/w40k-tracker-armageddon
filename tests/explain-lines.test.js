// Linha explicativa nos passos de Ferir e Salvar — só apresentação, usa as
// mesmas variáveis já calculadas para o limiar, nunca recalcula nada.
const { test, setFile, assert, assertEqual, run } = require("./tiny-test");
const { loadApp, addFullUnit, weaponByName } = require("./helpers");
setFile("explain-lines.test.js");

function toWoundStep(win, attacker, weaponName, target, phaseKey) {
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = attacker.id; c.weaponIdx = weaponByName(win, attacker, phaseKey, weaponName); c.targetId = target.id;
  c.step = 2; c.hits = 3;
  return win.renderAttackCycle(phaseKey);
}
function explainText(wrap) {
  const nodes = Array.from(wrap.querySelectorAll(".step-hint"));
  const n = nodes.find(el => /→/.test(el.textContent));
  return n ? n.textContent : null;
}

test("Ferir: S4 vs T9 (Psychophage) — T é o dobro ou mais de S → 6+", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Intercessor Squad"); // Bolt rifle S4
  const tgt = addFullUnit(win, "playerB", "Psychophage"); // T9
  const wrap = toWoundStep(win, atk, "Bolt rifle", tgt, "shooting");
  assertEqual(explainText(wrap), "T9 é o dobro ou mais de S4 → 6+");
});

test("Ferir: S4 vs T4 — igual → 4+", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Intercessor Squad"); // Bolt rifle S4
  const tgt = addFullUnit(win, "playerB", "Ancient"); // T4
  const wrap = toWoundStep(win, atk, "Bolt rifle", tgt, "shooting");
  assertEqual(explainText(wrap), "S4 igual a T4 → 4+");
});

test("Ferir: S5 vs T4 — maior → 3+", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Termagants"); // Fleshborer S5
  const tgt = addFullUnit(win, "playerB", "Intercessor Squad"); // T4
  const wrap = toWoundStep(win, atk, "Fleshborer", tgt, "shooting");
  assertEqual(explainText(wrap), "S5 é maior que T4 → 3+");
});

test("Ferir: S8 vs T4 — dobro → 2+", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Warboss"); // Kustom choppa S8 (melee)
  const tgt = addFullUnit(win, "playerB", "Intercessor Squad"); // T4
  const wrap = toWoundStep(win, atk, "Kustom choppa", tgt, "fight");
  assertEqual(explainText(wrap), "S8 é o dobro ou mais de T4 → 2+");
});

test("Ferir: ajuste manual reflete-se na linha sem contradizer o número mostrado", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Termagants");
  const tgt = addFullUnit(win, "playerB", "Intercessor Squad");
  toWoundStep(win, atk, "Fleshborer", tgt, "shooting");
  win.__state.cycle.woundAdjust = 1;
  const wrap2 = win.renderAttackCycle("shooting");
  const line = explainText(wrap2);
  assertEqual(line, "S5 é maior que T4 → 3+, ajuste +1 → 2+");
  assertEqual(wrap2.querySelector(".threshold-number").textContent, "2+");
});

function toSaveStep(win, attacker, weaponName, target, phaseKey) {
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = attacker.id; c.weaponIdx = weaponByName(win, attacker, phaseKey, weaponName); c.targetId = target.id;
  c.step = 3; c.wounds = 2;
  return win.renderAttackCycle(phaseKey);
}

test("Salvar: Sv 3+ com AP-1, sem InvSv → 4+", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Intercessor Squad"); // Chainsword AP-1
  const tgt = addFullUnit(win, "playerB", "Ancient"); // Sv3+, sem InvSv
  const wrap = toSaveStep(win, atk, "Chainsword", tgt, "fight");
  assertEqual(explainText(wrap), "Sv 3+ com AP-1 → 4+");
});

test("Salvar: Sv 3+ com AP-3, InvSv 4+ pior que o modificado → usa InvSv 4+", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Land Speeder"); // Stormfury missile launcher AP-3
  const tgt = addFullUnit(win, "playerB", "Captain with Relic Shield"); // Sv3+ InvSv4+
  const wrap = toSaveStep(win, atk, "Stormfury missile launcher", tgt, "shooting");
  assertEqual(explainText(wrap), "Sv 3+ com AP-3 → 6+; InvSv 4+ não é afetada pela AP → usa 4+");
});

test("Salvar: Sv 3+ com AP0, InvSv 4+ pior que o normal → usa Sv 3+", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Termagants"); // Fleshborer AP0
  const tgt = addFullUnit(win, "playerB", "Captain with Relic Shield"); // Sv3+ InvSv4+
  const wrap = toSaveStep(win, atk, "Fleshborer", tgt, "shooting");
  assertEqual(explainText(wrap), "Sv 3+ com AP0 → 3+; melhor que a InvSv 4+ → usa 3+");
});

test("Ferir: Anti-X tem frase própria (crítico), nunca a palavra 'ajuste', quando o alvo tem a keyword", () => {
  const win = loadApp();
  const line = win.woundExplainLine({ S: 4 }, 5, 4, true, { targetKeyword: "INFANTRY", threshold: 4 });
  assertEqual(line, "S4 é menor que T5 → 5+; ANTI-INFANTRY 4+ → um 4+ ou mais fere sempre (crítico)");
  assert(!/ajuste/.test(line), "Anti-X não é um ajuste");
});

test("Ferir: Anti-X + ajuste manual por cima — a cláusula do Anti-X não é reescrita, o ajuste soma-se a seguir", () => {
  const win = loadApp();
  const line = win.woundExplainLine({ S: 4 }, 5, 3, true, { targetKeyword: "INFANTRY", threshold: 4 });
  assertEqual(line, "S4 é menor que T5 → 5+; ANTI-INFANTRY 4+ → um 4+ ou mais fere sempre (crítico), ajuste +1 → 3+");
});

test("Ferir: sem a keyword do Anti-X, a linha fica só a comparação normal", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Painboy"); // 'Urty syringe: ANTI-INFANTRY 4+, S2
  const tgt = addFullUnit(win, "playerB", "Land Speeder"); // VEHICLE, não INFANTRY
  const wrap = toWoundStep(win, atk, "'Urty syringe", tgt, "fight");
  const line = explainText(wrap);
  assert(!/ANTI-/.test(line), 'sem a keyword INFANTRY não devia mencionar Anti-X: "' + line + '"');
});

test("Ferir: com a keyword do Anti-X (Warboss é INFANTRY), a linha mostra a cláusula do crítico, via o ciclo real", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Painboy"); // 'Urty syringe: ANTI-INFANTRY 4+, S2
  const tgt = addFullUnit(win, "playerB", "Warboss"); // INFANTRY, T5
  const wrap = toWoundStep(win, atk, "'Urty syringe", tgt, "fight");
  const line = explainText(wrap);
  assertEqual(line, "T5 é o dobro ou mais de S2 → 6+; ANTI-INFANTRY 4+ → um 4+ ou mais fere sempre (crítico)");
});

test("Salvar: quando fica impossível (>6), diz-o explicitamente", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Land Speeder"); // Stormfury missile launcher AP-3
  const tgt = addFullUnit(win, "playerB", "Bigboss"); // Sv4+, sem InvSv
  const wrap = toSaveStep(win, atk, "Stormfury missile launcher", tgt, "shooting");
  assertEqual(explainText(wrap), "Sv 4+ com AP-3 → 7+, não há save possível");
});

run();
