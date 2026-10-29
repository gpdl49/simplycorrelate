import type { Team } from "../../../shared/content";
import type { SlotView } from "../../../shared/view";
import { type Act, Card, haptic } from "../ui";

export function SlotPicker({
  slots,
  turnTeam,
  act,
  noun,
}: {
  slots: SlotView[];
  turnTeam: Team | undefined;
  act: Act;
  noun: string;
}) {
  const left = slots.filter((s) => s.available).length;
  return (
    <Card
      title={
        <>
          Pick a {noun}
          {turnTeam && (
            <span className="h-turntag" style={{ background: turnTeam.color }}>
              {turnTeam.name}
            </span>
          )}
        </>
      }
      right={<span className="h-muted h-small">{left} left</span>}
    >
      {left === 0 && (
        <p className="h-muted">All {noun}s played. Go to the next round from Match.</p>
      )}
      <div className="h-glyphs">
        {slots.map((s) => (
          <button
            type="button"
            key={s.slot}
            className={`h-glyph${s.available ? "" : " used"}`}
            disabled={!s.available}
            onClick={() => {
              haptic();
              act({ type: "pickSlot", slot: s.slot });
            }}
          >
            <span className="h-glyph-sym">{s.glyph.symbol}</span>
            <span className="h-glyph-name">{s.glyph.name}</span>
            <span className="h-glyph-label">
              {s.available ? s.label : s.label ? "used" : "empty"}
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}
