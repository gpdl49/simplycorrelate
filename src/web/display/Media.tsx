import type { Media } from "../../shared/content";

/** Image or audio attached to a question or clue. Audio is played by the host on the laptop. */
export function MediaView({ media, className = "" }: { media: Media; className?: string }) {
  if (media.kind === "image") {
    return <img className={`d-media-img ${className}`} src={media.url} alt="" />;
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
