// Pedido Mestre — Bug B (Feel No Pain por wound, UX híbrida) e Bug F (regra de
// Leader, 11ª: fonte Tabletop Battles — confirmar no PDF oficial 19.04).
const { test, setFile, assert, assertEqual, run } = require("./tiny-test");
const { loadApp, addFullUnit, weaponByName, addDummyTarget } = require("./helpers");
setFile("bug-b-fnp-bug-f-leader.test.js");

function stepCycle(win, atk, wname, tgt, phase, extra) {
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = atk.id; c.weaponIdx = weaponByName(win, atk, phase, wname); c.targetId = tgt.id;
  Object.assign(c, extra || {});
  return c;
}
const fnpConfirm = wrap => Array.from(wrap.querySelectorAll("button")).find(b => /Confirmar Feel No Pain/.test(b.textContent));
// preenche os campos numéricos (um por instância) e confirma
function answerPerInstance(win, values) {
  const wrap = win.renderAttackCycle("shooting");
  const inputs = Array.from(wrap.querySelectorAll("input[type=number]"));
  assertEqual(inputs.length, values.length, "um campo por instância elegível");
  values.forEach((v, i) => { inputs[i].value = String(v); });
  fnpConfirm(wrap).click();
  return win.renderAttackCycle("shooting");
}
function withFnpTermagants(win) {
  win.findDatasheet(win.__library, "Termagants").abilities.push("Feel No Pain 5+"); // só para o teste (W1 com FNP)
  const atk = addFullUnit(win, "playerA", "Intercessor Squad");
  const tgt = addFullUnit(win, "playerB", "Termagants");
  return { atk, tgt };
}

// ---------------- Bug B ----------------
test("Bug B: 3 instâncias D2 vs W1, sucessos 2/1/0 → 2 mortos", () => {
  const win = loadApp();
  const { atk, tgt } = withFnpTermagants(win);
  stepCycle(win, atk, "Bolt pistol", tgt, "shooting", { step: 5, hits: 3, modelsAttacking: 3 });
  win.allocateDamage(tgt, [2, 2, 2]);
  assertEqual(win.__state.cycle.deadByGroup[tgt.groups[0].key], 3, "sem FNP morreriam 3");
  const wrap = win.renderAttackCycle("shooting");
  assert(/sucessos por instância/.test(wrap.textContent) && /Instância 3/.test(wrap.textContent), "d>1: um campo por instância");
  answerPerInstance(win, [2, 1, 0]);
  assertEqual(win.__state.cycle.deadByGroup[tgt.groups[0].key], 2);
});

test("Bug B: 3 instâncias D2 vs W1, sucessos 1/1/1 → 3 mortos (cada instância fica com d=1, que ainda mata W1)", () => {
  const win = loadApp();
  const { atk, tgt } = withFnpTermagants(win);
  stepCycle(win, atk, "Bolt pistol", tgt, "shooting", { step: 5, hits: 3, modelsAttacking: 3 });
  win.allocateDamage(tgt, [2, 2, 2]);
  answerPerInstance(win, [1, 1, 1]);
  assertEqual(win.__state.cycle.deadByGroup[tgt.groups[0].key], 3);
});

test("Bug B: Psychophage 4×D2 com sucessos [1,1,1,0] → fica com 5/10 wounds (dano efetivo 1+1+1+2)", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Intercessor Squad");
  const tgt = addFullUnit(win, "playerB", "Psychophage");
  const key = tgt.groups[0].key;
  stepCycle(win, atk, "Bolt pistol", tgt, "shooting", { step: 5, hits: 4, modelsAttacking: 4 });
  win.allocateDamage(tgt, [2, 2, 2, 2]);
  const wrap = answerPerInstance(win, [1, 1, 1, 0]);
  assertEqual(win.__state.cycle.deadByGroup[key], 0);
  assertEqual(win.__state.cycle.woundsLeftByGroup[key], 5);
  assert(/fica com 5\/10 wounds/.test(wrap.textContent), "ecrã de resultado: 5/10");
});

