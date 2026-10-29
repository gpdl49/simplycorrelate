import { type ButtonHTMLAttributes, type ReactNode, useEffect, useRef, useState } from "react";
import type { Team } from "../../shared/content";
import type { Action } from "../../shared/game";

export type Act = (action: Action) => void;

export function haptic(): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(10);
    } catch {
      // Some browsers throw when vibration is blocked; ignore.
    }
  }
}

type Tone = "primary" | "ok" | "bad" | "warn" | "ghost" | "neutral";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  big?: boolean;
  active?: boolean;
}

/** Large tap target with haptic feedback. */
export function Btn({ tone = "neutral", big, active, className, onClick, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`h-btn h-${tone}${big ? " h-big" : ""}${active ? " h-active" : ""} ${className ?? ""}`}
      onClick={(e) => {
        haptic();
        onClick?.(e);
      }}
    />
  );
}

/**
 * Two-step button for destructive actions: the first tap arms it ("Tap again to …"),
 * a second tap within 3s fires. Disarms on timeout.
 */
export function ConfirmBtn({
  onConfirm,
  confirmLabel,
  children,
  needsConfirm = true,
  tone = "warn",
  ...rest
}: Omit<BtnProps, "onClick"> & {
  onConfirm: () => void;
  confirmLabel?: ReactNode;
  needsConfirm?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <Btn
      {...rest}
      tone={armed ? "bad" : tone}
      className={`${rest.className ?? ""}${armed ? " h-armed" : ""}`}
      onClick={() => {
        if (!needsConfirm || armed) {
          window.clearTimeout(timer.current);
          setArmed(false);
          onConfirm();
          return;
        }
        setArmed(true);
        timer.current = window.setTimeout(() => setArmed(false), 3000);
      }}
    >
      {armed ? (confirmLabel ?? "Tap again to confirm") : children}
    </Btn>
  );
}

/** Black or white text, whichever reads better on `hex`. */
export function inkFor(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111c23" : "#ffffff";
}

export function TeamBtn({
  team,
  ...rest
}: Omit<BtnProps, "tone" | "style"> & { team: Team; children?: ReactNode }) {
  return (
    <Btn
      {...rest}
      className={`h-team ${rest.className ?? ""}`}
      style={{ background: team.color, color: inkFor(team.color) }}
    >
      {rest.children ?? team.name}
    </Btn>
  );
}

export function Card({
  title,
  right,
  children,
  className,
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`h-card ${className ?? ""}`}>
      {(title || right) && (
        <header className="h-card-head">
          <h3>{title}</h3>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

/** Sticky bar at the bottom of the scroll area, within thumb reach. */
export function ActionBar({ children, cols = 2 }: { children: ReactNode; cols?: number }) {
  return (
    <div className="h-actionbar" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {children}
    </div>
  );
}
