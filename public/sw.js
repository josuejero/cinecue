/* global self, caches, clients */

const CACHE_NAME = "cinecue-web-v2";
const LEGACY_CACHE_NAMES = ["cinecue", `phase${5}`, "v1"];
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll([OFFLINE_URL, "/favicon.ico"]))
      .catch(() => undefined),
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (cacheNames) => {
      await Promise.all(
        cacheNames
          .filter((cacheName) => LEGACY_CACHE_NAMES.join("-") === cacheName)
          .map((cacheName) => caches.delete(cacheName)),
      );

      return self.clients.claim();
    }),
  );
});

self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};

  const title = payload.title || "CineCue update";
  const options = {
    body: payload.body || "A followed movie changed near you.",
    icon: "/icon",
    badge: "/favicon.ico",
    data: {
      url: payload.url || "/dashboard",
    },
    tag: payload.tag || undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    (event.notification &&
      event.notification.data &&
      event.notification.data.url) ||
    "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return cache.match(OFFLINE_URL);
      }),
    );
  }
});
