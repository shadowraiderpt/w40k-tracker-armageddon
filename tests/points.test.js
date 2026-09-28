// Pontos confirmados no MFM v1.4 (consultado 2026-09-28): tamanho exato
// (pointsBySize), nunca multiplicando por modelo, e escalão por ordem de unidade
// (pointsTiers) — Boyz e Big Mek Dakkarig.
const { test, setFile, assert, assertEqual, run } = require("./tiny-test");
const { loadApp, findDatasheetByName } = require("./helpers");
setFile("points.test.js");

// Adiciona uma unidade real e, se pedido, mais cópias sintéticas (a caixa limita
// o nº de miniaturas, mas o preço por ordem de unidade tem de ser testável).
function addUnits(win, playerKey, dsName, sizes) {
  const ds = findDatasheetByName(win, dsName);
  const player = win.__state.setup[playerKey];
  win.addUnitToPlayer(playerKey, ds, {});           // unidade real (tamanho por defeito)
  const first = player.units[player.units.length - 1];
  const setSize = (u, n) => {
    if (n == null) return;
    const g = u.groups.find(x => x.datasheetName === dsName && x.initialCount > 1) || u.groups.find(x => x.datasheetName === dsName);
    const fixed = u.groups.filter(x => x.datasheetName === dsName && x !== g).reduce((a, x) => a + x.initialCount, 0);
    g.initialCount = g.liveCount = n - fixed;
  };
  setSize(first, sizes[0]);
  for (let i = 1; i < sizes.length; i++) {         // cópias sintéticas (a caixa limita as miniaturas)
    const copy = JSON.parse(JSON.stringify(first));
    copy.id = "syn-" + dsName + "-" + i;
    setSize(copy, sizes[i]);
    player.units.push(copy);
  }
  return player;
}
const total = (win, key) => win.playerTotalPoints(win.__state.setup[key]);

test("Boyz: 4 unidades de 10 → 90+90+90+100 = 370 (escalão por ordem de unidade)", () => {
  const win = loadApp();
  const player = addUnits(win, "playerA", "Boyz", [10, 10, 10, 10]);
  assertEqual(player.units.map(u => win.unitPointsFor(player, u).points).join(","), "90,90,90,100");
  assertEqual(total(win, "playerA"), 370);
});

test("Boyz de 20: 1ª a 3ª = 180; 4ª = 190; tamanho fora da tabela → preço base com asterisco", () => {
  const win = loadApp();
  const player = addUnits(win, "playerA", "Boyz", [20, 20, 20, 20]);
  assertEqual(player.units.map(u => win.unitPointsFor(player, u).points).join(","), "180,180,180,190");
  const win2 = loadApp();
  const p2 = addUnits(win2, "playerA", "Boyz", [15]);
  const r = win2.unitPointsFor(p2, p2.units[0]);
  assertEqual(r.points, 90);
  assert(r.approx, "tamanho 15 não está no MFM → aproximado");
});

test("Big Mek Dakkarig: 3 unidades → 135+135+145 = 415", () => {
  const win = loadApp();
  const player = addUnits(win, "playerA", "Big Mek Dakkarig", [null, null, null]);
  assertEqual(player.units.map(u => win.unitPointsFor(player, u).points).join(","), "135,135,145");
  assertEqual(total(win, "playerA"), 415);
});

test("O escalão é por jogador: as unidades do outro jogador não contam", () => {
  const win = loadApp();
  const pa = addUnits(win, "playerA", "Boyz", [10, 10, 10]);
  win.__state.setup.playerB.units.push(JSON.parse(JSON.stringify(pa.units[0])));   // 1ª unidade de Boyz do jogador B
  assertEqual(total(win, "playerB"), 90);
  assertEqual(total(win, "playerA"), 270);
});

test("Ripper Swarms: 1 = 30, 2 = 40, 3 = 50 (por tamanho exato, nunca × modelo)", () => {
  [[1, 30], [2, 40], [3, 50]].forEach(([n, pts]) => {
    const win = loadApp();
    const player = addUnits(win, "playerA", "Ripper Swarms", [n]);
    assertEqual(win.unitPointsFor(player, player.units[0]).points, pts, n + " modelo(s)");
  });
});

test("Intercessor Squad: 5 = 80, 10 = 150", () => {
  [[5, 80], [10, 150]].forEach(([n, pts]) => {
    const win = loadApp();
    const player = addUnits(win, "playerA", "Intercessor Squad", [n]);
    assertEqual(win.unitPointsFor(player, player.units[0]).points, pts, n + " modelos");
  });
});

test("Von Ryan's Leapers: 3 = 55, 6 = 105; Wartrakks: 1 = 70, 2 = 130", () => {
  const win = loadApp();
  const p1 = addUnits(win, "playerA", "Von Ryan's Leapers", [3, 6]);
  assertEqual(p1.units.map(u => win.unitPointsFor(p1, u).points).join(","), "55,105");
  const p2 = addUnits(win, "playerB", "Wartrakks", [1, 2]);
  assertEqual(p2.units.map(u => win.unitPointsFor(p2, u).points).join(","), "70,130");
});

