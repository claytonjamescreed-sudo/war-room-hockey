// A pool team's players with live season points: synced games plus tonight's goals and assists
// as they happen, so each player's P adds up to the team's live total in the standings
import { isOut, type Injury } from "@/lib/injuries";
import { rosterRows, startTimePT, type LiveData } from "@/lib/live";
import { perGame } from "@/lib/man-games";
import type { PlayerLine, SeasonTeam } from "@/lib/season";
import { fmtDate } from "@/lib/season-query";

// On the injury report: a red badge for out of the lineup (injured reserve, out, suspended), an
// outlined one for day-to-day. Hover for the details.
export function InjuryBadge({ injury, games }: { injury: Injury; games?: number }) {
  return (
    <span
      title={injuryText(injury, games)}
      className={`whitespace-nowrap rounded px-1.5 py-0.5 align-middle text-xs font-bold ${
        isOut(injury) ? "bg-red text-white" : "border border-red text-red"
      }`}
    >
      {injury.label}
    </span>
  );
}

// "Injured Reserve · Upper Body · expected back Oct 5 (about 2 games)". The date is ESPN's
// estimate; the games are his team's before then, which his projection leaves out.
const injuryText = (i: Injury, games = 0) =>
  [
    i.status,
    i.detail,
    i.returnDate
      ? `expected back ${fmtDate(i.returnDate)}${games ? ` (about ${games} game${games === 1 ? "" : "s"})` : ""}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

// A player's name with his NHL team, position and draft round, and his injury if he has one
export function PlayerName({ p, round }: { p: PlayerLine; round: number | null }) {
  return (
    <>
      <div className="font-semibold">
        {p.name}
        {p.injury && (
          <>
            {" "}
            <InjuryBadge injury={p.injury} games={p.expectedOut} />
          </>
        )}
      </div>
      <div className="text-sm text-muted-foreground">
        {p.team} · {p.pos} · {round != null ? `Rd\u00a0${round}` : "Swap"}
      </div>
      {p.injury && <div className="text-sm text-red">{injuryText(p.injury, p.expectedOut)}</div>}
    </>
  );
}

const versus = (n: NonNullable<PlayerLine["nextGame"]>) => `${n.home ? "vs" : "@"} ${n.opp}`;
// "Fri @ CAR", or "Tonight vs CAR"
const nextGameShort = (n: NonNullable<PlayerLine["nextGame"]>, today: string | null) =>
  `${n.date === today ? "Tonight" : fmtDate(n.date, { weekday: "short" })} ${versus(n)}`;
// "Oct 2 @ CAR, 4:00 PM PT"
const nextGameLong = (n: NonNullable<PlayerLine["nextGame"]>, today: string | null) =>
  `${n.date === today ? "Tonight" : fmtDate(n.date)} ${versus(n)}, ${startTimePT(n.start)}`;

// Tonight for one player: his start time, live points or final line; his injury badge if he's
// out; otherwise his next game
export function PlayerTonight({ p, live }: { p: PlayerLine; live: LiveData }) {
  const lp = live.players[p.id];
  const line = lp && lp.g + lp.a ? `${lp.g}G ${lp.a}A` : "";
  // Out on the injury report: his team may be playing tonight, he isn't
  if (p.injury && isOut(p.injury) && !line)
    return <InjuryBadge injury={p.injury} games={p.expectedOut} />;
  if (!live.anyGames || !lp || lp.status === "none") {
    if (!p.nextGame) return <span className="text-muted-foreground">–</span>;
    return (
      <span
        className={`whitespace-nowrap text-sm ${
          p.playsNext ? "rounded bg-gold/30 px-2 py-0.5 font-semibold" : "text-muted-foreground"
        }`}
      >
        {nextGameShort(p.nextGame, live.date)}
      </span>
    );
  }
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
  // The team locker adds each player's next and last game on wider screens; the standings keep it short
  full?: boolean;
}) {
  const rows = rosterRows(team, live);
  // With tonight's games counted once they're over. Points per game counts finished games too:
  // the points beside it are live, but a game still on isn't a game played yet.
  const finishedTonight = rows.reduce((s, r) => s + r.l.gp - r.p.gp, 0);
  const played = team.manGames.played + finishedTonight;
  const { missed } = team.manGames;
  const teamLeft = team.manGames.left - finishedTonight;
  const teamPPG = perGame(
    rows.reduce((s, r) => s + r.l.finalPts, 0),
    rows.reduce((s, r) => s + r.l.gp, 0),
  );
  return (
    <>
      {/* Man games: the team's totals (the standings show them as columns on wide screens) */}
      <p className="border-b px-2 py-2 text-sm text-muted-foreground sm:px-3">
        <span className="font-semibold uppercase tracking-wider">Man games</span>{" "}
        <b className="num text-base text-foreground">{played}</b> played ·{" "}
        <b className="num text-base text-foreground">{missed}</b> missed ·{" "}
        <b className="num text-base text-foreground">{teamLeft}</b> left ·{" "}
        <b className="num text-base text-foreground">{teamPPG}</b> PPG
      </p>
      <table className="w-full text-left">
        <thead className="text-sm uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-2 py-2 sm:px-3">Player</th>
            {/* Narrow screens show these under the player's name instead */}
            <th className="hidden px-2 py-2 text-right md:table-cell md:px-3">GP</th>
            <th
              className="hidden px-2 py-2 text-right md:table-cell md:px-3"
              title="Games his NHL team has played that he didn't dress for"
            >
              Missed
            </th>
            <th
              className="hidden px-2 py-2 text-right md:table-cell md:px-3"
              title="Games his NHL team has left this season"
            >
              Left
            </th>
            <th className="px-2 py-2 sm:px-3 text-right">G</th>
            <th className="px-2 py-2 sm:px-3 text-right">A</th>
            <th className="px-2 py-2 sm:px-3 text-right">P</th>
            <th
              className="px-2 py-2 text-right leading-tight sm:px-3"
              title="Points in the last game day's games"
            >
              Last night
            </th>
            <th className="hidden px-2 py-2 text-right md:table-cell md:px-3">PPG</th>
            <th
              className="hidden px-2 py-2 text-right md:table-cell md:px-3"
              title="Projected points for the season"
            >
              Proj.
            </th>
            <th className="px-2 py-2 sm:px-3">Tonight</th>
            {full && <th className="hidden px-2 py-2 sm:px-3 lg:table-cell">Next game</th>}
            {full && <th className="hidden px-2 py-2 sm:px-3 lg:table-cell">Last game</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ p, l, round, left }) => {
            const tonightPts = l.tonight ? l.tonight.g + l.tonight.a : 0;
            const lastNight = p.lastNight ? p.lastNight.g + p.lastNight.a : 0;
            return (
              <tr key={p.id} className="border-t">
                <td className="px-2 py-2 sm:px-3">
                  <PlayerName p={p} round={round} />
                  <div className="num whitespace-nowrap text-sm text-muted-foreground md:hidden">
                    <div>
                      {l.gp} GP · {perGame(l.finalPts, l.gp)} PPG
                    </div>
                    <div>
                      {p.missed} missed · {left} left
                    </div>
                    <div>Projected {p.projected}</div>
                  </div>
                </td>
                <td className="num hidden px-2 py-2 text-right text-lg md:table-cell md:px-3">
                  {l.gp}
                </td>
                <td className="num hidden px-2 py-2 text-right text-lg md:table-cell md:px-3">
                  {p.missed || <span className="text-muted-foreground">–</span>}
                </td>
                <td className="num hidden px-2 py-2 text-right text-lg md:table-cell md:px-3">
                  {left}
                </td>
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
                <td
                  className="num px-2 py-2 text-right text-lg sm:px-3"
                  title={
                    p.lastNight
                      ? `${p.lastNight.g}G ${p.lastNight.a}A ${p.lastNight.home ? "vs" : "@"} ${p.lastNight.opp}`
                      : "Didn't play"
                  }
                >
                  {lastNight || <span className="text-muted-foreground">–</span>}
                </td>
                <td className="num hidden px-2 py-2 text-right text-lg md:table-cell md:px-3">
                  {perGame(l.finalPts, l.gp)}
                </td>
                <td className="num hidden px-2 py-2 text-right text-lg md:table-cell md:px-3">
                  {p.projected}
                </td>
                <td className="px-2 py-2 sm:px-3">
                  <PlayerTonight p={p} live={live} />
                </td>
                {full && (
                  <td className="hidden whitespace-nowrap px-2 py-2 text-sm sm:px-3 lg:table-cell">
                    {p.nextGame ? nextGameLong(p.nextGame, live.date) : "—"}
                  </td>
                )}
                {full && (
                  <td className="hidden px-2 py-2 sm:px-3 text-sm lg:table-cell">
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
    </>
  );
}
