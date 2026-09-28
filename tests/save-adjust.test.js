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

  c.woundAdjust = 1; // ajuste manual ao ferir (máximo permitido, ver teste do limite ±1 abaixo)
  const wrapWithAdjust = win.renderAttackCycle("fight");
  const textWithAdjust = wrapWithAdjust.textContent;
  assert(/≥4/.test(textWithAdjust), 'com ajuste ao Wound, o limiar do Anti-X continua "≥4", nunca desloca: ' + textWithAdjust.slice(0, 300));
});

// --- Item 1 (consolidado): Wound travado a ±1, Hit sem limite mas avisado --
test("Wound: o controlo de ajuste manual está travado a ±1 (regra 11ª: nunca modificado mais)", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Termagants");
  const tgt = addFullUnit(win, "playerB", "Intercessor Squad");
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = atk.id; c.weaponIdx = weaponByName(win, atk, "shooting", "Fleshborer"); c.targetId = tgt.id;
  c.step = 2; c.hits = 3;
  const wrap = win.renderAttackCycle("shooting");
  const adjustBtns = Array.from(wrap.querySelectorAll("button")).filter(b => b.textContent === "+");
  const woundPlus = adjustBtns[0]; // único passo de ajuste nesta tela é o do Wound
  for (let i = 0; i < 5; i++) woundPlus.click();
  assertEqual(win.__state.cycle.woundAdjust, 1, "5 cliques em + só deviam levar a +1, nunca mais");
});

test("Hit: sem limite no controlo, mas mostra aviso visível quando |ajuste| > 1", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Termagants");
  const tgt = addFullUnit(win, "playerB", "Intercessor Squad");
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = atk.id; c.weaponIdx = weaponByName(win, atk, "shooting", "Fleshborer"); c.targetId = tgt.id;
  c.step = 1; c.modelsAttacking = 10;
  c.hitAdjust = 1;
  let wrap = win.renderAttackCycle("shooting");
  assert(!/nunca permite modificar um hit roll/.test(wrap.textContent), "com +1 ainda não devia avisar");
  c.hitAdjust = 2;
  wrap = win.renderAttackCycle("shooting");
  assert(/nunca permite modificar um hit roll mais de -1\/\+1/.test(wrap.textContent), "com +2 devia mostrar o aviso");
  assertEqual(win.__state.cycle.hitAdjust, 2, "o Hit não trava o valor, só avisa");
});

// --- Aviso [PSYCHIC] no Hit quando há ajuste manual (só avisa, não bloqueia) --
function toHitStep(win, attacker, weaponName, target, phaseKey, extra) {
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = attacker.id; c.weaponIdx = weaponByName(win, attacker, phaseKey, weaponName); c.targetId = target.id;
  c.step = 1; c.modelsAttacking = 1;
  Object.assign(c, extra || {});
  return win.renderAttackCycle(phaseKey);
}

test("Arma PSYCHIC com ajuste manual ao Hit ≠ 0: mostra o aviso (sem bloquear o valor)", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Weirdboy"); // 'Eadbanger é PSYCHIC
  const tgt = addFullUnit(win, "playerB", "Intercessor Squad");
  let wrap = toHitStep(win, atk, "'Eadbanger", tgt, "shooting");
  assert(!/Arma PSYCHIC/.test(wrap.textContent), "sem ajuste manual não devia avisar");
  wrap = toHitStep(win, atk, "'Eadbanger", tgt, "shooting", { hitAdjust: -1 });
  assert(/Arma PSYCHIC — podes ignorar os modificadores a BS\/WS e ao hit roll, incluindo cobertura\./.test(wrap.textContent), "com ajuste -1 devia avisar");
  assertEqual(win.__state.cycle.hitAdjust, -1, "o aviso não bloqueia nem altera o valor");
});

test("Arma NÃO PSYCHIC com ajuste manual ao Hit: não mostra o aviso PSYCHIC", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Termagants");
  const tgt = addFullUnit(win, "playerB", "Intercessor Squad");
  const wrap = toHitStep(win, atk, "Fleshborer", tgt, "shooting", { hitAdjust: -1 });
  assert(!/Arma PSYCHIC/.test(wrap.textContent), "Fleshborer não é PSYCHIC");
});

test("Arma PSYCHIC com ajuste +2: mostra SÓ o aviso PSYCHIC, nunca o do limite ±1", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Weirdboy");
  const tgt = addFullUnit(win, "playerB", "Intercessor Squad");
  const wrap = toHitStep(win, atk, "'Eadbanger", tgt, "shooting", { hitAdjust: 2 });
  assert(!/nunca permite modificar um hit roll/.test(wrap.textContent), "numa arma PSYCHIC o aviso ±1 não devia aparecer");
  assert(/Arma PSYCHIC/.test(wrap.textContent), "aviso PSYCHIC");
});

// --- Lembrete de STEALTH no alvo (só tiro) -----------------------------------
test("Alvo com STEALTH (Von Ryan's Leapers) na Shooting: mostra o lembrete de cobertura", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Intercessor Squad");
  const tgt = addFullUnit(win, "playerB", "Von Ryan's Leapers");
  const wrap = toHitStep(win, atk, "Bolt rifle", tgt, "shooting", { modelsAttacking: 10, heavyStationary: false });
  assert(/Alvo com STEALTH — tem benefício de cobertura \(-1 ao BS do atacante\), mesmo sem terreno\./.test(wrap.textContent));
});