test("Bug B: Psychophage (W10) a levar 8 de dano — o FNP agora é oferecido mesmo sem mortes", () => {
  const win = loadApp();
  const atk = addFullUnit(win, "playerA", "Intercessor Squad");
  const tgt = addFullUnit(win, "playerB", "Psychophage");
  stepCycle(win, atk, "Bolt pistol", tgt, "shooting", { step: 5, hits: 1, modelsAttacking: 1 });
  win.allocateDamage(tgt, [8]);
  assertEqual(win.__state.cycle.deadByGroup[tgt.groups[0].key], 0, "8 de dano não mata");
  assert(/Feel No Pain/.test(win.renderAttackCycle("shooting").textContent), "FNP oferecido");
});

test("Bug B: todas as instâncias com d=1 → um único passo 'quantos passaram?' (cada sucesso evita 1 wound)", () => {
  const win = loadApp();
  const { atk, tgt } = withFnpTermagants(win);
  stepCycle(win, atk, "Bolt pistol", tgt, "shooting", { step: 5, hits: 5, modelsAttacking: 5 });
  win.allocateDamage(tgt, [1, 1, 1, 1, 1]);
  const wrap = win.renderAttackCycle("shooting");
  assert(/quantos passaram\?/.test(wrap.textContent) && !/sucessos por instância/.test(wrap.textContent));
  const inp = wrap.querySelector("input[type=number]");
  assertEqual(Number(inp.max), 5, "máximo = nº de dados");
  inp.value = "2"; inp.dispatchEvent(new win.Event("input"));
  fnpConfirm(wrap).click();
  win.renderAttackCycle("shooting");
  assertEqual(win.__state.cycle.deadByGroup[tgt.groups[0].key], 3, "5 wounds − 2 evitadas = 3 mortos");
});

test("Bug B: o FNP aplica-se também às instâncias de Devastating Wounds (mortal wounds)", () => {
  const win = loadApp();
  const { atk, tgt } = withFnpTermagants(win);
  stepCycle(win, atk, "Bolt pistol", tgt, "shooting", { step: 5, hits: 2, modelsAttacking: 2 });
  // 1 instância de DW (D2) + 1 save falhado (D1) — ordem: DW primeiro
  win.allocateDamage(tgt, [2].concat([1]));
  const wrap = win.renderAttackCycle("shooting");
  assert(/Instância 1/.test(wrap.textContent) && /Instância 2/.test(wrap.textContent), "as duas instâncias são elegíveis (incl. a de DW)");
});

test("Bug B: FNP respeita fnpScope 'model' — instâncias alocadas a outro grupo não aparecem", () => {
  const win = loadApp();
  const intDs = win.findDatasheet(win.__library, "Intercessor Squad");
  const ancDs = win.findDatasheet(win.__library, "Ancient");
  win.addUnitToPlayer("playerB", intDs, { supportDs: ancDs });
  const tgt = win.__state.setup.playerB.units[0];
  const atk = addFullUnit(win, "playerA", "Termagants");
  stepCycle(win, atk, "Fleshborer", tgt, "shooting", { step: 5, hits: 3, modelsAttacking: 3, fnpConditionAnswered: true, allocOrder: ["main", "support"] });
  win.allocateDamage(tgt, [1, 1, 1]);   // todo o dano cai nos Intercessors (Ancient é o último)
  assert(!/Feel No Pain/.test(win.renderAttackCycle("shooting").textContent), "nenhuma instância no Ancient → sem FNP");
  // agora só o Ancient recebe dano
  stepCycle(win, atk, "Fleshborer", tgt, "shooting", { step: 5, hits: 3, modelsAttacking: 3, fnpConditionAnswered: true, allocOrder: ["main", "support"] });
  tgt.groups.find(g => g.key !== "support").liveCount = 0;
  win.allocateDamage(tgt, [1, 1, 1]);
  assert(/Feel No Pain/.test(win.renderAttackCycle("shooting").textContent), "com o dano no Ancient, o FNP aparece");
});

