const CACHE_PREFIX = "shifter-pwa-";
const SHELL_CACHE = `${CACHE_PREFIX}shell-v1`;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const appRoot = new URL("./", self.registration.scope);
    const shell = await caches.open(SHELL_CACHE);
    await shell.addAll([
      appRoot.href,
      new URL("site.webmanifest", appRoot).href,
      new URL("favicon.svg", appRoot).href,
      new URL("favicon.ico", appRoot).href,
      new URL("apple-touch-icon.png", appRoot).href,
      new URL("web-app-manifest-192x192.png", appRoot).href,
      new URL("web-app-manifest-512x512.png", appRoot).href,
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== SHELL_CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  const appRoot = new URL(self.registration.scope);
  if (requestUrl.origin !== appRoot.origin || !requestUrl.pathname.startsWith(appRoot.pathname)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const shell = await caches.open(SHELL_CACHE);
          await shell.put(appRoot.href, response.clone());
        }
        return response;
      } catch {
        const shell = await caches.open(SHELL_CACHE);
        return (await shell.match(appRoot.href)) ?? Response.error();
      }
    })());
    return;
  }

  if (requestUrl.pathname.includes("/assets/") || /\/(site\.webmanifest|favicon\.svg|favicon\.ico|apple-touch-icon\.png|web-app-manifest-(192x192|512x512)\.png)$/.test(requestUrl.pathname)) {
    event.respondWith((async () => {
      const shell = await caches.open(SHELL_CACHE);
      const cached = await shell.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        await shell.put(request, response.clone());
      }
      return response;
    })());
  }
});
