import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

function readServiceWorker() {
  return fs.readFileSync(path.resolve(process.cwd(), "public/sw.js"), "utf8");
}

describe("service worker", () => {
  it("deletes the legacy cache during activation and keeps the current cache", async () => {
    const handlers = new Map<string, (event: { waitUntil: (promise: Promise<unknown>) => void }) => void>();
    const deleteCache = vi.fn().mockResolvedValue(true);
    const claim = vi.fn().mockResolvedValue(undefined);
    const legacyCacheName = ["cinecue", `phase${5}`, "v1"].join("-");
    const currentCacheName = "cinecue-web-v2";
    let activationPromise: Promise<unknown> | undefined;

    vm.runInNewContext(readServiceWorker(), {
      self: {
        addEventListener: (name: string, handler: (event: { waitUntil: (promise: Promise<unknown>) => void }) => void) => {
          handlers.set(name, handler);
        },
        skipWaiting: vi.fn(),
        clients: { claim },
        registration: { showNotification: vi.fn() },
      },
      caches: {
        keys: vi.fn().mockResolvedValue([legacyCacheName, currentCacheName, "other-cache"]),
        delete: deleteCache,
        open: vi.fn(),
      },
      clients: {
        matchAll: vi.fn(),
        openWindow: vi.fn(),
      },
      fetch: vi.fn(),
      Promise,
    });

    handlers.get("activate")?.({
      waitUntil: (promise) => {
        activationPromise = promise;
      },
    });

    await activationPromise;

    expect(deleteCache).toHaveBeenCalledWith(legacyCacheName);
    expect(deleteCache).not.toHaveBeenCalledWith(currentCacheName);
    expect(claim).toHaveBeenCalledOnce();
  });
});
