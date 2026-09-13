export type AuthStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export function createMemoryStorage(): AuthStorage {
  const values = new Map<string, string>();
  return {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
    removeItem: async (key) => {
      values.delete(key);
    },
  };
}

function getSessionStorage(): Storage | null {
  if (typeof globalThis === "undefined" || !("sessionStorage" in globalThis)) {
    return null;
  }

  return globalThis.sessionStorage;
}

export function createWebStorage(): AuthStorage {
  return {
    getItem: async (key) => getSessionStorage()?.getItem(key) ?? null,
    setItem: async (key, value) => {
      getSessionStorage()?.setItem(key, value);
    },
    removeItem: async (key) => {
      getSessionStorage()?.removeItem(key);
    },
  };
}