test("Bug B: Hazardous — o FNP (Psychic Hood, unidade a liderar) também cobre as mortal wounds; cada sucesso evita 1 MW", () => {
  const win = loadApp();
  win.addUnitToPlayer("playerA", win.findDatasheet(win.__library, "Intercessor Squad"), { leaderDs: win.findDatasheet(win.__library, "Librarian") });
  const atk = win.__state.setup.playerA.units[0];
  const tgt = addDummyTarget(win, "playerB");
  const c = stepCycle(win, atk, "Smite - focused witchfire", tgt, "shooting", { step: 5, hits: 0, modelsAttacking: 1, deadByGroup: {}, hazardousFailCount: 2 });
  c.hazardousAllocOrder = atk.groups.map(g => g.key).sort((a, b) => (a === "leader") - (b === "leader"));
  const wrap = win.renderAttackCycle("shooting");
  assert(/Feel No Pain .* às mortal wounds do Hazardous/.test(wrap.textContent), "pergunta o FNP às MW do Hazardous");
  const inp = wrap.querySelector("input[type=number]");
  assertEqual(Number(inp.max), 2);
  inp.value = "2"; inp.dispatchEvent(new win.Event("input"));
  fnpConfirm(wrap).click();
  win.renderAttackCycle("shooting");
  assertEqual(win.__state.cycle.hazardousResult.mwTotal, 0, "2 MW − 2 sucessos = 0");
  const main = win.findRealUnit(atk.id).groups.find(g => g.key !== "leader");
  assertEqual(main.woundsRemainingOnCurrent, main.stats.W, "sem dano nenhum");
});

// ---------------- Bug F ----------------
test("Bug F: Support só pode existir anexado — o setup não deixa adicioná-lo sozinho", () => {
  const win = loadApp();
  const ancient = win.findDatasheet(win.__library, "Ancient");
  const item = win.renderDsPickerItem(ancient, win.__state.setup.playerA, "playerA");
  assert(!Array.from(item.querySelectorAll("button")).some(b => /Adicionar/.test(b.textContent)), "sem botão Adicionar");
  assert(/só pode ser anexado/i.test(item.textContent));
  const warboss = win.renderDsPickerItem(win.findDatasheet(win.__library, "Warboss"), win.__state.setup.playerA, "playerA");
  assert(Array.from(warboss.querySelectorAll("button")).some(b => /Adicionar/.test(b.textContent)), "um Leader pode ser adicionado sozinho");
  const bigboss = win.renderDsPickerItem(win.findDatasheet(win.__library, "Bigboss"), win.__state.setup.playerA, "playerA");
  assert(!Array.from(bigboss.querySelectorAll("button")).some(b => /Adicionar/.test(b.textContent)), "Bigboss é Support");
});

test("Bug F: Chaplain sozinho vs Boyz → sem +1 ao ferir (Litany); anexado ao Vanguard → com +1, mesmo sem Vanguard vivos", () => {
  const win = loadApp();
  const chap = addFullUnit(win, "playerA", "Chaplain with Jump Pack");
  const boyz = addFullUnit(win, "playerB", "Boyz");
  const woundChips = () => {
    stepCycle(win, win.findInstance(chap.id), "Crozius arcanum", boyz, "fight", { step: 2, hits: 3, modelsAttacking: 1 });
    return win.renderAttackCycle("fight").textContent;
  };
  assert(!/ao ferir \(melee, permanente\)/.test(woundChips()), "sozinho: sem Litany");
  const win2 = loadApp();
  win2.addUnitToPlayer("playerA", win2.findDatasheet(win2.__library, "Vanguard Veteran Squad with Jump Packs"), { leaderDs: win2.findDatasheet(win2.__library, "Chaplain with Jump Pack") });
  const unit = win2.__state.setup.playerA.units[0];
  const b2 = addFullUnit(win2, "playerB", "Boyz");
  const chips2 = () => {
    stepCycle(win2, win2.findInstance(unit.id), "Crozius arcanum", b2, "fight", { step: 2, hits: 3, modelsAttacking: 1 });
    return win2.renderAttackCycle("fight").textContent;
  };
  assert(/\+1 ao ferir \(melee, permanente\)/.test(chips2()), "anexado: Litany");
  unit.groups.find(g => g.key !== "leader").liveCount = 0;
  assert(/\+1 ao ferir \(melee, permanente\)/.test(chips2()), "0 Vanguard vivos: Litany continua");
});

