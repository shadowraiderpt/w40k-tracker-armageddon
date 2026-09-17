// Auditoria do relatório "v2" (playtest 16-17 Set 2026, revisto). Esse
// relatório reafirmava os Bugs A (Attacks aleatório sem bónus) e B (Psychic
// Hood sem checar [PSYCHIC]) citando exatamente o código PRÉ-correção desta
// sessão — já não bate certo com o index.html atual (ver commits 198f832 e
// d2a9168). Este ficheiro fixa evidência de que continuam corrigidos, e
// cobre em separado as 3 verificações do relatório que eram novas
// (multiProfile Boyz+Bannernob, aura de InvSv, keyword de Ripper Swarms) —
// já estavam corretas, mas não tinham teste dedicado até agora.
const { test, setFile, assert, assertEqual, run } = require("./tiny-test");
const { loadApp, addFullUnit, weaponByName, setupCycle, addDummyTarget } = require("./helpers");

setFile("v2-report-audit.test.js");

test("Bug A continua corrigido: needsAttacksRollStep não depende de attacksBonus", () => {
  const win = loadApp();
  // Prova direta pela fonte, não só pelo comportamento — o relatório citou
  // a linha exata da condição antiga.
  const src = require("fs").readFileSync(require("path").join(__dirname, "..", "index.html"), "utf8");
  assert(/const needsAttacksRollStep = !attackIsFixed;/.test(src), "a condição devia ser só !attackIsFixed, sem && attacksBonus !== 0");
  assert(!/needsAttacksRollStep = !attackIsFixed && attacksBonus/.test(src), "a condição antiga (dependente do bónus) não devia existir mais no ficheiro");
});

test("Bug B continua corrigido: Smite do Librarian (tem [PSYCHIC]) oferece FNP do Psychic Hood a outra unidade com a mesma ability", () => {
  // Cenário do próprio relatório: "ataque com [PSYCHIC] vs unidade com
  // Psychic Hood" devia OFERECER o FNP — testamos com dois Librarians.
  const win = loadApp();
  const attacker = addFullUnit(win, "playerA", "Librarian");
  // BOX_LIMITS para "Librarian" é 1, partilhado entre os dois jogadores —
  // não dá para addFullUnit(playerB, "Librarian") também. Constrói-se o
  // alvo à mão (mesma forma que addDummyTarget), com datasheetName
  // "Librarian" a sério, para feelNoPainFor encontrar o Psychic Hood dele.
  const librarianDs = win.findDatasheet(win.__library, "Librarian");
  const target = {
    id: "dummy-librarian-target", datasheetNames: ["Librarian"], faction: "Space Marines",
    label: "Dummy Librarian", points: 0, battleshocked: false, disrupted: false,
    groups: [{ key: "main", label: "Librarian", datasheetName: "Librarian",
      stats: Object.assign({}, librarianDs.profiles[0].stats), liveCount: 1, initialCount: 1, woundsRemainingOnCurrent: librarianDs.profiles[0].stats.W }],
  };
  win.__state.setup.playerB.units.push(target);
  win.__state.cycle = win.__emptyCycle();
  const c = win.__state.cycle;
  c.attackerId = attacker.id;
  c.weaponIdx = weaponByName(win, attacker, "shooting", "Smite - witchfire");
  c.targetId = target.id;
  c.step = 5; c.hits = 1; c.deadByGroup = { main: 1 };
  const wrap = win.renderAttackCycle("shooting");
  assert(/Feel No Pain .+ — quantos passaram\?/.test(wrap.textContent), "Smite tem [PSYCHIC] — devia oferecer o FNP do Psychic Hood");
});

test("HAZARDOUS já tem mecanismo completo (não só uma nota) — não é um keyword em falta", () => {
  const win = loadApp();
  const attacker = addFullUnit(win, "playerA", "Vanguard Veteran Squad with Jump Packs");
  const target = addDummyTarget(win, "playerB");
  const weaponIdx = weaponByName(win, attacker, "shooting", "Plasma pistol - supercharge");
  setupCycle(win, { attacker, weaponIdx, target, phaseKey: "shooting", modelsAttacking: 1 });
  win.__state.cycle.step = 5; win.__state.cycle.hits = 1; win.__state.cycle.deadByGroup = {};
  const wrap = win.renderAttackCycle("shooting");
  assert(/HAZARDOUS/.test(wrap.textContent), "devia mostrar o passo dedicado de HAZARDOUS no step 5, não só um lembrete de texto");
});

