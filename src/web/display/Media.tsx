import { useEffect, useState } from "react";
import type { Media } from "../../shared/content";

/** width / height of an image once it has loaded, or null (also for audio and while loading). */
export function useImageRatio(media: Media | undefined): number | null {
  const url = media?.kind === "image" ? media.url : null;
  const [ratio, setRatio] = useState<{ url: string; r: number } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    const img = new Image();
    img.onload = () => {
      if (live && img.naturalWidth && img.naturalHeight)
        setRatio({ url, r: img.naturalWidth / img.naturalHeight });
    };
    img.src = url;
    return () => {
      live = false;
    };
  }, [url]);
  return url && ratio?.url === url ? ratio.r : null;
}

/**
 * Image or audio attached to a question or clue. Audio is played by the host on the laptop.
 * `fit`: the image scales (up as well as down) to the largest size that fits its parent, which
 * must be a size container (`.d-fit`).
 */
export function MediaView({
  media,
  className = "",
  fit = false,
}: {
  media: Media;
  className?: string;
  fit?: boolean;
}) {
  const r = useImageRatio(fit ? media : undefined);
  if (media.kind === "image") {
    if (!fit) return <img className={`d-media-img ${className}`} src={media.url} alt="" />;
    return (
      <img
        className={`d-media-img d-media-fit${r ? " is-sized" : ""} ${className}`}
        src={media.url}
        alt=""
        style={r ? ({ "--ar": r } as React.CSSProperties) : undefined}
      />
    );
  }
  return (
    <div className={`d-media-audio ${className}`}>
      <svg className="d-speaker" viewBox="0 0 24 24" aria-hidden>
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        <path
          d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      {/* biome-ignore lint/a11y/useMediaCaption: quiz audio clues have no captions */}
      <audio controls preload="auto" src={media.url} />
    </div>
  );
}

/** Image (or audio) shown inside a revealed answer box. */
export function AnswerMedia({ media }: { media: Media }) {
  return (
    <span className="d-answer-media">
      <MediaView media={media} />
    </span>
  );
}