test("Bug F: Winged Tyranid Prime sozinho não dá SUSTAINED HITS 1 (Alpha Warrior é 'while leading')", () => {
  const win = loadApp();
  const prime = addFullUnit(win, "playerA", "Winged Tyranid Prime");
  const tgt = addDummyTarget(win, "playerB");
  const w = win.conditionalWeaponKeywords(prime, win.weaponsForPhase(prime, "fight")[0], tgt);
  assert(!win.hasKeyword(w, "SUSTAINED HITS"), "sozinho não lidera");
});

test("Bug F regra 3: Tide of Muscle (Boyz) dá Lethal Hits ao charge também às armas do Warboss anexado; sozinho o Warboss não tem", () => {
  const win = loadApp();
  win.addUnitToPlayer("playerA", win.findDatasheet(win.__library, "Boyz"), { leaderDs: win.findDatasheet(win.__library, "Warboss") });
  const unit = win.__state.setup.playerA.units[0];
  const wbWeapon = win.weaponsForPhase(unit, "fight").find(w => w.sourceDatasheet === "Warboss");
  assert(win.chargeLethalHitsAbility(wbWeapon, "fight", unit), "com Boyz vivos, as armas do Warboss têm Lethal Hits ao carregar");
  unit.groups.filter(g => g.key !== "leader").forEach(g => { g.liveCount = 0; });
  assert(!win.chargeLethalHitsAbility(wbWeapon, "fight", unit), "sem Boyz vivos, deixa de valer");
  const win2 = loadApp();
  const solo = addFullUnit(win2, "playerA", "Warboss");
  assert(!win2.chargeLethalHitsAbility(win2.weaponsForPhase(solo, "fight")[0], "fight", solo), "Warboss sozinho: sem Tide of Muscle");
});

// ---------------- Boyz (datasheet 11ª) ----------------
test("Boyz 11ª: sem Kombi-shoota/Kombi-rokkit/Kustom shoota; com Big Shoota, Rokkit Launcha (Busta/Blasta) e Burna", () => {
  const win = loadApp();
  const b = addFullUnit(win, "playerA", "Boyz");
  const names = win.weaponsForPhase(b, "shooting").map(w => w.name);
  assertEqual(names.join(","), "Slugga,Shoota,Big Shoota,Rokkit Launcha - Busta,Rokkit Launcha - Blasta,Burna");
  const get = n => win.weaponsForPhase(b, "shooting").find(w => w.name === n);
  const row = w => [w.range, w.A, w.BS, w.S, w.AP, w.D].join("/");
  assertEqual(row(get("Big Shoota")), '36"/3/5+/4/0/1');
  assert(win.hasKeyword(get("Big Shoota"), "LETHAL HITS") && win.hasKeyword(get("Big Shoota"), "RAPID FIRE 2"));
  assertEqual(JSON.stringify(get("Big Shoota").lethalHitsExceptTargets), '["MONSTER","VEHICLE"]');
  assertEqual(row(get("Rokkit Launcha - Busta")), '24"/2/5+/10/-2/3');
  assertEqual(row(get("Rokkit Launcha - Blasta")), '24"/2/5+/4/0/1');
  assert(win.hasKeyword(get("Rokkit Launcha - Blasta"), "BLAST 2"));
  assertEqual(row(get("Burna")), '12"/3/N/A/4/0/1'.replace("N/A/4", "N/A/4"));
  assert(win.hasKeyword(get("Burna"), "BLAST 1") && win.hasKeyword(get("Burna"), "TORRENT"));
});

run();
