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
  // The team page adds games played and last game; the standings keep it short for phones
  full?: boolean;
}) {
  const rows = team.roster
    .map((p) => ({ p, l: livePlayer(p, live) }))
    .sort((x, y) => y.l.pts - x.l.pts || y.l.g - x.l.g || x.p.name.localeCompare(y.p.name));
  return (
    <table className="w-full text-left">
      <thead className="text-sm uppercase tracking-wider text-muted-foreground">
        <tr>
          <th className="px-3 py-2">Player</th>
          {full && <th className="px-3 py-2 text-right">GP</th>}
          <th className="px-3 py-2 text-right">G</th>
          <th className="px-3 py-2 text-right">A</th>
          <th className="px-3 py-2 text-right">P</th>
          <th className="px-3 py-2">Tonight</th>
          {full && <th className="px-3 py-2">Last game</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map(({ p, l }) => {
          const tonightPts = l.tonight ? l.tonight.g + l.tonight.a : 0;
          return (
            <tr key={p.id} className="border-t">
              <td className="px-3 py-2">
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm text-muted-foreground">
                  {p.team} · {p.pos}
                </div>
              </td>
              {full && <td className="num px-3 py-2 text-right text-lg">{l.gp}</td>}
              <td className="num px-3 py-2 text-right text-lg">{l.g}</td>
              <td className="num px-3 py-2 text-right text-lg">{l.a}</td>
              <td className="num px-3 py-2 text-right">
                <span className="text-2xl font-bold">{l.pts}</span>
                {tonightPts > 0 && (
                  <span className="ml-1.5 rounded bg-gold px-1.5 py-0.5 align-middle text-sm font-bold text-accent-foreground">
                    +{tonightPts}
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                <Tonight p={p} live={live} />
              </td>
              {full && (
                <td className="px-3 py-2 text-sm">
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