test("Pontos fixos: Neurotyrant 130, Warboss 100, Bigboss 50, Bannernob 35, Painboy 45", () => {
  const win = loadApp();
  [["Neurotyrant", 130], ["Warboss", 100], ["Bigboss", 50], ["Bannernob", 35], ["Painboy", 45]].forEach(([n, pts]) => {
    assertEqual(win.findDatasheet(win.__library, n).points, pts, n);
  });
});

test("Líder anexado soma o seu preço: Warboss (100) + Boyz de 10 (90) = 190", () => {
  const win = loadApp();
  win.addUnitToPlayer("playerA", findDatasheetByName(win, "Boyz"), { leaderDs: findDatasheetByName(win, "Warboss") });
  assertEqual(total(win, "playerA"), 190);
});

test("As 11 unidades com pontos do MFM v1.4 têm a fonte certa e nenhum ⚠️", () => {
  const win = loadApp();
  ["Intercessor Squad", "Neurotyrant", "Von Ryan's Leapers", "Ripper Swarms", "Warboss", "Bigboss", "Bannernob", "Painboy", "Boyz", "Wartrakks", "Big Mek Dakkarig"].forEach(n => {
    const ds = win.findDatasheet(win.__library, n);
    assertEqual(ds.pointsSource, "MFM v1.4, consultado 2026-09-28", n);
  });
});

test("Termagants: 10 = 60, 20 = 110 (corrigido: a app tinha 120 para 20)", () => {
  [[10, 60], [20, 110]].forEach(([n, pts]) => {
    const win = loadApp();
    const player = addUnits(win, "playerA", "Termagants", [n]);
    assertEqual(win.unitPointsFor(player, player.units[0]).points, pts, n + " modelos");
  });
});

test("Escalões por ordem: 3 Librarians = 220; 3 Vanguard de 5 = 325; 3 Exocrines = 415; Screamer-Killer/Haruspex 125,125,135; Neurolictor 80,80,90", () => {
  const cases = [["Librarian", [null, null, null], 220], ["Vanguard Veteran Squad with Jump Packs", [5, 5, 5], 325], ["Exocrine", [null, null, null], 415],
    ["Screamer-Killer", [null, null, null], 385], ["Haruspex", [null, null, null], 385], ["Neurolictor", [null, null, null], 250]];
  cases.forEach(([name, sizes, expected]) => {
    const win = loadApp();
    addUnits(win, "playerA", name, sizes);
    assertEqual(total(win, "playerA"), expected, name);
  });
  const win = loadApp();
  const pv = addUnits(win, "playerA", "Vanguard Veteran Squad with Jump Packs", [10, 10, 10]);
  assertEqual(pv.units.map(u => win.unitPointsFor(pv, u).points).join(","), "210,210,220", "Vanguard de 10");
});

test("Tamanhos das unidades Tyranids/Orks: Gretchin 10 = 45, 20 = 80; Neurogaunts 11 = 45, 22 = 90; Barbgaunts 5 = 55, 10 = 110; Gargoyles 10 = 80, 20 = 155", () => {
  [["Gretchin", 10, 45], ["Gretchin", 20, 80], ["Neurogaunts", 11, 45], ["Neurogaunts", 22, 90], ["Barbgaunts", 5, 55], ["Barbgaunts", 10, 110], ["Gargoyles", 10, 80], ["Gargoyles", 20, 155]].forEach(([name, n, pts]) => {
    const win = loadApp();
    const player = addUnits(win, "playerA", name, [n]);
    assertEqual(win.unitPointsFor(player, player.units[0]).points, pts, name + " " + n);
  });
});

test("Pontos fixos confirmados: Weirdboy 65, Winged Prime 65, Psychophage 110, Captain 80, Chaplain 75, Ancient 40, Eradicator 3 = 80, Land Speeder 105", () => {
  const win = loadApp();
  [["Weirdboy", 65], ["Winged Tyranid Prime", 65], ["Psychophage", 110], ["Captain with Relic Shield", 80], ["Chaplain with Jump Pack", 75], ["Ancient", 40], ["Eradicator Squad with Heavy Bolters", 80], ["Land Speeder", 105]].forEach(([n, pts]) => {
    const player = addUnits(win, "playerA", n, [null]);
    assertEqual(win.unitPointsFor(player, player.units[player.units.length - 1]).points, pts, n);
  });
});

test("As 30 unidades têm pointsSource do MFM v1.4 e nenhuma tem ⚠️", () => {
  const win = loadApp();
  let n = 0;
  Object.keys(win.__RAW_UNITS).forEach(f => win.__RAW_UNITS[f].forEach(u => {
    n++;
    assertEqual(u.pointsSource, "MFM v1.4, consultado 2026-09-28", u.name);
  }));
  assertEqual(n, 30);
});

test("Ecrã inicial mostra 'Pontos: MFM v1.4' ao lado da versão das regras", () => {
  const win = loadApp();
  assertEqual(win.document.getElementById("points-version").textContent, "Pontos: MFM v1.4 (30 de 30 confirmadas)");
  assert(/Regras: versão de 2026-09-28/.test(win.document.getElementById("rules-version").textContent));
});

run();
