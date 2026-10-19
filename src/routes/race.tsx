import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Customized,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TeamLogo } from "@/components/team-logo";
import { lockerSearch, ord } from "@/lib/history";
import { placeName, placeRange, racePlaces, spreadLabels, togglePick } from "@/lib/race";
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

type View = "place" | "points" | "back";
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
      row[key(t.slot)] =
        view === "place"
          ? d.places[t.slot]!.order
          : view === "points"
            ? d.places[t.slot]!.pts
            : d.places[t.slot]!.back;
    return row;
  });
  const byDate = new Map(days.map((d) => [d.date, d]));
  // The points scale runs to a round number above the leader
  const top = Math.ceil(Math.max(1, ...teams.map((t) => last.places[t.slot]!.pts)) / 20) * 20;
  // The points-back scale, with the leader along the top, runs to a round number past the
  // furthest any team has been behind
  const maxBack = Math.max(1, ...days.flatMap((d) => Object.values(d.places).map((p) => p.back)));
  const backStep = maxBack <= 20 ? 5 : 10;
  const topBack = Math.ceil(maxBack / 5) * 5;
  const backTicks = [...Array(Math.floor(topBack / backStep) + 1).keys()].map((i) => i * backStep);
  const short = (name: string, max: number) =>
    name.length > max ? `${name.slice(0, max - 1)}…` : name;
  // What each line's end says: its place, total or points back, then the team
  const endValue = (slot: number) => {
    const p = last.places[slot]!;
    return view === "place" ? p.order : view === "points" ? p.pts : p.back;
  };
  const endLabel = (slot: number, name: string) => {
    const p = last.places[slot]!;
    const lead =
      view === "place"
        ? placeName(last, slot, ord)
        : view === "points"
          ? String(p.pts)
          : p.back
            ? `−${p.back}`
            : "0";
    return `${lead} ${short(name, narrow ? 10 : 18)}`;
  };
  // Every team's name at the end of its line, spread apart where the lines end close together,
  // with a short line back to the end when a name had to move. Drawn on the chart's own scales.
  const fontSize = narrow ? 11 : 12.5;
  type Scale = ((v: unknown) => number) & { bandwidth?: () => number };
  type ChartState = {
    xAxisMap?: Record<string, { scale: Scale }>;
    yAxisMap?: Record<string, { scale: Scale }>;
    offset?: { top: number; height: number };
  };
  const EndLabels = (chart: ChartState) => {
    const xScale = Object.values(chart.xAxisMap ?? {})[0]?.scale;
    const yScale = Object.values(chart.yAxisMap ?? {})[0]?.scale;
    const box = chart.offset;
    if (!xScale || !yScale || !box) return null;
    const x = xScale(last.date) + (xScale.bandwidth?.() ?? 0) / 2;
    const ends = ordered.map((t) => ({ id: t.slot, y: yScale(endValue(t.slot)) }));
    const laid = spreadLabels(ends, fontSize + 2.5, box.top + fontSize / 2, box.top + box.height);
    return (
      <g>
        {ordered.map((t, i) => {
          const y0 = ends[i]!.y;
          const y = laid.get(t.slot) ?? y0;
          const moved = Math.abs(y - y0) > 1.5;
          const colour = colourOf.get(t.slot);
          return (
            <g key={t.slot} style={{ cursor: "pointer" }} onClick={() => pick(t.slot)}>
              {moved && (
                <polyline
                  points={`${x + 2},${y0} ${x + 6},${y} ${x + 8},${y}`}
                  fill="none"
                  stroke="var(--color-muted-foreground)"
                  strokeOpacity={0.5}
                />
              )}
              <text
                x={x + 10}
                y={y + fontSize / 3}
                fontSize={fontSize}
                fontWeight={colour ? 700 : 500}
                fill={colour ? "var(--color-foreground)" : "var(--color-muted-foreground)"}
              >
                {endLabel(t.slot, t.name)}
              </text>
            </g>
          );
        })}
      </g>
    );
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
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <h1 className="text-5xl font-extrabold uppercase">The race</h1>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
          {(
            [
              ["place", "Place"],
              ["points", "Points"],
              ["back", "Points back"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`rounded-md border px-3 py-2 font-semibold sm:px-4 ${
                view === v ? "border-gold bg-gold text-accent-foreground" : "hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="h-[38rem] rounded-md border bg-card px-1 pb-2 pt-4 sm:h-[42rem] sm:px-3"
        role="img"
        aria-label={`Each team's ${view === "place" ? "place in the standings" : view === "points" ? "points" : "points behind the leader"} on every game day from ${fmtDate(dates[0]!)} to ${fmtDate(last.date)}. The list below has today's standings.`}
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
                ticks={[...Array(n).keys()].map((i) => i + 1)}
                interval={0}
                allowDecimals={false}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
            ) : view === "back" ? (
              <YAxis
                reversed
                domain={[0, topBack]}
                ticks={backTicks}
                interval={0}
                allowDecimals={false}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={32}
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
                          {placeName(day, t.slot, ord)} ·{" "}
                          {view === "back"
                            ? day.places[t.slot]!.back
                              ? `${day.places[t.slot]!.back} back`
                              : "leader"
                            : `${day.places[t.slot]!.pts} pts`}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            {drawOrder.map((t) => {
              const colour = colourOf.get(t.slot);
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
                />
              );
            })}
            <Customized component={EndLabels} />
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
