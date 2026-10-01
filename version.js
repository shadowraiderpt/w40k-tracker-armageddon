// Versão de build da app — atualizada a cada deploy por tools/bump-version.py
// (nunca à mão). Fonte única: usada no rodapé (index.html, "Versão: ...") e no
// nome da cache do service worker (CACHE_NAME = "...-" + APP_VERSION). Subir
// este valor é o que faz o service worker detetar uma versão nova e mostrar o
// aviso "Nova versão disponível — recarregar" aos jogadores que já tinham a
// app aberta/instalada.
const APP_VERSION = "2026-10-01.4";
