// Pedido Mestre 28/09/2026 — auditoria de dados 11ª (Wahapedia/BSData) e bugs C, D, E.
// (Bug A tem o seu ficheiro: bug-a-devastating-zero.test.js.)
const { test, setFile, assert, assertEqual, run } = require("./tiny-test");
const { loadApp, addFullUnit, weaponByName, setupCycle, diceCallCount, addDummyTarget, declineHail } = require("./helpers");
setFile("mestre-data-and-bugs.test.js");

function weapon(win, unit, phase, name) { return win.weaponsForPhase(unit, phase).find(w => w.name === name); }
function stepCycle(win, atk, wname, tgt, phase, extra) {
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = atk.id; c.weaponIdx = weaponByName(win, atk, phase, wname); c.targetId = tgt.id;
  Object.assign(c, extra || {});
  return c;
}

// ---------------- dados ----------------
test("Todas as unidades têm source, verifiedAt e pointsSource; a versão das regras vem dos dados", () => {
  const win = loadApp();
  let n = 0;
  Object.keys(win.__RAW_UNITS).forEach(f => win.__RAW_UNITS[f].forEach(u => {
    n++;
    assert(u.source && u.verifiedAt === "2026-09-28" && u.pointsSource, u.name + " sem campos de fonte");
  }));
  assertEqual(n, 30);
  assert(/Regras: versão de 2026-09-28/.test(win.document.getElementById("rules-version").textContent));
});

test("Pontos por confirmar: ⚠️ aparece nas unidades com pointsSource POR CONFIRMAR e não nas outras", () => {
  const win = loadApp();
  const wb = addFullUnit(win, "playerA", "Warboss");
  const erad = addFullUnit(win, "playerA", "Eradicator Squad with Heavy Bolters");
  assert(win.findRealUnit(wb.id).pointsUnconfirmed.length === 1);
  assert(win.findRealUnit(erad.id).pointsUnconfirmed.length === 0);
});

test("Space Marines 11ª: Captain W6 GRENADES; Chaplain Absolvor 18\" D2; Ancient FNP só no modelo; Vanguard plasma supercharge A1; Heavy Flamer IGNORES COVER", () => {
  const win = loadApp();
  const cap = win.findDatasheet(win.__library, "Captain with Relic Shield");
  assertEqual(cap.stats.W, 6);
  ["INFANTRY", "CHARACTER", "GRENADES", "IMPERIUM", "TACTICUS", "CAPTAIN"].forEach(k => assert(cap.keywords.includes(k), "Captain sem " + k));
  const chap = addFullUnit(win, "playerA", "Chaplain with Jump Pack");
  const ab = weapon(win, chap, "shooting", "Absolvor bolt pistol");
  assertEqual(ab.range + "/" + ab.D, '18"/2');
  assertEqual(win.findDatasheet(win.__library, "Ancient").fnpScope, "model");
  assertEqual(win.findDatasheet(win.__library, "Librarian").fnpScope, "unit");
  const vg = addFullUnit(win, "playerA", "Vanguard Veteran Squad with Jump Packs");
  assertEqual(weapon(win, vg, "shooting", "Plasma pistol - supercharge").A, 1);
  const ls = addFullUnit(win, "playerA", "Land Speeder");
  assert(win.hasKeyword(weapon(win, ls, "shooting", "Heavy Flamer"), "IGNORES COVER"));
});

test("Mental Fortress (\"while leading\"): sem InvSv próprio; sozinho não há aura; anexado dá 4+ à unidade, mesmo sem escolta viva", () => {
  const win = loadApp();
  const lib = win.findDatasheet(win.__library, "Librarian");
  assert(!lib.stats.InvSV, "InvSv vem do Mental Fortress, não do modelo");
  const solo = addFullUnit(win, "playerA", "Librarian");
  assertEqual(win.invSvAuraFor(solo), null, "Bug F regra 2: Leader sozinho não lidera");
  const win2 = loadApp();
  win2.addUnitToPlayer("playerA", win2.findDatasheet(win2.__library, "Intercessor Squad"), { leaderDs: win2.findDatasheet(win2.__library, "Librarian") });
  const unit = win2.__state.setup.playerA.units[0];
  assertEqual(win2.invSvAuraFor(unit).value, 4);
  unit.groups.find(g => g.key !== "leader").liveCount = 0; // escolta toda morta
  assertEqual(win2.invSvAuraFor(unit).value, 4, "regra 1: continua a liderar enquanto vivo");
  unit.groups.find(g => g.key === "leader").liveCount = 0;
  assertEqual(win2.invSvAuraFor(unit), null, "Librarian morto: sem aura");
});

