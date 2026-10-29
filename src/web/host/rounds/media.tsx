import type { Clue, Media } from "../../../shared/content";

export function MediaThumb({ media }: { media: Media }) {
  if (media.kind === "image") return <img className="h-media" src={media.url} alt="" />;
  return <span className="h-media-audio">🔊 audio clip</span>;
}

export function ClueBody({ clue }: { clue: Clue }) {
  return (
    <>
      {clue.text && <span>{clue.text}</span>}
      {clue.media && <MediaThumb media={clue.media} />}
      {!clue.text && !clue.media && <span className="h-muted">(empty)</span>}
    </>
  );
}
