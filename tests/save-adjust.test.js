// Ajuste manual no passo de Salvar (cobertura, stratagems, etc.) — só
// afeta a armour save, nunca a InvSv; piso de 2+; sem limite de ±1.
// Também confirma que o ajuste/aura do Wound nunca mexe no limiar do
// Anti-X (que usa sempre o dado não modificado), como pedido.
const { test, setFile, assert, assertEqual, run } = require("./tiny-test");
const { loadApp, addFullUnit, weaponByName } = require("./helpers");
setFile("save-adjust.test.js");

function toSaveStep(win, attacker, weaponName, target, phaseKey) {
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = attacker.id; c.weaponIdx = weaponByName(win, attacker, phaseKey, weaponName); c.targetId = target.id;
  c.step = 3; c.wounds = 2;
  return win.renderAttackCycle(phaseKey);
}
function explainText(wrap) {
  const nodes = Array.from(wrap.querySelectorAll(".step-hint"));
  const n = nodes.find(el => /→/.test(el.textContent));
  return n ? n.textContent : null;
}
function bigNumber(wrap) { return wrap.querySelector(".threshold-number").textContent; }

test("Sv 3+ AP-1, sem InvSv, ajuste +1 → 3+", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Intercessor Squad");
  const tgt = addFullUnit(win, "playerB", "Ancient");
  toSaveStep(win, atk, "Chainsword", tgt, "fight");
  win.__state.cycle.saveAdjust = 1;
  const wrap = win.renderAttackCycle("fight");
  assertEqual(bigNumber(wrap), "3+");
  assertEqual(explainText(wrap), "Sv 3+ com AP-1 → 4+, ajuste +1 → 3+");
});

test("Sv 4+ AP-3, sem ajuste, sem save possível (já existia, não pode partir)", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Land Speeder");
  const tgt = addFullUnit(win, "playerB", "Bigboss");
  const wrap = toSaveStep(win, atk, "Stormfury missile launcher", tgt, "shooting");
  assertEqual(explainText(wrap), "Sv 4+ com AP-3 → 7+, não há save possível");
});

test("Sv 4+ AP-3, ajuste +1 → 6+ (o save volta a ser possível)", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Land Speeder");
  const tgt = addFullUnit(win, "playerB", "Bigboss");
  toSaveStep(win, atk, "Stormfury missile launcher", tgt, "shooting");
  win.__state.cycle.saveAdjust = 1;
  const wrap = win.renderAttackCycle("shooting");
  assertEqual(bigNumber(wrap), "6+");
  assertEqual(explainText(wrap), "Sv 4+ com AP-3 → 7+, ajuste +1 → 6+");
});

test("Sv 3+ AP-3, InvSv 4+, ajuste +1 → usa InvSv 4+ (ajuste nunca toca na InvSv)", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Land Speeder");
  const tgt = addFullUnit(win, "playerB", "Captain with Relic Shield"); // Sv3+ InvSv4+
  toSaveStep(win, atk, "Stormfury missile launcher", tgt, "shooting");
  win.__state.cycle.saveAdjust = 1;
  const wrap = win.renderAttackCycle("shooting");
  assertEqual(bigNumber(wrap), "4+");
  assertEqual(explainText(wrap), "Sv 3+ com AP-3 → 6+, ajuste +1 → 5+; InvSv 4+ não é afetada pela AP → usa 4+");
});

test("Sv 2+ sem AP, ajuste +1 fica preso no piso de 2+ (1 natural falha sempre)", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Termagants");
  const tgt = addFullUnit(win, "playerB", "Screamer-Killer"); // Sv2+, sem InvSv
  toSaveStep(win, atk, "Chitinous claws and teeth", tgt, "fight"); // AP0
  win.__state.cycle.saveAdjust = 1;
  const wrap = win.renderAttackCycle("fight");
  assertEqual(bigNumber(wrap), "2+");
  assertEqual(explainText(wrap), "Sv 2+ com AP0 → 2+", "no piso, o ajuste não muda nada e não devia ser mencionado");
});

test("Sv 3+ AP-1, ajuste -1 (piora) → 5+", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Intercessor Squad");
  const tgt = addFullUnit(win, "playerB", "Ancient");
  toSaveStep(win, atk, "Chainsword", tgt, "fight");
  win.__state.cycle.saveAdjust = -1;
  const wrap = win.renderAttackCycle("fight");
  assertEqual(bigNumber(wrap), "5+");
  assertEqual(explainText(wrap), "Sv 3+ com AP-1 → 4+, ajuste -1 → 5+");
});

test("Ajuste sem limite de ±1: +3 aplica-se por inteiro (não é travado a +1 como o BS/WS)", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Land Speeder");
  const tgt = addFullUnit(win, "playerB", "Bigboss"); // Sv4+
  toSaveStep(win, atk, "Multi-melta", tgt, "shooting"); // AP-4
  win.__state.cycle.saveAdjust = 3;
  const wrap = win.renderAttackCycle("shooting");
  // Sv4 AP4 -> 8+, ajuste +3 -> 5+ (não travado a "no máximo +1")
  assertEqual(bigNumber(wrap), "5+");
});

// --- Confirma que o Anti-X continua a usar o dado NÃO modificado ----------
// Psychophage (Talons and betentacled maw: ANTI-PSYKER 4+ e DEVASTATING
// WOUNDS) vs Librarian (PSYKER) — o passo de contar críticos (que decide
// quantos viram mortal wounds automáticas) tem de pedir sempre "≥4",
// mesmo com um ajuste manual grande ao Wound roll, porque o Anti-X usa o
// resultado NÃO modificado do dado, nunca o limiar já ajustado.
test("Anti-X: o limiar de crítico (Devastating Wounds) não muda com ajuste manual ao Wound", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Psychophage");
  const tgt = addFullUnit(win, "playerB", "Librarian"); // PSYKER
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = atk.id; c.weaponIdx = weaponByName(win, atk, "fight", "Talons and betentacled maw"); c.targetId = tgt.id;
  c.step = 3; c.wounds = 3;
  const wrapNoAdjust = win.renderAttackCycle("fight");
  const textNoAdjust = wrapNoAdjust.textContent;
  assert(/≥4/.test(textNoAdjust), 'sem ajuste devia pedir "≥4": ' + textNoAdjust.slice(0, 300));

  c.woundAdjust = 2; // ajuste manual grande ao ferir, aplicado ANTES deste passo
  const wrapWithAdjust = win.renderAttackCycle("fight");
  const textWithAdjust = wrapWithAdjust.textContent;
  assert(/≥4/.test(textWithAdjust), 'com ajuste ao Wound, o limiar do Anti-X continua "≥4", nunca desloca: ' + textWithAdjust.slice(0, 300));
});

run();