test("Orks 11ª: Bigboss/Bannernob/Painboy/Weirdboy são Support de Boyz (não Leader)", () => {
  const win = loadApp();
  ["Bigboss", "Bannernob", "Painboy", "Weirdboy"].forEach(n => {
    const ds = win.findDatasheet(win.__library, n);
    assert((ds.support_for || []).includes("Boyz") && !ds.leader_for, n + " devia ser support_for Boyz");
  });
  assert((win.findDatasheet(win.__library, "Warboss").leader_for || []).includes("Boyz"), "Warboss continua Leader");
});

test("Orks 11ª: Gretchin Sv6+ OC1; Wartrakks (nome exato) armas 11ª; Boyz S5, Nob W3 e Big choppa A4 CLEAVE 2; Bannernob OC3 sem InvSv", () => {
  const win = loadApp();
  const g = win.findDatasheet(win.__library, "Gretchin");
  assertEqual(g.stats.SV + "/" + g.stats.OC, "6+/1");
  assert(win.findDatasheet(win.__library, "Wartrakk") === undefined, "o nome antigo Wartrakk já não existe");
  const wt = addFullUnit(win, "playerA", "Wartrakks");
  const ks = weapon(win, wt, "shooting", "Kustom Shoota");
  assertEqual(ks.A, 4);
  assert(win.hasKeyword(ks, "LETHAL HITS") && win.hasKeyword(ks, "RAPID FIRE 2"));
  assertEqual(weapon(win, wt, "shooting", "Multi-busta Launcha").A, "D3+3");
  const boyz = win.findDatasheet(win.__library, "Boyz");
  assertEqual(boyz.profiles.find(p => p.key === "boss_nob").stats.W, 3);
  const b = addFullUnit(win, "playerB", "Boyz");
  assertEqual(weapon(win, b, "fight", "Choppa").S, 5);
  const bc = weapon(win, b, "fight", "Big choppa");
  assertEqual(bc.A + "/" + bc.S + "/" + bc.AP + "/" + bc.D, "4/7/-1/2");
  assert(win.hasKeyword(bc, "CLEAVE 2"));
  const bn = win.findDatasheet(win.__library, "Bannernob");
  assertEqual(bn.stats.OC, 3);
});

test("Big Mek Dakkarig: Blitzkannon BS4+ e +6 A só contra alvos que NÃO são MONSTER/VEHICLE (Blitz Dem Gitz)", () => {
  const win = loadApp();
  const bm = addFullUnit(win, "playerA", "Big Mek Dakkarig");
  const bk = weapon(win, bm, "shooting", "Blitzkannon");
  assertEqual(bk.BS, "4+");
  ["IGNORES COVER", "LETHAL HITS"].forEach(k => assert(win.hasKeyword(bk, k)));
  assertEqual(JSON.stringify(bk.lethalHitsExceptTargets), '["MONSTER","VEHICLE"]');
  const inf = addFullUnit(win, "playerB", "Gretchin");
  const veh = addFullUnit(win, "playerB", "Land Speeder");
  assertEqual(win.conditionalWeaponKeywords(bm, bk, inf).A, 14);
  assertEqual(win.conditionalWeaponKeywords(bm, bk, veh).A, 8);
  const mb = weapon(win, bm, "shooting", "Multi-busta Launcha");
  assert(win.hasKeyword(mb, "LETHAL HITS") && !mb.lethalHitsExceptTargets, "Lethal Hits incondicional na Multi-busta");
});

// ---------------- Painboy: DEVASTATING WOUNDS só contra INFANTRY ----------------
test("Painboy 'Urty syringe: DEVASTATING WOUNDS só ativo contra INFANTRY (pergunta os críticos vs Gretchin, não vs Land Speeder)", () => {
  const win = loadApp();
  const pb = addFullUnit(win, "playerA", "Painboy");
  const inf = addFullUnit(win, "playerB", "Gretchin");
  const veh = addFullUnit(win, "playerB", "Land Speeder");
  const syr = weapon(win, pb, "fight", "'Urty syringe");
  assertEqual(syr.D, "D6");
  assertEqual(JSON.stringify(syr.devastatingWoundsOnlyTargets), '["INFANTRY"]');
  stepCycle(win, pb, "'Urty syringe", inf, "fight", { step: 3, hits: 1, wounds: 1, modelsAttacking: 1 });
  assert(/críticos|critic|crítico/i.test(win.renderAttackCycle("fight").textContent) && /DEVASTATING/.test(win.renderAttackCycle("fight").textContent), "vs INFANTRY pede os críticos");
  stepCycle(win, pb, "'Urty syringe", veh, "fight", { step: 3, hits: 1, wounds: 1, modelsAttacking: 1 });
  const w = win.renderAttackCycle("fight");
  assert(/Precisas de .* para salvar|salvar/i.test(w.textContent) && !/quantos foram/.test(w.textContent), "vs VEHICLE segue o save normal, sem passo de críticos");
});

