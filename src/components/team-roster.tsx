// A pool team's players with live season points: synced games plus tonight's goals and assists
// as they happen, so each player's P adds up to the team's live total in the standings
import { livePlayer, type LiveData } from "@/lib/live";
import type { PlayerLine, SeasonTeam } from "@/lib/season";
import { fmtDate } from "@/lib/season-query";

function Tonight({ p, live }: { p: PlayerLine; live: LiveData }) {
  const lp = live.players[p.id];
  if (!live.anyGames || !lp || lp.status === "none")
    return p.playsNext ? (
      <span className="whitespace-nowrap rounded bg-gold/30 px-2 py-0.5 text-sm font-semibold">
        Plays next
      </span>
    ) : (
      <span className="text-muted-foreground">–</span>
    );
  const line = lp.g + lp.a ? `${lp.g}G ${lp.a}A` : "";
  if (lp.status === "live")
    return (
      <span className="whitespace-nowrap rounded bg-red px-2 py-0.5 text-sm font-bold text-white">
        Live{line ? ` · ${line}` : ""}
      </span>
    );
  if (lp.status === "upcoming") {
    const game = live.games.find((g) => g.away === p.team || g.home === p.team);
    return (
      <span className="whitespace-nowrap rounded bg-gold px-2 py-0.5 text-sm font-semibold text-accent-foreground">
        {game ? game.label : "Tonight"}
      </span>
    );
  }
  return (
    <span className={`whitespace-nowrap text-sm ${line ? "font-bold" : "text-muted-foreground"}`}>
      Final{line ? ` · ${line}` : ""}
    </span>
  );
}

export function TeamRoster({
  team,
  live,
  full = false,
}: {
  team: SeasonTeam;
  live: LiveData;
  // The team locker adds games played and last game on wider screens; the standings keep it short
  full?: boolean;
}) {
  // In the order the team drafted them
  const order = new Map(team.drafted.map((d, i) => [d.id, i]));
  const round = new Map(team.drafted.map((d) => [d.id, d.round]));
  const rows = team.roster
    .map((p) => ({ p, l: livePlayer(p, live) }))
    .sort((x, y) => (order.get(x.p.id) ?? 99) - (order.get(y.p.id) ?? 99));
  return (
    <table className="w-full text-left">
      <thead className="text-sm uppercase tracking-wider text-muted-foreground">
        <tr>
          <th className="px-2 py-2 sm:px-3">Player</th>
          {full && <th className="hidden px-2 py-2 sm:px-3 text-right sm:table-cell">GP</th>}
          <th className="px-2 py-2 sm:px-3 text-right">G</th>
          <th className="px-2 py-2 sm:px-3 text-right">A</th>
          <th className="px-2 py-2 sm:px-3 text-right">P</th>
          <th className="px-2 py-2 sm:px-3">Tonight</th>
          {full && <th className="hidden px-2 py-2 sm:px-3 sm:table-cell">Last game</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ p, l }) => {
          const tonightPts = l.tonight ? l.tonight.g + l.tonight.a : 0;
          return (
            <tr key={p.id} className="border-t">
              <td className="px-2 py-2 sm:px-3">
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm text-muted-foreground">
                  {p.team} · {p.pos} ·{" "}
                  {round.get(p.id) != null ? `Rd\u00a0${round.get(p.id)}` : "Swap"}
                </div>
              </td>
              {full && (
                <td className="num hidden px-2 py-2 sm:px-3 text-right text-lg sm:table-cell">
                  {l.gp}
                </td>
              )}
              <td className="num px-2 py-2 sm:px-3 text-right text-lg">{l.g}</td>
              <td className="num px-2 py-2 sm:px-3 text-right text-lg">{l.a}</td>
              <td className="num px-2 py-2 sm:px-3 text-right">
                <span className="text-2xl font-bold">{l.pts}</span>
                {tonightPts > 0 && (
                  <span className="ml-1.5 rounded bg-gold px-1.5 py-0.5 align-middle text-sm font-bold text-accent-foreground">
                    +{tonightPts}
                  </span>
                )}
              </td>
              <td className="px-2 py-2 sm:px-3">
                <Tonight p={p} live={live} />
              </td>
              {full && (
                <td className="hidden px-2 py-2 sm:px-3 text-sm sm:table-cell">
                  {p.lastGame
                    ? `${fmtDate(p.lastGame.date)} ${p.lastGame.home ? "vs" : "@"} ${p.lastGame.opp}: ${p.lastGame.g}G ${p.lastGame.a}A`
                    : "—"}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
