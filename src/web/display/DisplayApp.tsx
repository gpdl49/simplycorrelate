import { type MouseEvent, useEffect, useRef, useState } from "react";
import type { GameView } from "../../shared/view";
import { useGame } from "../lib/useGame";
import { BoardRound } from "./BoardRound";
import { ConnectionRound } from "./ConnectionRound";
import { RoundFrame } from "./chrome";
import { StandardRound } from "./StandardRound";
import { Holding, Leaderboard, Message, RoundSplash, Scoreboard } from "./screens";
import { VowelsRound } from "./VowelsRound";
import { WallRound } from "./WallRound";
import "./display.css";

const SPLASH_MS = 3200;

/** Shows the round-title splash when the host moves to a new round. */
function useRoundSplash(view: GameView | null): number | null {
  const screen = view?.screen;
  const index = view?.roundIndex ?? null;
  const last = useRef<number | null | undefined>(undefined);
  const [splash, setSplash] = useState<number | null>(null);
  useEffect(() => {
    if (screen === undefined) return;
    const prev = last.current;
    last.current = index;
    // No splash on first load (e.g. a reload mid-round), only on a change.
    if (prev === undefined || index === null || index === prev || screen !== "round") return;
    setSplash(index);
    const t = window.setTimeout(() => setSplash(null), SPLASH_MS);
    return () => {
      window.clearTimeout(t);
      setSplash(null);
    };
  }, [screen, index]);
  return screen === "round" ? splash : null;
}

function useFullscreen(): boolean {
  const [fs, setFs] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  return fs;
}

/** Hides the mouse pointer after a few idle seconds. */
function useIdleCursor(): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let t = window.setTimeout(() => setIdle(true), 3000);
    const move = () => {
      setIdle(false);
      window.clearTimeout(t);
      t = window.setTimeout(() => setIdle(true), 3000);
    };
    window.addEventListener("mousemove", move);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("mousemove", move);
    };
  }, []);
  return idle;
}

function toggleFullscreen(e: MouseEvent) {
  if ((e.target as HTMLElement).closest("audio, a, button")) return;
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.().catch(() => {});
}

function Screen({
  view,
  clockOffset,
  fullscreen,
}: {
  view: GameView;
  clockOffset: number;
  fullscreen: boolean;
}) {
  switch (view.screen) {
    case "holding":
      return <Holding view={view} fullscreen={fullscreen} />;
    case "scoreboard":
      return <Scoreboard view={view} />;
    case "leaderboard":
      return <Leaderboard view={view} />;
    case "round": {
      const round = view.round;
      const title =
        (view.roundIndex !== null ? view.match?.rounds[view.roundIndex]?.title : undefined) ?? "";
      const props = { view, title, clockOffset };
      switch (round?.type) {
        case "standard":
          return <StandardRound {...props} round={round} />;
        case "connection":
        case "sequence":
          return <ConnectionRound {...props} round={round} />;
        case "wall":
          return <WallRound {...props} round={round} />;
        case "vowels":
          return <VowelsRound {...props} round={round} />;
        case "board":
          return <BoardRound {...props} round={round} />;
        default:
          return (
            <RoundFrame view={view} title={title} clockOffset={clockOffset} active={null}>
              <div className="d-vow-card">
                <h1 className="d-vow-title">Get ready</h1>
              </div>
            </RoundFrame>
          );
      }
    }
  }
}

export function DisplayApp() {
  const { view, connected, unauthorised, clockOffset } = useGame("display");
  const splash = useRoundSplash(view);
  const fullscreen = useFullscreen();
  const idle = useIdleCursor();

  let content: React.ReactNode;
  if (unauthorised) {
    content = (
      <Message
        title="Please log in"
        body="This display isn't signed in. Log in on this laptop, then reload the page."
      />
    );
  } else if (!view) {
    content = <Holding view={null} fullscreen={fullscreen} />;
  } else {
    content = (
      <>
        <div className="d-screen" key={view.screen}>
          <Screen view={view} clockOffset={clockOffset} fullscreen={fullscreen} />
        </div>
        {splash !== null && <RoundSplash view={view} index={splash} />}
      </>
    );
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: click-to-fullscreen on a non-interactive projector screen
    <div className={`d-root${idle ? " is-idle" : ""}`} onClick={toggleFullscreen}>
      <div className="d-stage">
        {content}
        {!connected && !unauthorised && <span className="d-offline" title="Disconnected" />}
      </div>
    </div>
  );
}
