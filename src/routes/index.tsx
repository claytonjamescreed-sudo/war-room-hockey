import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronDown, Minus } from "lucide-react";
import { Fragment, useState } from "react";
import { LiveTonight } from "@/components/live-tonight";
import { NightBrief } from "@/components/night-brief";
import { TeamLogo } from "@/components/team-logo";
import { TeamRoster } from "@/components/team-roster";
import { lockerSearch } from "@/lib/history";
import { fmtDate, liveQuery, seasonQuery } from "@/lib/season-query";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Standings — War Room Hockey Pool" },
      {
        name: "description",
        content:
          "Season standings for our 15-team NHL hockey pool: points, live points tonight, last 7 days and projected finish.",
      },
      { property: "og:title", content: "Standings — War Room Hockey Pool" },
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
    <p className="p-8 text-lg">Standings didn't load: {error.message}</p>
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
  const cols = live.anyGames ? 8 : 7;
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
              <th className="px-3 py-3 text-right">Proj.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ t, lt, pts, rank, prev }) => (
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
                    {live.anyGames && lt && (lt.toPlay > 0 || lt.playing > 0) && (
                      <div className="text-sm text-muted-foreground">
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
                    <td className="num px-3 py-3 text-right text-xl">
                      {lt?.tonight ? (
                        <span className="rounded bg-gold px-2 py-0.5 font-bold text-accent-foreground">
                          +{lt.tonight}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </td>
                  )}
                  <td className="num px-3 py-3 text-right text-xl">{t.lastNight || "–"}</td>
                  <td className="num px-3 py-3 text-right text-xl">{t.last7}</td>
                  <td className="num px-3 py-3 text-right text-xl text-muted-foreground">
                    {leader - pts || "–"}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="num text-xl font-bold">{t.projected}</div>
                    <div className="text-xs text-muted-foreground">draft {t.preseason}</div>
                  </td>
                </tr>
                {open.has(t.slot) && (
                  <tr id={`roster-${t.slot}`} className="bg-muted/50">
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
