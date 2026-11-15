import { useSyncExternalStore } from "react";

/** Shared pieces for this folder's primitives; not exported from ./index. */

const subscribeVisibility = (onChange: () => void) => {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
};

/**
 * Whether the tab is in front; loops stop in background tabs. Read only in
 * effects, so the server's "visible" guess cannot cause a mismatch.
 */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState !== "hidden",
    () => true,
  );
}
