import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { roundTitle, type Team } from "../../shared/content";
import { useDeleteMatch, useLockMatch, useMatches, useSaveMatch, useTeams } from "./queries";
import { Banner } from "./ui";

export function TeamPicker({
  teams,
  value,
  onChange,
  disabled,
}: {
  teams: Team[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="adm-teampick">
      {teams.map((t) => {
        const on = value.includes(t.id);
        return (
          <label key={t.id} className={`adm-check${on ? " adm-check-on" : ""}`}>
            <input
              type="checkbox"
              checked={on}
              disabled={disabled || (!on && value.length >= 6)}
              onChange={() =>
                // Keep the team order from the Teams page.
                onChange(
                  teams.map((x) => x.id).filter((id) => (id === t.id ? !on : value.includes(id))),
                )
              }
            />
            <span className="adm-swatch" style={{ background: t.color }} />
            {t.name}
          </label>
        );
      })}
      {teams.length === 0 && (
        <span className="adm-muted">
          No teams yet. <Link to="/admin/teams">Add some</Link>.
        </span>
      )}
    </div>
  );
}

export function MatchesPage() {
  const matches = useMatches();
  const teams = useTeams();
  const save = useSaveMatch();
  const del = useDeleteMatch();
  const lock = useLockMatch();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [attempted, setAttempted] = useState(false);

  if (matches.isPending || teams.isPending) return <p>Loading matches…</p>;
  if (matches.isError) return <Banner>{matches.error.message}</Banner>;
  if (teams.isError) return <Banner>{teams.error.message}</Banner>;
  const teamById = new Map(teams.data.map((t) => [t.id, t]));

  const nameError = !name.trim() ? "Give the match a name" : undefined;
  const teamError =
    teamIds.length < 1
      ? "Pick at least one team"
      : teamIds.length > 6
        ? "At most six teams"
        : undefined;

  return (
    <section>
      <div className="adm-pagehead">
        <h2>Matches</h2>
      </div>
      <form
        className="adm-card adm-form"
        onSubmit={(e) => {
          e.preventDefault();
          setAttempted(true);
          if (nameError || teamError) return;
          save.mutate(
            { name: name.trim(), teamIds, rounds: [] },
            {
              onSuccess: (m) => {
                setName("");
                setTeamIds([]);
                setAttempted(false);
                navigate(`/admin/matches/${m.id}`);
              },
            },
          );
        }}
      >
        <h3>New match</h3>
        <div className="adm-field">
          <label htmlFor="new-match-name">Name</label>
          <input
            id="new-match-name"
            className="adm-input"
            placeholder="e.g. Semi-final 1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {attempted && nameError && <div className="adm-error">{nameError}</div>}
        </div>
        <div className="adm-field">
          <span className="adm-label">Teams (1–6)</span>
          <TeamPicker teams={teams.data} value={teamIds} onChange={setTeamIds} />
          {attempted && teamError && <div className="adm-error">{teamError}</div>}
        </div>
        <Banner>{save.error?.message}</Banner>
        <div className="adm-row">
          <button type="submit" className="adm-btn adm-btn-primary" disabled={save.isPending}>
            Create match
          </button>
        </div>
      </form>
      <Banner>{(del.error ?? lock.error)?.message}</Banner>
      <ul className="adm-list">
        {matches.data.map((m) => (
          <li key={m.id} className="adm-list-item adm-match-item">
            <div className="adm-grow">
              <Link className="adm-qlink adm-match-name" to={`/admin/matches/${m.id}`}>
                {m.name}
              </Link>
              {m.locked && <span className="adm-badge adm-badge-locked">Locked</span>}
              <div className="adm-small adm-muted">
                {m.teamIds.map((id) => teamById.get(id)?.name ?? "?").join(" · ")}
              </div>
              <div className="adm-small adm-muted">
                {m.rounds.length
                  ? m.rounds.map((r) => `${roundTitle(r)} (${r.questionIds.length})`).join(" → ")
                  : "No rounds yet"}
              </div>
            </div>
            <div className="adm-row adm-nowrap">
              <button
                type="button"
                className="adm-btn adm-btn-small"
                disabled={lock.isPending || matches.isFetching}
                onClick={() => lock.mutate({ id: m.id, locked: !m.locked })}
              >
                {m.locked ? "Unlock" : "Lock"}
              </button>
              <button
                type="button"
                className="adm-btn adm-btn-small adm-btn-danger"
                disabled={del.isPending || m.locked}
                title={m.locked ? "Unlock the match to delete it" : undefined}
                onClick={() => {
                  if (confirm(`Delete match "${m.name}"? Its questions stay in the bank.`))
                    del.mutate(m.id);
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {matches.data.length === 0 && <li className="adm-empty">No matches yet.</li>}
      </ul>
    </section>
  );
}
