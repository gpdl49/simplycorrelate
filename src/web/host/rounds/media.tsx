import type { Clue, Media } from "../../../shared/content";

/** `big`: the image stands in for the prompt (image-only question). */
export function MediaThumb({ media, big = false }: { media: Media; big?: boolean }) {
  if (media.kind === "image")
    return <img className={`h-media${big ? " h-media-big" : ""}`} src={media.url} alt="" />;
  return <span className="h-media-audio">🔊 audio clip</span>;
}

/** The answer, with its answer image (if any) as a thumbnail beside it. */
export function AnswerBox({
  tag,
  answer,
  media,
  className = "",
}: {
  tag: string;
  answer: string;
  media?: Media | undefined;
  className?: string;
}) {
  return (
    <div className={`h-answer ${media ? "h-answer-media " : ""}${className}`}>
      <div className="h-answer-words">
        <span className="h-answer-tag">{tag}</span>
        <span>{answer}</span>
      </div>
      {media?.kind === "image" && <img className="h-answer-thumb" src={media.url} alt="" />}
      {media?.kind === "audio" && <span className="h-media-audio">🔊</span>}
    </div>
  );
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
