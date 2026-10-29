import { useState } from "react";
import type { Team } from "../../shared/content";
import { useDeleteTeam, useMatches, useReorderTeams, useSaveTeam, useTeams } from "./queries";
import { Banner } from "./ui";

const PALETTE = ["#2977F5", "#E8484E", "#1FB58F", "#F5A524", "#9B5DE5", "#EC6FB0", "#13A3C4"];

export function TeamsPage() {
  const teams = useTeams();
  const matches = useMatches();
  const save = useSaveTeam();
  const del = useDeleteTeam();
  const reorder = useReorderTeams();
  const [name, setName] = useState("");
  const busy = save.isPending || del.isPending || reorder.isPending || teams.isFetching;
  const error = save.error ?? del.error ?? reorder.error;

  if (teams.isPending) return <p>Loading teams…</p>;
  if (teams.isError) return <Banner>{teams.error.message}</Banner>;
  const list = teams.data;

  function move(i: number, d: -1 | 1) {
    const ids = list.map((t) => t.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    reorder.mutate(ids);
  }

  return (
    <section>
      <div className="adm-pagehead">
        <h2>Teams</h2>
      </div>
      <Banner>{error?.message}</Banner>
      <form
        className="adm-card adm-row"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) return;
          save.mutate(
            { name: n, color: PALETTE[list.length % PALETTE.length]! },
            { onSuccess: () => setName("") },
          );
        }}
      >
        <input
          className="adm-input adm-grow"
          placeholder="New team name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="adm-btn adm-btn-primary" disabled={busy || !name.trim()}>
          Add team
        </button>
      </form>
      <ul className="adm-list">
        {list.map((t, i) => (
          <TeamRow
            key={t.id}
            team={t}
            busy={busy}
            first={i === 0}
            last={i === list.length - 1}
            usedIn={(matches.data ?? []).filter((m) => m.teamIds.includes(t.id)).map((m) => m.name)}
            onSave={(next) => save.mutate(next)}
            onDelete={() => {
              if (confirm(`Delete team "${t.name}"?`)) del.mutate(t.id);
            }}
            onMove={(d) => move(i, d)}
          />
        ))}
        {list.length === 0 && <li className="adm-empty">No teams yet.</li>}
      </ul>
    </section>
  );
}

function TeamRow({
  team,
  busy,
  first,
  last,
  usedIn,
  onSave,
  onDelete,
  onMove,
}: {
  team: Team;
  busy: boolean;
  first: boolean;
  last: boolean;
  usedIn: string[];
  onSave: (t: Team) => void;
  onDelete: () => void;
  onMove: (d: -1 | 1) => void;
}) {
  const [name, setName] = useState(team.name);
  const [color, setColor] = useState(team.color);
  const dirty = name.trim() !== team.name || color.toLowerCase() !== team.color.toLowerCase();
  return (
    <li className="adm-list-item adm-team">
      <span className="adm-swatch" style={{ background: color }} />
      <input
        type="color"
        aria-label="Team colour"
        value={color}
        disabled={busy}
        onChange={(e) => setColor(e.target.value)}
      />
      <input
        className="adm-input adm-grow"
        aria-label="Team name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && dirty && name.trim())
            onSave({ ...team, name: name.trim(), color });
        }}
      />
      {usedIn.length > 0 && <span className="adm-muted adm-small">in {usedIn.join(", ")}</span>}
      <div className="adm-row adm-nowrap">
        <button
          type="button"
          className="adm-btn adm-btn-small adm-btn-primary"
          disabled={busy || !dirty || !name.trim()}
          onClick={() => onSave({ ...team, name: name.trim(), color })}
        >
          Save
        </button>
        <button
          type="button"
          className="adm-btn adm-btn-small"
          aria-label="Move up"
          disabled={busy || first}
          onClick={() => onMove(-1)}
        >
          ↑
        </button>
        <button
          type="button"
          className="adm-btn adm-btn-small"
          aria-label="Move down"
          disabled={busy || last}
          onClick={() => onMove(1)}
        >
          ↓
        </button>
        <button
          type="button"
          className="adm-btn adm-btn-small adm-btn-danger"
          disabled={busy}
          title={usedIn.length ? `Used in ${usedIn.join(", ")}` : undefined}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </li>
  );
}
