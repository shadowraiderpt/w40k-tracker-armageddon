// Corre todos os *.test.js desta pasta num só processo Node (sem
// dependências de teste como mocha/jest — o projeto é vanilla JS de
// propósito). Uso: npm test (dentro de demo/tests/).
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const files = fs.readdirSync(__dirname).filter(f => f.endsWith(".test.js")).sort();
let anyFail = false;
for (const f of files) {
  console.log("\n=== " + f + " ===");
  try {
    execFileSync(process.execPath, [path.join(__dirname, f)], { stdio: "inherit" });
  } catch (e) {
    anyFail = true;
  }
}
process.exitCode = anyFail ? 1 : 0;
