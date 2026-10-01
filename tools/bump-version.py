#!/usr/bin/env python3
"""tools/bump-version.py — corre-se a cada deploy (antes de commitar), nunca à
mão: escreve demo/version.js com uma APP_VERSION nova a partir da data de hoje
mais um contador sequencial (para vários deploys no mesmo dia). É esta
APP_VERSION que o service worker usa no nome da cache — subir aqui é o que
faz os jogadores com a app já aberta/instalada verem o aviso de nova versão.
"""
import datetime
import re
import sys

P = r"C:\Users\Utilizador\Desktop\warhammer APP\demo\version.js"


def main():
    today = datetime.date.today().isoformat()
    s = open(P, encoding="utf-8").read()
    m = re.search(r'const APP_VERSION = "([^"]+)";', s)
    cur = m.group(1) if m else ""
    if cur.startswith(today + "."):
        seq = int(cur.split(".")[-1]) + 1
    else:
        seq = 1
    new_version = f"{today}.{seq}"
    s = re.sub(r'const APP_VERSION = "[^"]+";', f'const APP_VERSION = "{new_version}";', s)
    open(P, "w", encoding="utf-8").write(s)
    print(new_version)


if __name__ == "__main__":
    main()
