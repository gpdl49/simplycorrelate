import { useEffect, useState } from "react";
import type { Timer } from "../../shared/game";

/** Remaining ms on a server timer, re-rendering ~10×/s while it runs. */
export function useTimerRemaining(timer: Timer | null | undefined, clockOffset: number): number {
  const compute = () => {
    if (!timer) return 0;
    if (timer.startedAt === null) return timer.remainingMs;
    return Math.max(0, timer.remainingMs - (Date.now() + clockOffset - timer.startedAt));
  };
  const [ms, setMs] = useState(compute);
  useEffect(() => {
    setMs(compute());
    if (!timer || timer.startedAt === null) return;
    const id = window.setInterval(() => setMs(compute()), 100);
    return () => window.clearInterval(id);
    // biome-ignore lint/correctness/useExhaustiveDependencies: compute closes over these
  }, [timer, clockOffset]);
  return ms;
}

export function formatMs(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
