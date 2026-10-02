import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronDown, Minus } from "lucide-react";
import { Fragment, useState } from "react";
import { LiveTonight } from "@/components/live-tonight";
import { NightBrief } from "@/components/night-brief";
import { TeamLogo } from "@/components/team-logo";
import { ShowAllButton } from "@/components/show-all";
import { useShowAll } from "@/hooks/use-show-all";
import { PlayerName, PlayerTonight, TeamRoster } from "@/components/team-roster";
import { lockerSearch } from "@/lib/history";
import { livePlayer, rosterRows, tonightCounts, type LiveData } from "@/lib/live";
import { perGame } from "@/lib/man-games";
import type { SeasonData } from "@/lib/season";
import { fmtDate, liveQuery, seasonQuery } from "@/lib/season-query";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Standings — WG Hockey Pool" },
      {
        name: "description",
        content:
          "Season standings for our 15-team NHL hockey pool: points, live points tonight, last 7 days and projected finish.",
      },
      { property: "og:title", content: "Standings — WG Hockey Pool" },
      { property: "og:description", content: "Season standings for our 15-team NHL hockey pool." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(seasonQuery),
      context.queryClient.ensureQueryData(liveQuery),
    ]),
  errorComponent: ({ error }) => (
    <p className="p-8 text-lg">
      Standings didn't load: {error instanceof Error ? error.message : String(error)}
    </p>
  ),
  notFoundComponent: () => <p className="p-8">Not found</p>,
  component: Standings,
});

function Move({ rank, prev, title }: { rank: number; prev: number | null; title: string }) {
  if (prev == null || prev === rank)
    return <Minus className="h-4 w-4 text-muted-foreground" aria-label={`No change ${title}`} />;
  return prev > rank ? (
    <span
      className="flex items-center text-sm font-bold text-up"
      title={`Up ${prev - rank} ${title}`}
    >
      <ArrowUp className="h-4 w-4" aria-hidden />
      {prev - rank}
    </span>
  ) : (
    <span
      className="flex items-center text-sm font-bold text-red"
      title={`Down ${rank - prev} ${title}`}
    >
      <ArrowDown className="h-4 w-4" aria-hidden />
      {rank - prev}
    </span>
  );
}

