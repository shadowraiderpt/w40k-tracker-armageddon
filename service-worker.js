// Service worker do W40K Tracker — Armageddon.
// Objetivo único: deixar a app usável offline depois da primeira visita
// (útil numa mesa física sem rede fiável). Não faz mais nada — não decide
// regras, não sincroniza dados, não fala com nenhum servidor.
//
// Estratégia: cache-first para tudo o que é da própria app (HTML, manifest,
// ícones, fotos das unidades), com atualização em segundo plano sempre que
// há rede. Pedidos a outras origens (ex: Google Fonts) passam direto para a
// rede — nunca guardamos nem interceptamos o que não é nosso.
//
// CACHE_NAME vem de APP_VERSION (version.js, fonte única partilhada com o
// rodapé da app) — nunca escrito à mão aqui. Subir o APP_VERSION a cada
// deploy (tools/bump-version.py) é o que faz este worker detetar uma versão
// nova e a app mostrar o aviso "Nova versão disponível — recarregar".
importScripts("./version.js");
const CACHE_NAME = "w40k-tracker-armageddon-" + APP_VERSION;
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./version.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./unit_photos/ancient.jpg",
  "./unit_photos/bannernob.jpg",
  "./unit_photos/barbgaunts.jpg",
  "./unit_photos/big-mek-dakkarig.jpg",
  "./unit_photos/bigboss.jpg",
  "./unit_photos/boyz.jpg",
  "./unit_photos/captain-with-relic-shield.jpg",
  "./unit_photos/chaplain-with-jump-pack.jpg",
  "./unit_photos/eradicator-squad-with-heavy-bolters.jpg",
  "./unit_photos/exocrine.jpg",
  "./unit_photos/gargoyles.jpg",
  "./unit_photos/gretchin.jpg",
  "./unit_photos/haruspex.jpg",
  "./unit_photos/intercessor-squad.jpg",
  "./unit_photos/land-speeder.jpg",
  "./unit_photos/librarian.jpg",
  "./unit_photos/neurogaunts.jpg",
  "./unit_photos/neurolictor.jpg",
  "./unit_photos/neurotyrant.jpg",
  "./unit_photos/painboy.jpg",
  "./unit_photos/psychophage.jpg",
  "./unit_photos/ripper-swarms.jpg",
  "./unit_photos/screamer-killer.jpg",
  "./unit_photos/termagants.jpg",
  "./unit_photos/vanguard-veteran-squad-with-jump-packs.jpg",
  "./unit_photos/von-ryan-s-leapers.jpg",
  "./unit_photos/warboss.jpg",
  "./unit_photos/wartrakk.jpg",
  "./unit_photos/weirdboy.jpg",
  "./unit_photos/winged-tyranid-prime.jpg",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      // Uma foto em falta (unit_photos é opcional, ver README dessa pasta)
      // não pode impedir o resto de ficar em cache.
      .catch(() => {})
    // SEM self.skipWaiting() aqui: a versão nova fica "waiting" até o
    // jogador confirmar o aviso (ou até não haver nenhuma página aberta a
    // controlar) — index.html só manda skipWaiting quando é mesmo a
    // primeira instalação (sem controller) ou quando o jogador clica
    // "Recarregar" no aviso de nova versão.
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
