import { useEffect, useState } from "react";

/** Keeps the screen awake; re-acquires when the page becomes visible again. Returns whether a lock is held. */
export function useWakeLock(): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;
    const acquire = async () => {
      if (document.visibilityState !== "visible" || (lock && !lock.released)) return;
      try {
        lock = await navigator.wakeLock.request("screen");
        if (stopped) {
          void lock.release();
          return;
        }
        setHeld(true);
        lock.addEventListener("release", () => setHeld(false));
      } catch {
        setHeld(false);
      }
    };
    void acquire();
    const onVisible = () => void acquire();
    document.addEventListener("visibilitychange", onVisible);
    // Some browsers only grant the lock after a user gesture.
    document.addEventListener("pointerdown", onVisible, { passive: true });
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      document.removeEventListener("pointerdown", onVisible);
      void lock?.release();
    };
  }, []);
  return held;
}
