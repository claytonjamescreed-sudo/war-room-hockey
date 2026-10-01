import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronDown, Minus } from "lucide-react";
import { Fragment, useState } from "react";
import { LiveTonight } from "@/components/live-tonight";
import { NightBrief } from "@/components/night-brief";
import { TeamLogo } from "@/components/team-logo";
import { PlayerTonight, TeamRoster } from "@/components/team-roster";
import { lockerSearch } from "@/lib/history";
import { livePlayer, rosterRows, type LiveData, type LiveTeam } from "@/lib/live";
import { perGame } from "@/lib/man-games";
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
function TonightCell({ lt }: { lt: LiveTeam | undefined }) {
  if (!lt || lt.toPlay + lt.playing + lt.done === 0)
    return <span className="num text-xl text-muted-foreground">–</span>;
  if (lt.playing + lt.done === 0)
    return (
      <span className="whitespace-nowrap">
        <span className="num text-xl font-bold">{lt.toPlay}</span>{" "}
        <span className="text-sm text-muted-foreground">playing</span>
      </span>
    );
  const status =
    [lt.playing ? `${lt.playing} live` : "", lt.toPlay ? `${lt.toPlay} to play` : ""]
      .filter(Boolean)
      .join(" · ") || `${lt.done} played`;
  return (
    <>
      <div className="num text-xl">
        {lt.tonight ? (
          <span className="rounded bg-gold px-2 py-0.5 font-bold text-accent-foreground">
            +{lt.tonight}
          </span>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </div>
      <div className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">{status}</div>
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
        <div className="font-semibold">{p.name}</div>
        <div className="text-sm text-muted-foreground">
          {p.team} · {p.pos} · {round != null ? `Rd\u00a0${round}` : "Swap"}
        </div>
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
      <td className={cell}>{perGame(l.pts, l.gp)}</td>
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
      return {
        t,
        lt,
        pts: useLive && lt ? lt.total : t.pts,
        rank: useLive && lt ? lt.rank : t.rank,
        prev: useLive && lt && scoredTonight ? lt.startRank : t.prevRank,
        // Games its current players have played, and those of tonight's that have started (so
        // points per game keeps up with the live points)
        rosterGP: t.roster.reduce((s, p) => s + p.gp, 0),
        startedTonight: t.roster.reduce((s, p) => s + livePlayer(p, live).gp - p.gp, 0),
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
        <table className="w-full min-w-[700px] text-left">
          <thead className="bg-muted text-sm uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-3">#</th>
              <th className="px-3 py-3">Team</th>
              <th className="px-3 py-3 text-right">Pts</th>
              {live.anyGames && <th className="px-3 py-3 text-right">Tonight</th>}
              <th className="px-3 py-3 text-right">Last night</th>
              <th className="px-3 py-3 text-right">Last 7</th>
              <th className="px-3 py-3 text-right">Back</th>
              {/* Man games: wide screens only; narrower ones have them inside the opened team */}
              <th
                className="hidden px-3 py-3 text-right lg:table-cell"
                title="Man games played: games its players have played while on its roster"
              >
                GP
              </th>
              <th
                className="hidden px-3 py-3 text-right lg:table-cell"
                title="Points per game: the team's points for each game its current players have played"
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
              <th className="px-3 py-3 text-right">Proj.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ t, lt, pts, rank, prev, rosterGP, startedTonight }) => (
              <Fragment key={t.slot}>
                <tr className={`border-t ${open.has(t.slot) ? "bg-muted/50" : ""}`}>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="num w-7 text-2xl font-bold">{rank}</span>
                      <Move rank={rank} prev={prev} title={moveTitle} />
                    </div>
                  </td>
                  <td className="px-3 py-3">
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
                    {/* Narrower screens, where the Tonight column can be scrolled out of view */}
                    {live.anyGames && lt && (lt.toPlay > 0 || lt.playing > 0) && (
                      <div className="text-sm text-muted-foreground lg:hidden">
                        {[
                          lt.playing ? `${lt.playing} playing now` : "",
                          lt.toPlay
                            ? `${lt.toPlay} ${lt.playing ? "more tonight" : "playing tonight"}`
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    )}
                  </td>
                  <td className="num px-3 py-3 text-right text-3xl font-extrabold">{pts}</td>
                  {live.anyGames && (
                    <td className="px-3 py-3 text-right">
                      <TonightCell lt={lt} />
                    </td>
                  )}
                  <td className="num px-3 py-3 text-right text-xl">{t.lastNight || "–"}</td>
                  <td className="num px-3 py-3 text-right text-xl">{t.last7}</td>
                  <td className="num px-3 py-3 text-right text-xl text-muted-foreground">
                    {leader - pts || "–"}
                  </td>
                  <td className="num hidden px-3 py-3 text-right text-xl lg:table-cell">
                    {t.manGames.played + startedTonight}
                  </td>
                  <td className="num hidden px-3 py-3 text-right text-xl lg:table-cell">
                    {perGame(pts, rosterGP + startedTonight)}
                  </td>
                  <td className="num hidden px-3 py-3 text-right text-xl lg:table-cell">
                    {t.manGames.missed || "–"}
                  </td>
                  <td className="num hidden px-3 py-3 text-right text-xl lg:table-cell">
                    {t.manGames.left - startedTonight}
                  </td>
                  <td className="px-3 py-3 text-right">
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
      {data.lastNight.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-3xl font-bold uppercase">
            Scorers {fmtDate(data.lastDate, { weekday: "short", month: "short", day: "numeric" })}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.lastNight.map((p) => (
              <li key={p.id} className="flex justify-between rounded border bg-card px-4 py-3">
                <span>
                  <b>{p.name}</b> <span className="text-muted-foreground">({p.owner})</span>
                </span>
                <span className="num text-lg">
                  {p.lastNight!.g}G {p.lastNight!.a}A
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