test("Painboy 11ª: sem FNP 5+ nem Hold Still and Say Aargh; Dok's Toolz WS3+ S10", () => {
  const win = loadApp();
  const ds = win.findDatasheet(win.__library, "Painboy");
  assertEqual(win.feelNoPainFor(addFullUnit(win, "playerA", "Painboy")), null);
  assert(!ds.abilities.join(" ").match(/Feel No Pain|Hold Still/));
  const dt = ds.melee_weapons.find(w => w.name === "Dok's Toolz");
  assertEqual(dt.WS + "/" + dt.S, "3+/10");
});

// ---------------- Hail of Bolts ----------------
test("Hail of Bolts: pergunta ao disparar os Bolt rifles; Sim = +2 A (10 modelos: 40 dados); Não = 20; a escolha fica registada", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Intercessor Squad");
  const t1 = addFullUnit(win, "playerB", "Gretchin");
  const t2 = addFullUnit(win, "playerB", "Termagants");
  const mk = tgt => { const c = stepCycle(win, atk, "Bolt rifle", tgt, "shooting", { step: 1, modelsAttacking: 10, heavyStationary: false }); return win.renderAttackCycle("shooting"); };
  let wrap = mk(t1);
  assert(/Hail of Bolts/.test(wrap.textContent) && /alvo escolhido/.test(wrap.textContent), "devia perguntar");
  const sel = wrap.querySelector("select");
  sel.value = "yes"; sel.onchange({ target: sel });
  wrap = win.renderAttackCycle("shooting");
  assertEqual(diceCallCount(wrap), 40, "10 modelos × (A2+2)");
  assert(/Hail of Bolts ativo/.test(wrap.textContent));
  // outro alvo na mesma ativação: sem nova pergunta e sem bónus
  wrap = mk(t2);
  assert(!/é o alvo escolhido/.test(wrap.textContent), "só 1 unidade escolhida por ativação");
  assertEqual(diceCallCount(wrap), 20);
  // nova ativação (outra fase/ronda): volta a perguntar
  win.__state.game.round = 2;
  wrap = mk(t1);
  assert(/é o alvo escolhido/.test(wrap.textContent), "nova ativação volta a perguntar");
  const sel2 = wrap.querySelector("select");
  sel2.value = "no"; sel2.onchange({ target: sel2 });
  wrap = win.renderAttackCycle("shooting");
  assertEqual(diceCallCount(wrap), 20, "Não = sem bónus");
});

test("Hail of Bolts (Bug F regra 3): os Bolt rifles do Ancient anexado também ganham +2 A; a Bolt pistol não", () => {
  const win = loadApp();
  const intDs = win.findDatasheet(win.__library, "Intercessor Squad");
  const ancDs = win.findDatasheet(win.__library, "Ancient");
  win.addUnitToPlayer("playerA", intDs, { supportDs: ancDs });
  const atk = win.__state.setup.playerA.units[0];
  const tgt = addFullUnit(win, "playerB", "Gretchin");
  const key = win.phaseInstanceKey() + "-" + atk.id + "-hail";
  win.__state.game.hailChoice[key] = { chosen: tgt.id, declined: {} };
  const rifles = win.weaponsForPhase(atk, "shooting").filter(w => w.name === "Bolt rifle");
  assertEqual(rifles.length, 2);
  const byDs = {};
  rifles.forEach(r => { byDs[r.sourceDatasheet] = win.conditionalWeaponKeywords(atk, r, tgt).A; });
  assertEqual(byDs["Intercessor Squad"], 4);
  assertEqual(byDs["Ancient"], 4, "ability da unidade: beneficia todos os modelos enquanto houver Intercessors vivos");
  atk.groups.find(g => g.key !== "support").liveCount = 0;
  assertEqual(win.conditionalWeaponKeywords(atk, win.weaponsForPhase(atk, "shooting").find(w => w.name === "Bolt rifle" && w.sourceDatasheet === "Ancient"), tgt).A, 2, "sem Intercessors vivos, a ability deixa de valer");
  assertEqual(win.conditionalWeaponKeywords(atk, weapon(win, atk, "shooting", "Bolt pistol"), tgt).A, 1);
});

