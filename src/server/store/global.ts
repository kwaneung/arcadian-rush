import "server-only";

import { createMemoryStore, type RunStore } from "@/server/store/memory";

const globalStore = globalThis as typeof globalThis & {
  __arcadianRunStore?: RunStore;
};

export function getRunStore(): RunStore {
  if (!globalStore.__arcadianRunStore) {
    globalStore.__arcadianRunStore = createMemoryStore();
  }
  return globalStore.__arcadianRunStore;
}
