import { type ReactNode, useId, useState } from "react";
import type { z } from "zod";
import type { Media, Question } from "../../shared/content";
import { uploadMedia } from "./queries";

/** Validation issues keyed by dotted path ("clues.2.text"). */
export type Issues = Map<string, string>;

/** Plainer wording for the zod messages admins hit most. */
function friendly(i: z.core.$ZodIssue): string {
  if (i.code === "too_small" && i.origin === "string" && Number(i.minimum) === 1) return "Required";
  if (i.code === "invalid_type" && i.expected === "number") return "Enter a whole number";
  if (i.code === "invalid_type" && i.expected === "int") return "Enter a whole number";
  if (i.code === "too_small" && i.origin === "number") return `Must be at least ${i.minimum}`;
  return i.message;
}

export function issuesOf(error: z.ZodError | undefined): Issues {
  const map: Issues = new Map();
  for (const i of error?.issues ?? []) {
    const key = i.path.join(".");
    if (!map.has(key)) map.set(key, friendly(i));
  }
  return map;
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <div className="adm-error">{children}</div>;
}

export function Banner({
  kind = "error",
  children,
}: {
  kind?: "error" | "warn" | "info" | "ok";
  children?: ReactNode;
}) {
  if (!children) return null;
  return <div className={`adm-banner adm-banner-${kind}`}>{children}</div>;
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: ReactNode;
  error?: string | undefined;
  hint?: ReactNode;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={`adm-field${error ? " adm-field-invalid" : ""}`}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <div className="adm-hint">{hint}</div>}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

export function MediaPreview({ media }: { media: Media }) {
  return media.kind === "image" ? (
    <img className="adm-media-img" src={media.url} alt="" />
  ) : (
    // biome-ignore lint/a11y/useMediaCaption: quiz audio clips have no captions
    <audio className="adm-media-audio" src={media.url} controls preload="none" />
  );
}

/** Upload / preview / remove a single media attachment. */
export function MediaField({
  value,
  onChange,
  accept = "image/*,audio/*",
  disabled,
}: {
  value: Media | undefined;
  onChange: (m: Media | undefined) => void;
  accept?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  return (
    <div className="adm-mediafield">
      {value && <MediaPreview media={value} />}
      <div className="adm-row">
        <label className={`adm-btn adm-btn-small${disabled || busy ? " adm-disabled" : ""}`}>
          {busy ? "Uploading…" : value ? "Replace media" : "Upload media"}
          <input
            id={id}
            type="file"
            accept={accept}
            hidden
            disabled={disabled || busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              setBusy(true);
              setError(null);
              try {
                onChange(await uploadMedia(file));
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        {value && (
          <button
            type="button"
            className="adm-btn adm-btn-small adm-btn-ghost"
            disabled={disabled}
            onClick={() => onChange(undefined)}
          >
            Remove media
          </button>
        )}
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

export const TYPE_LABELS: Record<Question["type"], string> = {
  standard: "Standard",
  connection: "Connection",
  sequence: "Sequence",
  wall: "Wall",
  vowels: "Missing Vowels",
};

/** One-line description of a question for lists and pickers. */
export function questionSummary(q: Question): string {
  const body = (() => {
    switch (q.type) {
      case "standard":
        return `${q.prompt} → ${q.answer}`;
      case "connection":
      case "sequence":
        return `${q.clues.map((c) => c.text || `[${c.media?.kind ?? "?"}]`).join(" · ")} → ${q.connection}`;
      case "wall":
        return q.groups.map((g) => g.connection).join(" · ");
      case "vowels":
        return `${q.category} (${q.clues.length})`;
    }
  })();
  return q.label ? `${q.label} — ${body}` : body;
}

export function TypeBadge({ type }: { type: Question["type"] }) {
  return <span className={`adm-badge adm-badge-${type}`}>{TYPE_LABELS[type]}</span>;
}