// ---------------- Ammo Runts (Boyz) e Boss' Ammo Runt (Warboss) na mesma unidade ----------------
test("Ammo Runts (Boyz) e Boss' Ammo Runt (Warboss): usos independentes na mesma unidade", () => {
  const win = loadApp();
  const boyzDs = win.findDatasheet(win.__library, "Boyz");
  const wbDs = win.findDatasheet(win.__library, "Warboss");
  win.addUnitToPlayer("playerA", boyzDs, { leaderDs: wbDs });
  const atk = win.__state.setup.playerA.units[0];
  const tgt = addDummyTarget(win, "playerB");
  let c = stepCycle(win, atk, "Shoota", tgt, "shooting", { step: 1, modelsAttacking: 10 });
  let wrap = win.renderAttackCycle("shooting");
  assert(/Ammo Runts/.test(wrap.textContent), "Boyz perguntam pelo Ammo Runts");
  const sel = wrap.querySelector("select");
  sel.value = "yes"; sel.onchange({ target: sel });
  assertEqual(wrap.ownerDocument.defaultView.renderAttackCycle("shooting").querySelector(".threshold-number").textContent, "4+", "BS5+ com Ammo Runts");
  // o Warboss (mesma unidade) ainda tem o SEU uso
  stepCycle(win, atk, "Kustom shoota", tgt, "shooting", { step: 1, modelsAttacking: 1 });
  wrap = win.renderAttackCycle("shooting");
  assert(/Boss' Ammo Runt/.test(wrap.textContent), "o Boss' Ammo Runt continua disponível");
});

// ---------------- Disruption Bombardment (Barbgaunts) ----------------
test("Disruption Bombardment: só 1 unidade INFANTRY escolhida pelo atacante; alvo não-INFANTRY nunca fica disrupted", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Barbgaunts");
  const inf = addFullUnit(win, "playerB", "Termagants");
  const veh = addFullUnit(win, "playerB", "Land Speeder");
  stepCycle(win, atk, "Barblauncher", veh, "shooting", { step: 5, hits: 2, modelsAttacking: 5, deadByGroup: {}, woundsLeftByGroup: {} });
  win.renderAttackCycle("shooting");
  assertEqual(win.findRealUnit(veh.id).disrupted, false, "VEHICLE não é INFANTRY");
  stepCycle(win, atk, "Barblauncher", inf, "shooting", { step: 5, hits: 2, modelsAttacking: 5, deadByGroup: {}, woundsLeftByGroup: {} });
  const wrap = win.renderAttackCycle("shooting");
  assert(/Escolhes .* como a unidade afetada/.test(wrap.textContent), "pergunta ao atacante");
  assertEqual(win.findRealUnit(inf.id).disrupted, false, "antes de escolher ainda não está disrupted");
  const sel = wrap.querySelector("select");
  sel.value = "yes"; sel.onchange({ target: sel });
  assertEqual(win.findRealUnit(inf.id).disrupted, true);
});

// ---------------- Bug C: Deadly Demise depois do FNP ----------------
test("Bug C: Psychophage com dano letal mas FNP que o salva — Deadly Demise não é perguntado; sem sucessos, é", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Intercessor Squad");
  const tgt = addFullUnit(win, "playerB", "Psychophage");
  const key = tgt.groups[0].key;
  const setup = () => {
    stepCycle(win, atk, "Bolt pistol", tgt, "shooting", { step: 5, hits: 1, modelsAttacking: 1 });
    win.allocateDamage(tgt, [10]);   // 1 instância de 10 de dano vs W10: mata
    return win.renderAttackCycle("shooting");
  };
  const answer = n => {
    const wrap = win.renderAttackCycle("shooting");
    const inp = wrap.querySelector("input[type=number]");
    inp.value = String(n); inp.dispatchEvent(new win.Event("input"));
    const btn = Array.from(wrap.querySelectorAll("button")).find(b => /Confirmar Feel No Pain/.test(b.textContent));
    btn.click();
    return win.renderAttackCycle("shooting");
  };
  let wrap = setup();
  assert(/Feel No Pain .* (quantos passaram|sucessos por instância)/.test(wrap.textContent), "FNP vem primeiro");
  assert(!/a unidade foi destruída/.test(wrap.textContent), "Deadly Demise ainda não");
  wrap = answer(10); // 10 sucessos → 0 de dano efetivo
  assert(!/a unidade foi destruída/.test(wrap.textContent), "o FNP salvou o modelo — sem Deadly Demise");
  assertEqual(win.__state.cycle.deadByGroup[key], 0);
  setup();
  wrap = answer(0);
  assert(/a unidade foi destruída/.test(wrap.textContent), "sem sucessos de FNP a unidade morre — pergunta o Deadly Demise");
});

