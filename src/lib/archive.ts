// Each season's pool rosters for the team lockers (table roster_archive). The daily sync
// rewrites the current season's rows from computeSeason(), so after the last game day they hold
// the final rosters, and they stay in the lockers once the next season starts. Public data only.
import type { Draft, Move, SeasonData } from "./season";

export type ArchivedPlayer = {
  id: number;
  name: string;
  team: string | null;
  pos: string | null;
  round: number | null; // null: swapped in
  pick: number | null;
  gp: number;
  g: number;
  a: number;
  pts: number;
  added: string | null; // swap date
};
export type ArchivedDrop = {
  id: number;
  name: string;
  team: string | null;
  pos: string | null;
  gp: number;
  g: number;
  a: number;
  pts: number;
  dropped: string;
  replacedBy: string | null;
};
export type ArchivedRoster = {
  season_id: string;
  slot: number;
  team_name: string;
  rank: number;
  points: number;
  players: ArchivedPlayer[];
  dropped: ArchivedDrop[];
};

export function archiveRows(
  seasonId: string,
  data: SeasonData,
  draft: Draft,
  moves: Move[],
): ArchivedRoster[] {
  return data.teams.map((t) => {
    const line = new Map(t.roster.map((p) => [p.id, p]));
    return {
      season_id: seasonId,
      slot: t.slot,
      team_name: t.name,
      rank: t.rank,
      points: t.pts,
      // In the order the team drafted them, a swapped-in player in the place of the one he replaced
      players: t.drafted.flatMap(({ id, round }) => {
        const p = line.get(id);
        if (!p) return [];
        const pick = draft.picks.find((x) => x.slot === t.slot && x.id === id);
        const move = moves.filter((m) => m.slot === t.slot && m.in === id).at(-1);
        return [
          {
            id,
            name: p.name,
            team: p.team,
            pos: p.pos,
            round,
            pick: pick?.pick ?? null,
            gp: p.gp,
            g: p.g,
            a: p.a,
            pts: p.pts,
            added: round == null ? (move?.date ?? null) : null,
          },
        ];
      }),
      dropped: t.dropped.map((p) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        pos: p.pos,
        gp: p.gp,
        g: p.g,
        a: p.a,
        pts: p.pts,
        dropped: p.droppedOn,
        replacedBy: p.replacedBy ?? null,
      })),
    };
  });
}
