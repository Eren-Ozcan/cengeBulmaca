// Test helpers: an in-memory store that substitutes for browser localStorage
// in a Node environment. game.ts and stats.ts tests attach this globally.

export class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
}

/** Replaces globalThis.localStorage with an in-memory store, for tests. */
export function installMemoryStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  (globalThis as { localStorage: Storage }).localStorage = storage;
  return storage;
}