// ---------------- Bug D: ordem de alocação ----------------
function arrows(wrap, labelPart) {
  const row = Array.from(wrap.querySelectorAll(".allocgroup")).find(r => r.textContent.includes(labelPart));
  const btns = row.querySelectorAll("button");
  return { up: btns[0], down: btns[1] };
}
test("Bug D: Captain + Intercessor Squad como alvo — o Captain não pode passar à frente dos Intercessors", () => {
  const win = loadApp();
  const capDs = win.findDatasheet(win.__library, "Captain with Relic Shield");
  const intDs = win.findDatasheet(win.__library, "Intercessor Squad");
  win.addUnitToPlayer("playerB", intDs, { leaderDs: capDs });
  const tgt = win.__state.setup.playerB.units[0];
  const atk = addFullUnit(win, "playerA", "Termagants");
  stepCycle(win, atk, "Fleshborer", tgt, "shooting", { step: 3, hits: 2, wounds: 2, modelsAttacking: 2 });
  const wrap = win.renderAttackCycle("shooting");
  const cap = arrows(wrap, "Captain");
  assert(cap.up.disabled, "seta ↑ do Captain desativada");
  const ints = arrows(wrap, "Intercessor");
  assert(ints.down.disabled, "seta ↓ dos Intercessors desativada (levaria o Captain para a frente)");
});

test("Bug D: grupo não-CHARACTER com modelo ferido tem de ir primeiro", () => {
  const win = loadApp();
  const groups = [
    { key: "a", label: "A", liveCount: 5, stats: { W: 2 }, woundsRemainingOnCurrent: 2 },
    { key: "b", label: "B", liveCount: 3, stats: { W: 2 }, woundsRemainingOnCurrent: 1 },
    { key: "leader", label: "Líder", liveCount: 1, stats: { W: 4 }, woundsRemainingOnCurrent: 4 },
  ];
  assert(win.allocOrderIsValid(["b", "a", "leader"], groups));
  assert(!win.allocOrderIsValid(["a", "b", "leader"], groups), "o grupo ferido B tem de ir antes do A");
  assert(!win.allocOrderIsValid(["b", "leader", "a"], groups), "character nunca antes de não-character");
  const wrap = win.renderAllocOrderPicker(groups, () => {});
  const first = wrap.querySelector(".allocgroup").textContent;
  assert(/B/.test(first), "a ordem inicial já põe o grupo ferido primeiro: " + first);
});

// ---------------- Bug E: fnpScope ----------------
test("Bug E: Ancient + Intercessors — dano alocado aos Intercessors não dá FNP (só o Ancient tem FNP); dano no Ancient dá", () => {
  const win = loadApp();
  const intDs = win.findDatasheet(win.__library, "Intercessor Squad");
  const ancDs = win.findDatasheet(win.__library, "Ancient");
  win.addUnitToPlayer("playerB", intDs, { supportDs: ancDs });
  const tgt = win.__state.setup.playerB.units[0];
  const atk = addFullUnit(win, "playerA", "Termagants");
  const mainKey = tgt.groups.find(g => g.key !== "support").key;
  const mk = deadKey => stepCycle(win, atk, "Fleshborer", tgt, "shooting", { step: 5, hits: 2, modelsAttacking: 2, deadByGroup: { [deadKey]: 1 }, woundsLeftByGroup: { [deadKey]: 1 } });
  mk(mainKey);
  let wrap = win.renderAttackCycle("shooting");
  assert(!/Feel No Pain|Condição de Feel No Pain|Unbreakable/.test(wrap.textContent), "dano nos Intercessors: sem passo de FNP");
  mk("support");
  wrap = win.renderAttackCycle("shooting");
  assert(/perto de um objetivo|Condição de Feel No Pain/.test(wrap.textContent), "dano no Ancient: pergunta a condição do FNP");
});

run();
