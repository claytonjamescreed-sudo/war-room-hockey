import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TeamLogo } from "@/components/team-logo";
import { lockerSearch, ord } from "@/lib/history";
import { placeName, placeRange, racePlaces, togglePick } from "@/lib/race";
import { fmtDate, seasonQuery } from "@/lib/season-query";

export const Route = createFileRoute("/race")({
  head: () => ({
    meta: [
      { title: "The Race — WG Hockey Pool" },
      {
        name: "description",
        content: "Every pool team's place in the standings over the season, game day by game day.",
      },
      { property: "og:title", content: "The Race — WG Hockey Pool" },
      {
        property: "og:description",
        content: "Every pool team's place in the standings over the season.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(seasonQuery),
  errorComponent: ({ error }) => (
    <p className="p-8 text-lg">
      The race didn't load: {error instanceof Error ? error.message : String(error)}
    </p>
  ),
  notFoundComponent: () => <p className="p-8">Not found</p>,
  component: Race,
});

type View = "place" | "points";
type Row = { date: string; [key: string]: number | string };

// The colours a picked-out team's line takes, in this order (blue, orange, aqua: the first three
// slots of the charts palette, checked for colour-blind readers against the site's light and dark
// cards). Fifteen colours can't be told apart, so every other team stays gray and the names at
// the ends of the lines say whose is whose.
const PICK_COLOURS = ["var(--race-0)", "var(--race-1)", "var(--race-2)"];
const MAX_PICKS = PICK_COLOURS.length;

const key = (slot: number) => `t${slot}`;

// Phones get shorter names at the ends of the lines
function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(max-width: 639px)");
    const on = () => setNarrow(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return narrow;
}

function Race() {
  const { data } = useSuspenseQuery(seasonQuery);
  const teams = data.teams; // standings order
  const { dates, totals } = data.history;
  const days = useMemo(() => racePlaces(teams, dates, totals), [teams, dates, totals]);
  const last = days[days.length - 1];
  // Today's order, ties as the chart draws them
  const ordered = useMemo(
    () =>
      last
        ? [...teams].sort((a, b) => last.places[a.slot]!.order - last.places[b.slot]!.order)
        : teams,
    [teams, last],
  );
  const [view, setView] = useState<View>("place");
  // The top three to start with, so the chart has some colour before anyone taps
  const [picked, setPicked] = useState(() =>
    ordered
      .slice(0, MAX_PICKS)
      .reduce((p, t) => togglePick(p, t.slot, MAX_PICKS), [] as ReturnType<typeof togglePick>),
  );
  // Until someone taps a team, the picks are the top three, and the first tap starts afresh
  const [ownPicks, setOwnPicks] = useState(false);
  const narrow = useNarrow();

  if (!last)
    return (
      <main className="mx-auto max-w-6xl px-3 py-6 sm:px-4">
        <h1 className="mb-3 text-5xl font-extrabold uppercase">The race</h1>
        <p className="text-lg text-muted-foreground">The race starts after the first game day.</p>
      </main>
    );

  const colourOf = new Map(picked.map((p) => [p.slot, PICK_COLOURS[p.colour]!]));
  const pick = (slot: number) => {
    setPicked((p) => togglePick(ownPicks ? p : [], slot, MAX_PICKS));
    setOwnPicks(true);
  };
  const n = teams.length;
  const rows: Row[] = days.map((d) => {
    const row: Row = { date: d.date };
    for (const t of teams)
      row[key(t.slot)] = view === "place" ? d.places[t.slot]!.order : d.places[t.slot]!.pts;
    return row;
  });
  const byDate = new Map(days.map((d) => [d.date, d]));
  // The points scale runs to a round number above the leader
  const top = Math.ceil(Math.max(1, ...teams.map((t) => last.places[t.slot]!.pts)) / 20) * 20;
  // On the points view, picked teams' names at the ends of their lines are nudged apart when
  // their totals are close (about a line of text between them, on a plot about this tall)
  const plotHeight = narrow ? 350 : 410;
  const nudge = new Map<number, number>();
  if (view === "points") {
    const ends = picked
      .map((p) => ({ slot: p.slot, y: plotHeight * (1 - last.places[p.slot]!.pts / top) }))
      .sort((a, b) => a.y - b.y);
    let prev = -Infinity;
    for (const e of ends) {
      const y = Math.max(e.y, prev + 15);
      nudge.set(e.slot, y - e.y);
      prev = y;
    }
  }
  const short = (name: string) => {
    const max = narrow ? 11 : 18;
    return name.length > max ? `${name.slice(0, max - 1)}…` : name;
  };
  // Picked teams last, so their lines sit on top
  const drawOrder = [...ordered].sort(
    (a, b) => Number(colourOf.has(a.slot)) - Number(colourOf.has(b.slot)),
  );

  return (
    <main className="mx-auto max-w-6xl px-3 py-6 sm:px-4 [--race-0:#2a78d6] [--race-1:#eb6834] [--race-2:#1baf7a] dark:[--race-0:#3987e5] dark:[--race-1:#d95926] dark:[--race-2:#199e70]">
      <p className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        {fmtDate(dates[0]!)} to {fmtDate(last.date)} · {days.length} game day
        {days.length === 1 ? "" : "s"}
      </p>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-5xl font-extrabold uppercase">The race</h1>
        <div className="flex gap-2" role="group" aria-label="Show">
          {(
            [
              ["place", "Place"],
              ["points", "Points"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`rounded-md border px-4 py-2 font-semibold ${
                view === v ? "border-gold bg-gold text-accent-foreground" : "hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="h-[26rem] rounded-md border bg-card px-1 pb-2 pt-4 sm:h-[30rem] sm:px-3"
        role="img"
        aria-label={`Each team's ${view === "place" ? "place in the standings" : "points"} on every game day from ${fmtDate(dates[0]!)} to ${fmtDate(last.date)}. The list below has today's standings.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 6, right: narrow ? 88 : 140, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => fmtDate(d)}
              interval="preserveStartEnd"
              minTickGap={28}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-border)" }}
            />
            {view === "place" ? (
              <YAxis
                reversed
                domain={[1, n]}
                ticks={[...Array(n).keys()].map((i) => i + 1).filter((p) => !narrow || p % 2 === 1)}
                interval={0}
                allowDecimals={false}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
            ) : (
              <YAxis
                domain={[0, top]}
                tickCount={5}
                allowDecimals={false}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={32}
              />
            )}
            <Tooltip
              cursor={{ stroke: "var(--color-muted-foreground)", strokeWidth: 1 }}
              content={({ active, label }) => {
                const day = active ? byDate.get(String(label)) : undefined;
                if (!day) return null;
                const shown = picked.length
                  ? picked.map((p) => p.slot)
                  : ordered.slice(0, 3).map((t) => t.slot);
                const lines = shown
                  .map((s) => teams.find((t) => t.slot === s)!)
                  .sort((a, b) => day.places[a.slot]!.order - day.places[b.slot]!.order);
                return (
                  <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
                    <div className="mb-1 font-bold">{fmtDate(day.date)}</div>
                    {lines.map((t) => (
                      <div key={t.slot} className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{
                            background: colourOf.get(t.slot) ?? "var(--color-muted-foreground)",
                          }}
                          aria-hidden
                        />
                        <span className="font-semibold">{t.name}</span>
                        <span className="num ml-auto pl-3 text-muted-foreground">
                          {placeName(day, t.slot, ord)} · {day.places[t.slot]!.pts} pts
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            {drawOrder.map((t) => {
              const colour = colourOf.get(t.slot);
              // On the points view only the picked-out teams are named: totals bunch up
              const named = view === "place" || colour;
              return (
                <Line
                  key={t.slot}
                  dataKey={key(t.slot)}
                  name={t.name}
                  stroke={colour ?? "var(--color-muted-foreground)"}
                  strokeOpacity={colour ? 1 : picked.length ? 0.3 : 0.6}
                  strokeWidth={colour ? 3 : 1.5}
                  dot={false}
                  activeDot={colour ? { r: 4, stroke: "var(--color-card)", strokeWidth: 2 } : false}
                  isAnimationActive={false}
                  onClick={() => pick(t.slot)}
                  style={{ cursor: "pointer" }}
                >
                  {named && (
                    <LabelList
                      dataKey={key(t.slot)}
                      content={({ x, y, index }) =>
                        index === rows.length - 1 ? (
                          <text
                            x={Number(x) + 8}
                            y={Number(y) + 4 + (nudge.get(t.slot) ?? 0)}
                            fontSize={narrow ? 11 : 12.5}
                            fontWeight={colour ? 700 : 500}
                            fill={
                              colour ? "var(--color-foreground)" : "var(--color-muted-foreground)"
                            }
                            style={{ cursor: "pointer" }}
                            onClick={() => pick(t.slot)}
                          >
                            {view === "place" ? `${placeName(last, t.slot, ord)} ` : ""}
                            {short(t.name)}
                          </text>
                        ) : null
                      }
                    />
                  )}
                </Line>
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-4 text-muted-foreground">
        {ownPicks
          ? `Tap teams to pick them out, up to ${MAX_PICKS} at a time. Tap again to clear.`
          : `Showing the top ${MAX_PICKS}. Tap teams to pick your own, up to ${MAX_PICKS} at a time.`}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {ordered.map((t) => {
          const colour = colourOf.get(t.slot);
          return (
            <button
              key={t.slot}
              type="button"
              onClick={() => pick(t.slot)}
              aria-pressed={!!colour}
              className={`flex items-center gap-2 rounded-md border px-3 py-1.5 font-semibold ${
                colour ? "border-foreground bg-muted" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: colour ?? "var(--color-border)" }}
                aria-hidden
              />
              {t.name}
            </button>
          );
        })}
      </div>

      {/* Today's standings, ties as the chart draws them, with each team's best and worst place */}
      <ol className="mt-6 divide-y rounded-md border bg-card">
        {ordered.map((t) => {
          const colour = colourOf.get(t.slot);
          const range = placeRange(days, t.slot);
          return (
            <li key={t.slot} className="flex items-center gap-3 px-4 py-3">
              <span className="num w-10 shrink-0 text-xl font-bold text-muted-foreground">
                {placeName(last, t.slot, ord)}
              </span>
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: colour ?? "var(--color-border)" }}
                aria-hidden
              />
              <TeamLogo name={t.name} size={24} />
              <div className="min-w-0 flex-1">
                <Link
                  to="/history"
                  search={lockerSearch(t.name)}
                  className="block truncate text-lg font-semibold hover:underline"
                >
                  {t.name}
                </Link>
                {range && (
                  <span className="text-sm text-muted-foreground">
                    Best {ord(range.best)} · Worst {ord(range.worst)}
                  </span>
                )}
              </div>
              <span className="num text-2xl font-bold">{last.places[t.slot]!.pts}</span>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
