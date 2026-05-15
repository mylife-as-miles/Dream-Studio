import type { CopilotSession } from "./types";

export type MorphusFileRecord = {
  content: string;
  language: "html" | "javascript" | "css" | "text";
  path: string;
  updatedAt: number;
};

export type MorphusMemorySnapshot = {
  files: MorphusFileRecord[];
  latestGame: { title: string; html: string } | null;
  session: CopilotSession | null;
  updatedAt: number;
};

const DB_NAME = "dream-studio-morphus";
const DB_VERSION = 1;
const STORE_NAME = "memory";
const SNAPSHOT_KEY = "default";

const EMPTY_MEMORY: MorphusMemorySnapshot = {
  files: [],
  latestGame: null,
  session: null,
  updatedAt: 0
};

export async function loadMorphusMemory(): Promise<MorphusMemorySnapshot> {
  if (!canUseIndexedDb()) {
    return EMPTY_MEMORY;
  }

  try {
    const db = await openMorphusDb();
    const snapshot = await getValue<MorphusMemorySnapshot>(db, SNAPSHOT_KEY);
    db.close();
    return snapshot ?? EMPTY_MEMORY;
  } catch {
    return EMPTY_MEMORY;
  }
}

export async function saveMorphusMemory(snapshot: MorphusMemorySnapshot): Promise<void> {
  if (!canUseIndexedDb()) {
    return;
  }

  try {
    const db = await openMorphusDb();
    await setValue(db, SNAPSHOT_KEY, {
      ...snapshot,
      updatedAt: Date.now()
    });
    db.close();
  } catch {
    // Morphus memory should never block generation.
  }
}

export function createMorphusFilesFromGame(game: { title: string; html: string } | null): MorphusFileRecord[] {
  if (!game) {
    return [];
  }

  return [
    {
      content: game.html,
      language: "html",
      path: "index.html",
      updatedAt: Date.now()
    }
  ];
}

function canUseIndexedDb() {
  return typeof indexedDB !== "undefined";
}

function openMorphusDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
  });
}

function getValue<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result as T | undefined);
  });
}

function setValue(db: IDBDatabase, key: string, value: MorphusMemorySnapshot): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, key);

    request.onerror = () => reject(request.error);
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
}