test("Alvo sem STEALTH: sem lembrete; alvo STEALTH em combate (WS): sem lembrete", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Intercessor Squad");
  const plain = addFullUnit(win, "playerB", "Gretchin");
  assert(!/STEALTH/.test(toHitStep(win, atk, "Bolt rifle", plain, "shooting", { modelsAttacking: 10, heavyStationary: false }).textContent));
  const stealthy = addFullUnit(win, "playerB", "Neurolictor");
  assert(!/Alvo com STEALTH/.test(toHitStep(win, atk, "Chainsword", stealthy, "fight", { modelsAttacking: 1 }).textContent), "cobertura só afeta o BS (tiro)");
  assert(/Alvo com STEALTH/.test(toHitStep(win, atk, "Bolt rifle", stealthy, "shooting", { modelsAttacking: 10, heavyStationary: false }).textContent), "Neurolictor também tem Stealth");
});

// --- Soma dos modificadores ao Wound travada a ±1 (11ª) ------------------------
function woundStepWith(win, atk, weaponName, tgt, phaseKey, extra) {
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = atk.id; c.weaponIdx = weaponByName(win, atk, phaseKey, weaponName); c.targetId = tgt.id;
  c.step = 2; c.hits = 3; c.modelsAttacking = 1;
  Object.assign(c, extra || {});
  return win.renderAttackCycle(phaseKey);
}
test("Wound: manual +1, Litany +1 e Saboteur +1 somam +3 mas o modificador efetivo é +1", () => {
  const win = loadApp();
  // Termagants (Tyranids) com uma Chaplain (meleeWoundBonus 1) no grupo, um
  // Neurolictor amigo e alvo Battle-shocked — combinação impossível no roster
  // real (Litany é SM, Saboteur é Tyranid), por isso montada à mão.
  const atk = addFullUnit(win, "playerA", "Termagants");
  const real = win.findRealUnit(atk.id);
  real.groups.push({ key: "leader", label: "Chaplain", datasheetName: "Chaplain with Jump Pack", stats: { W: 4, T: 4, SV: "3+" }, liveCount: 1, initialCount: 1, woundsRemainingOnCurrent: 4 });
  real.datasheetNames.push("Chaplain with Jump Pack");
  addFullUnit(win, "playerA", "Neurolictor");
  const tgt = addFullUnit(win, "playerB", "Ancient"); // T4
  win.findRealUnit(tgt.id).battleshocked = true;
  const wrap = woundStepWith(win, win.findInstance(atk.id), "Chitinous claws and teeth", tgt, "fight", { woundAdjust: 1, saboteurWound: true });
  // S3 vs T4 = 5+; +1 efetivo = 4+ (sem limite seria 2+)
  assertEqual(wrap.querySelector(".threshold-number").textContent, "4+");
  assert(/LIMITE ±1: modificadores somam \+3 → aplicado \+1/.test(wrap.textContent), "devia explicar o corte");
});
test("Wound: modificadores dentro de ±1 não mostram nenhum corte", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Termagants");
  const tgt = addFullUnit(win, "playerB", "Ancient");
  const wrap = woundStepWith(win, atk, "Fleshborer", tgt, "shooting", { woundAdjust: 1 });
  assert(!/LIMITE ±1/.test(wrap.textContent));
});
test("Wound: critThreshold do Anti-X não muda com o corte (Psychophage vs Librarian, +1 manual)", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Psychophage");
  const tgt = addFullUnit(win, "playerB", "Librarian");
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = atk.id; c.weaponIdx = weaponByName(win, atk, "fight", "Talons and betentacled maw"); c.targetId = tgt.id;
  c.step = 3; c.wounds = 3; c.woundAdjust = 1;
  assert(/≥4/.test(win.renderAttackCycle("fight").textContent));
});

// --- Stealth: escondido com [IGNORES COVER], mantido com [PSYCHIC] --------------
test("Lembrete de Stealth some quando a arma tem [IGNORES COVER]", () => {
  const win = loadApp();
  const ds = win.findDatasheet(win.__library, "Intercessor Squad");
  ds.ranged_weapons.find(w => w.name === "Bolt rifle").keywords.push("IGNORES COVER");
  const atk = addFullUnit(win, "playerA", "Intercessor Squad");
  const tgt = addFullUnit(win, "playerB", "Von Ryan's Leapers");
  const wrap = toHitStep(win, atk, "Bolt rifle", tgt, "shooting", { modelsAttacking: 10, heavyStationary: false });
  assert(!/Alvo com STEALTH/.test(wrap.textContent), "IGNORES COVER ignora o benefício de cobertura — sem lembrete");
});
test("Lembrete de Stealth mantém-se com [PSYCHIC] (ignorar é opcional)", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Weirdboy");
  const tgt = addFullUnit(win, "playerB", "Von Ryan's Leapers");
  const wrap = toHitStep(win, atk, "'Eadbanger", tgt, "shooting", { modelsAttacking: 1 });
  assert(/Alvo com STEALTH/.test(wrap.textContent));
});

run();
