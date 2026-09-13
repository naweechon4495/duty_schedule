"use client";

import { useSyncExternalStore } from "react";

/** store เล็ก ๆ สำหรับสถานะที่ต้องเรียกจากนอก React (เช่น confirmDialog()) */
export function createStore<T extends object>(initial: T) {
  let state = initial;
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set: (patch: Partial<T>) => {
      state = { ...state, ...patch };
      subs.forEach((s) => s());
    },
    use: () =>
      useSyncExternalStore(
        (cb) => {
          subs.add(cb);
          return () => subs.delete(cb);
        },
        () => state,
        () => state,
      ),
  };
}
