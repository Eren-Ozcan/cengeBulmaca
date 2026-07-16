// Test yardımcıları: Node ortamında tarayıcı localStorage'ının yerine geçen
// bellek içi depo. game.ts ve stats.ts testleri bunu globale takar.

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

/** Testler için globalThis.localStorage'ı bellek içi depoyla değiştirir. */
export function installMemoryStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  (globalThis as { localStorage: Storage }).localStorage = storage;
  return storage;
}