test("IGNORES COVER agora tem nota de lembrete (WEAPON_KEYWORD_NOTES)", () => {
  const win = loadApp();
  const notes = win.weaponKeywordNotes({ keywords: ["IGNORES COVER"] });
  assert(notes.length === 1 && /cobertura/i.test(notes[0].text), "devia haver uma nota sobre cobertura para IGNORES COVER");
});

test("multiProfile: Boyz (Boss Nob+Boyz) com Bannernob anexado — Shoota dos Boyz soma os 2 perfis, Shoota do Bannernob conta só 1", () => {
  const win = loadApp();
  const boyzDs = win.findDatasheet(win.__library, "Boyz");
  const bannernobDs = win.findDatasheet(win.__library, "Bannernob");
  win.addUnitToPlayer("playerA", boyzDs, { supportDs: bannernobDs });
  const attacker = win.__state.setup.playerA.units[0];
  assertEqual(attacker.groups.reduce((s, g) => s + g.liveCount, 0), 11, "1 Boss Nob + 9 Boyz + 1 Bannernob = 11 modelos");

  const boyzWeapons = win.weaponsForPhase(attacker, "shooting").filter(w => w.sourceDatasheet === "Boyz");
  const boyzShoota = boyzWeapons.find(w => w.name === "Shoota");
  assertEqual(win.maxModelsAttacking(attacker, boyzShoota), 10, "Shoota dos Boyz é partilhada por boss_nob(1)+boyz(9) = 10 modelos");

  const bannernobShoota = win.weaponsForPhase(attacker, "shooting").find(w => w.sourceDatasheet === "Bannernob" && w.name === "Shoota");
  assertEqual(win.maxModelsAttacking(attacker, bannernobShoota), 1, "a Shoota do Bannernob é uma arma à parte, não mistura com os Boyz");
});

test("Aura de InvSv do Bannernob (Waaagh! Banner) aplica-se à unidade Boyz+Bannernob toda", () => {
  const win = loadApp();
  const boyzDs = win.findDatasheet(win.__library, "Boyz");
  const bannernobDs = win.findDatasheet(win.__library, "Bannernob");
  win.addUnitToPlayer("playerA", boyzDs, { supportDs: bannernobDs });
  const unit = win.allInstances().find(u => u.datasheetNames.includes("Boyz"));
  const aura = win.invSvAuraFor(unit);
  assert(aura && aura.value === 5, "devia haver uma aura de InvSv 5+ (Waaagh! Banner) aplicável a toda a unidade");
});

test("Bug G: PSYKER estava em falta em todas as unidades com arma [PSYCHIC] — Anti-Psyker do Psychophage nunca disparava", () => {
  const win = loadApp();
  ["Librarian", "Weirdboy", "Neurotyrant"].forEach(name => {
    const ds = win.findDatasheet(win.__library, name);
    assert(ds.keywords.includes("PSYKER"), name + " tem arma [PSYCHIC] mas não tinha a keyword de unidade PSYKER");
  });
});

test("Bug G corrigido: Anti-Psyker 4+ do Psychophage aplica-se de facto contra o Librarian (tem PSYKER)", () => {
  const win = loadApp();
  const attacker = addFullUnit(win, "playerA", "Psychophage");
  const target = addFullUnit(win, "playerB", "Librarian");
  const weaponIdx = weaponByName(win, attacker, "fight", "Talons and betentacled maw");
  setupCycle(win, { attacker, weaponIdx, target, phaseKey: "fight", modelsAttacking: 1 });
  win.__state.cycle.step = 2;
  win.__state.cycle.hits = 1;
  const wrap = win.renderAttackCycle("fight");
  assert(/ANTI-PSYKER 4\+ aplicado/.test(wrap.textContent), "com o Librarian a ter PSYKER, o Anti-Psyker 4+ devia aparecer aplicado no passo de ferir");
});

test("Bug H: Captain/Chaplain/Ancient/Intercessor Squad têm EXPLOSIVES, como o texto do Stratagem já dizia", () => {
  const win = loadApp();
  ["Captain with Relic Shield", "Chaplain with Jump Pack", "Ancient", "Intercessor Squad"].forEach(name => {
    const ds = win.findDatasheet(win.__library, name);
    assert(ds.keywords.includes("EXPLOSIVES"), name + " devia ter EXPLOSIVES (o texto do Stratagem Explosives já afirmava isto)");
  });
});

test("Ripper Swarms tem a keyword SWARM, não INFANTRY", () => {
  const win = loadApp();
  const ds = win.findDatasheet(win.__library, "Ripper Swarms");
  assert(ds.keywords.includes("SWARM"), "Ripper Swarms devia ter a keyword SWARM");
  assert(!ds.keywords.includes("INFANTRY"), "Ripper Swarms não devia ter a keyword INFANTRY");
});

run();