// Tonight for one team: how many of its players are in action, then its points as they come.
// Before a game starts "5 playing"; during, "+3" over "2 live · 3 to play"; after, "5 played".
// Players on the injury report as out aren't counted as playing, and every one of the team's is
// counted as out: "1 playing" over "3 out".
type TonightCounts = ReturnType<typeof tonightCounts>;
function TonightCell({ c, points }: { c: TonightCounts; points: number }) {
  const out = c.out ? `${c.out} out` : "";
  if (c.toPlay + c.playing + c.done === 0)
    return out ? (
      <span className="whitespace-nowrap text-sm text-muted-foreground">{out}</span>
    ) : (
      <span className="num text-xl text-muted-foreground">–</span>
    );
  if (c.playing + c.done === 0)
    return (
      <>
        <span className="whitespace-nowrap">
          <span className="num text-xl font-bold">{c.toPlay}</span>{" "}
          <span className="text-sm text-muted-foreground">playing</span>
        </span>
        {out && <div className="whitespace-nowrap text-xs text-red">{out}</div>}
      </>
    );
  const status =
    [c.playing ? `${c.playing} live` : "", c.toPlay ? `${c.toPlay} to play` : ""]
      .filter(Boolean)
      .join(" · ") || `${c.done} played`;
  return (
    <>
      <div className="num text-xl">
        {points ? (
          <span className="rounded bg-gold px-2 py-0.5 font-bold text-accent-foreground">
            +{points}
          </span>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </div>
      <div className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">
        {status}
        {out && <span className="text-red"> · {out}</span>}
      </div>
    </>
  );
}

// One player of an opened team, on wide screens: his numbers under the same headings as the
// teams' (his goals and assists under his points, his draft-day projection under his projection)
function PlayerRow({
  p,
  l,
  round,
  left,
  live,
  showTonight,
}: ReturnType<typeof rosterRows>[number] & { live: LiveData; showTonight: boolean }) {
  const cell = "num px-3 py-2 text-right text-lg";
  const lastNight = p.lastNight ? p.lastNight.g + p.lastNight.a : 0;
  return (
    <tr className="hidden border-t border-border/60 bg-muted/50 lg:table-row">
      <td />
      {/* Lined up under the team's name, past its badge */}
      <td className="py-2 pl-[3.25rem] pr-3">
        <PlayerName p={p} round={round} />
      </td>
      <td className="px-3 py-2 text-right">
        <div className="num text-xl font-bold">{l.pts}</div>
        <div className="num text-xs text-muted-foreground">
          {l.g}G {l.a}A
        </div>
      </td>
      {showTonight && (
        <td className="px-3 py-2 text-right">
          <PlayerTonight p={p} live={live} />
        </td>
      )}
      <td className={cell}>{lastNight || "–"}</td>
      <td className={cell}>{p.last7}</td>
      {/* Back is a team's gap to the leader */}
      <td />
      <td className={cell}>{l.gp}</td>
      <td className={cell}>{perGame(l.finalPts, l.gp)}</td>
      <td className={cell}>{p.missed || "–"}</td>
      <td className={cell}>{left}</td>
      <td className="px-3 py-2 text-right">
        <div className="num text-lg font-bold">{p.projected}</div>
        <div className="text-xs text-muted-foreground">
          draft {p.preseason != null ? Math.round(p.preseason) : "–"}
        </div>
      </td>
    </tr>
  );
}

function Standings() {
  const { data } = useSuspenseQuery(seasonQuery);
  const { data: live } = useSuspenseQuery(liveQuery);
  // Live totals include tonight and any game the morning sync hasn't stored yet
  const liveBySlot = new Map(live.teams.map((t) => [t.slot, t]));
  const useLive = live.teams.length > 0;
  const scoredTonight = live.teams.some((t) => t.tonight > 0);
  const rows = data.teams
    .map((t) => {
      const lt = liveBySlot.get(t.slot);
      const now = t.roster.map((p) => livePlayer(p, live));
      return {
        t,
        lt,
        pts: useLive && lt ? lt.total : t.pts,
        rank: useLive && lt ? lt.rank : t.rank,
        prev: useLive && lt && scoredTonight ? lt.startRank : t.prevRank,
        // Games its current players have played, tonight's once they're over
        rosterGP: now.reduce((s, l) => s + l.gp, 0),
        finishedTonight: now.reduce((s, l, i) => s + l.gp - t.roster[i]!.gp, 0),
        // Tonight's points in games still on: in the live total, not yet in points per game
        inPlay: now.reduce((s, l) => s + l.pts - l.finalPts, 0),
        // Who's in action tonight, without anyone on the injury report as out
        c: tonightCounts(t, live),
      };
    })
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        (b.lt?.tonight ?? 0) - (a.lt?.tonight ?? 0) ||
        a.t.name.localeCompare(b.t.name),
    );
  const leader = Math.max(0, ...rows.map((r) => r.pts));
  const moveTitle = scoredTonight ? "tonight" : "since the day before";
  // Teams opened to show their players
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const toggle = (slot: number) =>
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  // Four of them (the man games and PPG) only show on wide screens
  const cols = live.anyGames ? 12 : 11;
  return (
    <main className="mx-auto max-w-6xl px-3 py-6 sm:px-4">
      <LiveTonight live={live} />
      <NightBrief data={data} />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-5xl font-extrabold uppercase">Standings</h1>
        <p className="text-muted-foreground">
          {live.anyGames && scoredTonight
            ? "Including tonight's games so far"
            : `Through ${fmtDate(data.lastDate, { weekday: "short", month: "short", day: "numeric" })} · ${data.gameDays} game day${data.gameDays === 1 ? "" : "s"}`}
        </p>
      </div>
      <p className="mb-2 text-muted-foreground">Tap a team to see its players.</p>
      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full text-left md:min-w-[700px]">
          <thead className="bg-muted text-sm uppercase tracking-wider text-muted-foreground">
            <tr>
              {/* Phones: rank, team and points, with the other numbers under the team's name, so
                  nothing is off to the right. Tablets and up: every column. */}
              <th className="px-2 py-3 md:px-3">#</th>
              <th className="px-2 py-3 md:px-3">Team</th>
              <th className="px-2 py-3 text-right md:px-3">Pts</th>
              {live.anyGames && (
                <th className="hidden px-3 py-3 text-right md:table-cell">Tonight</th>
              )}
              <th className="hidden px-3 py-3 text-right md:table-cell">Last night</th>
              <th className="hidden px-3 py-3 text-right md:table-cell">Last 7</th>
              <th className="hidden px-3 py-3 text-right md:table-cell">Back</th>
              {/* Man games: wide screens only; narrower ones have them inside the opened team */}
              <th
                className="hidden px-3 py-3 text-right lg:table-cell"
                title="Man games played: finished games its players have played while on its roster"
              >
                GP
              </th>
              <th
                className="hidden px-3 py-3 text-right lg:table-cell"
                title="Points per game: the team's points for each game its current players have played. A game still on counts once it's over."
              >
                PPG
              </th>
              <th
                className="hidden px-3 py-3 text-right lg:table-cell"
                title="Man games missed: games their NHL teams played that they didn't dress for"
              >
                Missed
              </th>
              <th
                className="hidden px-3 py-3 text-right lg:table-cell"
                title="Games left: NHL games its current players still have to play"
              >
                Left
              </th>
              <th className="hidden px-3 py-3 text-right md:table-cell">Proj.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ t, lt, pts, rank, prev, rosterGP, finishedTonight, inPlay, c }) => (
              <Fragment key={t.slot}>
                <tr className={`border-t ${open.has(t.slot) ? "bg-muted/50" : ""}`}>
                  <td className="px-2 py-3 align-top md:px-3 md:align-middle">
                    <div className="flex items-center gap-1.5 md:gap-2">
                      <span className="num w-6 text-2xl font-bold md:w-7">{rank}</span>
                      <Move rank={rank} prev={prev} title={moveTitle} />
                    </div>
                  </td>
                  <td className="px-2 py-3 md:px-3">
                    <button
                      onClick={() => toggle(t.slot)}
                      aria-expanded={open.has(t.slot)}
                      aria-controls={`roster-${t.slot}`}
                      className="flex items-center gap-2 text-left text-lg font-semibold hover:underline"
                    >
                      <TeamLogo name={t.name} size={32} />
                      {t.name}
                      <ChevronDown
                        className={`h-5 w-5 shrink-0 transition-transform ${open.has(t.slot) ? "rotate-180" : ""}`}
                        aria-hidden
                      />
                    </button>
                    {/* Narrower screens, where the Tonight column is hidden or its detail is */}
                    {live.anyGames && (c.toPlay > 0 || c.playing > 0 || c.out > 0) && (
                      <div className="text-sm text-muted-foreground lg:hidden">
                        {[
                          c.playing ? `${c.playing} playing now` : "",
                          c.toPlay
                            ? `${c.toPlay} ${c.playing ? "more tonight" : "playing tonight"}`
                            : "",
                          c.out ? `${c.out} out` : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    )}
                    {/* Phones: the columns that don't fit, as a line under the name */}
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted-foreground md:hidden">
                      <span>
                        Last night <b className="num text-foreground">{t.lastNight || "–"}</b>
                      </span>
                      <span>
                        Last 7 <b className="num text-foreground">{t.last7}</b>
                      </span>
                      <span>
                        Proj. <b className="num text-foreground">{t.projected}</b>
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-right align-top md:px-3 md:align-middle">
                    <div className="num text-3xl font-extrabold">{pts}</div>
                    {/* Phones: tonight's points and the gap to the leader here, since those
                        columns are hidden */}
                    {!!lt?.tonight && (
                      <span className="num rounded bg-gold px-1.5 py-0.5 text-sm font-bold text-accent-foreground md:hidden">
                        +{lt.tonight}
                      </span>
                    )}
                    {leader - pts > 0 && (
                      <div className="whitespace-nowrap text-xs text-muted-foreground md:hidden">
                        <span className="num">{leader - pts}</span> back
                      </div>
                    )}
                  </td>
                  {live.anyGames && (
                    <td className="hidden px-3 py-3 text-right md:table-cell">
                      <TonightCell c={c} points={lt?.tonight ?? 0} />
                    </td>
                  )}
                  <td className="num hidden px-3 py-3 text-right text-xl md:table-cell">
                    {t.lastNight || "–"}
                  </td>
                  <td className="num hidden px-3 py-3 text-right text-xl md:table-cell">
                    {t.last7}
                  </td>
                  <td className="num hidden px-3 py-3 text-right text-xl text-muted-foreground md:table-cell">
                    {leader - pts || "–"}
                  </td>
                  <td className="num hidden px-3 py-3 text-right text-xl lg:table-cell">
                    {t.manGames.played + finishedTonight}
                  </td>
                  <td className="num hidden px-3 py-3 text-right text-xl lg:table-cell">
                    {perGame(pts - inPlay, rosterGP)}
                  </td>
                  <td className="num hidden px-3 py-3 text-right text-xl lg:table-cell">
                    {t.manGames.missed || "–"}
                  </td>
                  <td className="num hidden px-3 py-3 text-right text-xl lg:table-cell">
                    {t.manGames.left - finishedTonight}
                  </td>
                  <td className="hidden px-3 py-3 text-right md:table-cell">
                    <div className="num text-xl font-bold">{t.projected}</div>
                    <div className="text-xs text-muted-foreground">draft {t.preseason}</div>
                  </td>
                </tr>
                {/* Wide screens: each player under the same columns as the teams */}
                {open.has(t.slot) &&
                  rosterRows(t, live).map((r) => (
                    <PlayerRow key={r.p.id} {...r} live={live} showTonight={live.anyGames} />
                  ))}
                {open.has(t.slot) && (
                  <tr className="hidden bg-muted/50 lg:table-row">
                    <td colSpan={cols} className="px-3 pb-3 pt-1 text-right">
                      <Link
                        to="/history"
                        search={lockerSearch(t.name)}
                        className="font-semibold underline"
                      >
                        Team locker →
                      </Link>
                    </td>
                  </tr>
                )}
                {/* Narrower screens, where the table doesn't show every column: the team's own
                    compact table */}
                {open.has(t.slot) && (
                  <tr id={`roster-${t.slot}`} className="bg-muted/50 lg:hidden">
                    <td colSpan={cols} className="px-2 pb-4 pt-0">
                      {/* Pinned to the visible width, so on a phone it doesn't scroll with the table */}
                      <div className="sticky left-2 max-w-[calc(100vw-2.5rem)] overflow-x-auto rounded-md border bg-card sm:max-w-none">
                        <TeamRoster team={t} live={live} />
                        <div className="border-t px-3 py-2 text-right">
                          <Link
                            to="/history"
                            search={lockerSearch(t.name)}
                            className="font-semibold underline"
                          >
                            Team locker →
                          </Link>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 hidden text-sm text-muted-foreground lg:block">
        <b>GP</b> games a team's players have played while on its roster · <b>PPG</b> points per
        game played · <b>Missed</b> games their NHL teams played without them · <b>Left</b> NHL
        games its current players still have to play
      </p>
      {data.lastNight.length > 0 && <Scorers players={data.lastNight} date={data.lastDate} />}
    </main>
  );
}

// How many of the last game day's scorers show before "Show all": the top 5, and a 6th on wider
// screens, where they sit two to a row
const TOP_SCORERS = 5;

// The last game day's scorers, most points first (as computeSeason gives them)
function Scorers({ players, date }: { players: SeasonData["lastNight"]; date: string | null }) {
  const { all, toggle, box } = useShowAll<HTMLElement>();
  const shown = all ? players : players.slice(0, TOP_SCORERS + 1);
  return (
    <section ref={box} className="mt-8 scroll-mt-3">
      <h2 className="mb-3 text-3xl font-bold uppercase">
        Scorers {fmtDate(date, { weekday: "short", month: "short", day: "numeric" })}
        <span className="num text-muted-foreground"> · {players.length}</span>
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {shown.map((p, i) => (
          <li
            key={p.id}
            className={`justify-between rounded border bg-card px-4 py-3 ${
              !all && i === TOP_SCORERS ? "hidden sm:flex" : "flex"
            }`}
          >
            <span>
              <b>{p.name}</b> <span className="text-muted-foreground">({p.owner})</span>
            </span>
            <span className="num text-lg">
              {p.lastNight!.g}G {p.lastNight!.a}A
            </span>
          </li>
        ))}
      </ul>
      {players.length > TOP_SCORERS + 1 && (
        <ShowAllButton
          all={all}
          total={players.length}
          few={`the top ${TOP_SCORERS}`}
          onToggle={toggle}
        />
      )}
    </section>
  );
}
