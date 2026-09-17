// Framework de testes minimalista (sem dependências) — só o suficiente para
// correr asserts e reportar PASS/FAIL com um exit code útil para CI/terminal.
const tests = [];
let currentFile = "";

function setFile(name) { currentFile = name; }
function test(name, fn) { tests.push({ file: currentFile, name, fn }); }

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg ? msg + " — " : "") + "esperado " + JSON.stringify(expected) + ", obtido " + JSON.stringify(actual));
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assert falhou");
}

function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try {
      t.fn();
      pass++;
      console.log("  \x1b[32m✓\x1b[0m [" + t.file + "] " + t.name);
    } catch (e) {
      fail++;
      console.log("  \x1b[31m✗\x1b[0m [" + t.file + "] " + t.name);
      console.log("      " + e.message);
    }
  }
  console.log("");
  console.log(pass + " passaram, " + fail + " falharam (" + tests.length + " no total)");
  process.exitCode = fail > 0 ? 1 : 0;
}

module.exports = { test, setFile, assertEqual, assert, run };
