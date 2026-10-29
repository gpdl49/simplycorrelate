import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Match, Media, Question, QuizExport, Team } from "../../shared/content";
import { api, type Me } from "../lib/api";

/** Query keys and hooks for the admin REST API. Mutations refetch on success; nothing is optimistic. */

export const keys = {
  me: ["me"] as const,
  teams: ["admin", "teams"] as const,
  questions: ["admin", "questions"] as const,
  matches: ["admin", "matches"] as const,
};

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Like `api` but keeps the HTTP status so a 401 can be told apart from other failures. */
async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new HttpError(data.error ?? `HTTP ${res.status}`, res.status);
  return data;
}

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => getJson<Me>("/me"), retry: false });
}

export function useTeams() {
  return useQuery({ queryKey: keys.teams, queryFn: () => getJson<Team[]>("/admin/teams") });
}
export function useQuestions() {
  return useQuery({
    queryKey: keys.questions,
    queryFn: () => getJson<Question[]>("/admin/questions"),
  });
}
export function useMatches() {
  return useQuery({ queryKey: keys.matches, queryFn: () => getJson<Match[]>("/admin/matches") });
}

/** A mutation that invalidates the given keys (and waits for the refetch) on success. */
function useApiMutation<V, R>(
  fn: (v: V) => Promise<R>,
  invalidate: readonly (readonly string[])[],
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: k }))),
  });
}

export function useSaveTeam() {
  return useApiMutation(
    (t: Partial<Team>) =>
      t.id
        ? api<Team>(`/admin/teams/${t.id}`, { method: "PUT", json: t })
        : api<Team>("/admin/teams", { method: "POST", json: t }),
    [keys.teams],
  );
}
export function useDeleteTeam() {
  return useApiMutation(
    (id: string) => api(`/admin/teams/${id}`, { method: "DELETE" }),
    [keys.teams],
  );
}
export function useReorderTeams() {
  return useApiMutation(
    (ids: string[]) => api("/admin/teams/reorder", { method: "POST", json: ids }),
    [keys.teams],
  );
}

export function useSaveQuestion() {
  return useApiMutation(
    (q: Question | Omit<Question, "id">) =>
      "id" in q && q.id
        ? api<Question>(`/admin/questions/${q.id}`, { method: "PUT", json: q })
        : api<Question>("/admin/questions", { method: "POST", json: q }),
    [keys.questions],
  );
}
export function useDeleteQuestion() {
  return useApiMutation(
    (id: string) => api(`/admin/questions/${id}`, { method: "DELETE" }),
    [keys.questions],
  );
}

export function useSaveMatch() {
  return useApiMutation(
    (m: Partial<Match>) =>
      m.id
        ? api<Match>(`/admin/matches/${m.id}`, { method: "PUT", json: m })
        : api<Match>("/admin/matches", { method: "POST", json: m }),
    [keys.matches],
  );
}
export function useDeleteMatch() {
  return useApiMutation(
    (id: string) => api(`/admin/matches/${id}`, { method: "DELETE" }),
    [keys.matches],
  );
}
export function useLockMatch() {
  return useApiMutation(
    ({ id, locked }: { id: string; locked: boolean }) =>
      api<Match>(`/admin/matches/${id}/lock`, { method: "POST", json: { locked } }),
    [keys.matches],
  );
}

export function useImport() {
  return useApiMutation(
    (data: unknown) => api<QuizExport>("/admin/import", { method: "POST", json: data }),
    [keys.teams, keys.questions, keys.matches],
  );
}

export async function uploadMedia(file: File): Promise<Media> {
  const body = new FormData();
  body.append("file", file);
  return api<Media>("/admin/media", { method: "POST", body });
}

/** questionId → names of the matches whose rounds use it. */
export function usageMap(
  matches: Match[] | undefined,
): Map<string, { id: string; name: string }[]> {
  const map = new Map<string, { id: string; name: string }[]>();
  for (const m of matches ?? []) {
    const ids = new Set(m.rounds.flatMap((r) => r.questionIds));
    for (const id of ids) {
      const list = map.get(id) ?? [];
      list.push({ id: m.id, name: m.name });
      map.set(id, list);
    }
  }
  return map;
}
