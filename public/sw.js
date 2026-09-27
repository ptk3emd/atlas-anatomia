/**
 * Service Worker Otimizado com Particionamento de Cache Resiliente
 * Arquitetura Dual-Cache:
 * 1. CACHE_SHELL: Versões do App Shell (HTML, JS bundles, CSS, manifest) -> Stale-While-Revalidate
 * 2. CACHE_IMMUTABLE: Dados volumosos imutáveis (Modelos 3D, .bin, .bin.gz, atlas.json, basis WASM, KTX2) -> Cache-First
 * 
 * Previne expiração prematura no Safari iOS (limite de 7 dias) e gerencia cotas de armazenamento com fallback seguro.
 */

const CACHE_SHELL = 'apexmed-shell-v4';
const CACHE_IMMUTABLE = 'apexmed-immutable-v1';

// Padrões de arquivos anatômicos pesados e binários imutáveis
const IMMUTABLE_PATTERNS = [
  '/models/',
  '/basis/',
  '.bin.gz',
  '.bin',
  '.ktx2',
  'atlas.json',
  'anatomy-translations.json',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          // Mantém CACHE_IMMUTABLE intacto entre atualizações de versão do código!
          // Remove apenas versões antigas de caches do App Shell
          if (key !== CACHE_SHELL && key !== CACHE_IMMUTABLE) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = request.url;
  const isImmutable = IMMUTABLE_PATTERNS.some((pattern) => url.includes(pattern));

  // 1. ESTRATÉGIA CACHE-FIRST: Assets binários e dados anatômicos imutáveis
  if (isImmutable) {
    event.respondWith(
      caches.open(CACHE_IMMUTABLE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            try {
              await cache.put(request, networkResponse.clone());
            } catch (quotaError) {
              // Previne crash em Safari iOS caso a cota por partição seja atingida
              console.warn('[SW] Cota de armazenamento excedida ao gravar asset imutável:', quotaError);
            }
          }
          return networkResponse;
        } catch (fetchError) {
          throw fetchError;
        }
      })
    );
    return;
  }

  // 2. ESTRATÉGIA STALE-WHILE-REVALIDATE: App Shell (HTML, JS, CSS, Ícones, Manifest)
  event.respondWith(
    caches.open(CACHE_SHELL).then(async (cache) => {
      const cachedResponse = await cache.match(request);

      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            try {
              cache.put(request, networkResponse.clone());
            } catch (quotaError) {
              console.warn('[SW] Cota de armazenamento do Shell excedida:', quotaError);
            }
          }
          return networkResponse;
        })
        .catch((err) => {
          // Se offline e for requisição de navegação (HTML), entrega index.html em cache
          if (request.mode === 'navigate') {
            return cache.match('./') || cache.match('index.html') || cachedResponse;
          }
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
