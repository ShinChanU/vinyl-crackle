import { vi } from "vitest";

type StorageArea = "sync" | "local";

interface FakeStorage {
  store: Map<string, unknown>;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
}

function makeFakeStorage(): FakeStorage {
  const store = new Map<string, unknown>();
  return {
    store,
    get: vi.fn(async (keys?: string | string[] | Record<string, unknown>) => {
      if (keys == null) return Object.fromEntries(store);
      if (typeof keys === "string") {
        return store.has(keys) ? { [keys]: store.get(keys) } : {};
      }
      if (Array.isArray(keys)) {
        const out: Record<string, unknown> = {};
        for (const k of keys) if (store.has(k)) out[k] = store.get(k);
        return out;
      }
      const out: Record<string, unknown> = { ...keys };
      for (const k of Object.keys(keys)) {
        if (store.has(k)) out[k] = store.get(k);
      }
      return out;
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(items)) store.set(k, v);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) store.delete(k);
    }),
    clear: vi.fn(async () => {
      store.clear();
    }),
  };
}

const syncStorage = makeFakeStorage();
const localStorage = makeFakeStorage();

(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    sync: syncStorage,
    local: localStorage,
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    getURL: (p: string) => `chrome-extension://test/${p}`,
  },
};

// Expose helpers for tests that want to inspect or reset state
export function resetChromeMocks(): void {
  syncStorage.store.clear();
  localStorage.store.clear();
  syncStorage.get.mockClear();
  syncStorage.set.mockClear();
  localStorage.get.mockClear();
  localStorage.set.mockClear();
}

export function seedSyncStorage(key: string, value: unknown): void {
  syncStorage.store.set(key, value);
}

export function getSyncStorage(): Map<string, unknown> {
  return syncStorage.store;
}

export function fakeStoragesForArea(area: StorageArea): FakeStorage {
  return area === "sync" ? syncStorage : localStorage;
}
