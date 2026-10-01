// Carrega o index.html real dentro de um jsdom, para os testes chamarem as
// MESMAS funções que a app usa no browser (nada reimplementado à parte).
//
// Declarações `function foo(){}` no topo do <script> tornam-se propriedades
// de `window` automaticamente (script clássico, não module) — dá para
// chamar window.renderAttackCycle, window.addUnitToPlayer, etc. diretamente.
// Mas `const`/`let` do topo (state, library, RAW_UNITS) NÃO viram
// propriedades de window; por isso injeta-se um <script> extra a seguir ao
// principal que os copia para window — funciona porque scripts clássicos no
// mesmo documento partilham o mesmo scope léxico de topo.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

function loadApp() {
  const htmlPath = path.join(__dirname, "..", "index.html");
  let html = fs.readFileSync(htmlPath, "utf8");

  // jsdom (sem resourceLoader) não carrega <script src> externos — version.js
  // é inline aqui para o bridge/testes poderem ler window.APP_VERSION tal
  // como o browser real o carrega via <script src="./version.js">.
  const versionJs = fs.readFileSync(path.join(__dirname, "..", "version.js"), "utf8");
  html = html.replace('<script src="./version.js"></script>', "<script>" + versionJs + "</script>");

  const bridge = "\n<script>\n" +
    "window.__state = state;\n" +
    "window.__library = library;\n" +
    "window.__RAW_UNITS = RAW_UNITS;\n" +
    "window.__emptyCycle = emptyCycle;\n" +
    "window.APP_VERSION = typeof APP_VERSION !== 'undefined' ? APP_VERSION : null;\n" +
    "</script>\n";
  if (!html.includes("</body>")) throw new Error("index.html sem </body> — layout mudou, ajustar load-app.js");
  html = html.replace("</body>", bridge + "</body>");

  const dom = new JSDOM(html, {
    url: "http://localhost/",
    runScripts: "dangerously",
  });
  return dom.window;
}

module.exports = { loadApp };
