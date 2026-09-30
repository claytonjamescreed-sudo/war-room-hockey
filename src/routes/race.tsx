import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { addDays } from "@/lib/season";
import { fmtDate, seasonQuery } from "@/lib/season-query";

export const Route = createFileRoute("/race")({
  head: () => ({
    meta: [
      { title: "The Race — War Room Hockey Pool" },
      {
        name: "description",
        content: "Every pool team's points by date over the season, one small chart per team.",
      },
      { property: "og:title", content: "The Race — War Room Hockey Pool" },
      { property: "og:description", content: "Every pool team's points by date over the season." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(seasonQuery),
  errorComponent: ({ error }) => (
    <p className="p-8 text-lg">The race didn't load: {error.message}</p>
  ),
  notFoundComponent: () => <p className="p-8">Not found</p>,
  component: Race,
});

type Point = { date: string; [slot: string]: number | string };

// One small chart per team, in standings order: the team's line in red over the rest of the
// pool in faint gray, all on the same scale. Fifteen colours can't be told apart, and teams on
// the same points would hide each other on one chart.
function Race() {
  const { data } = useSuspenseQuery(seasonQuery);
  const teams = data.teams; // standings order
  const { dates, totals } = data.history;

  if (dates.length === 0)
    return (
      <main className="mx-auto max-w-6xl px-3 py-6 sm:px-4">
        <h1 className="mb-3 text-5xl font-extrabold uppercase">The race</h1>
        <p className="text-lg text-muted-foreground">The race starts after the first game day.</p>
      </main>
    );

  // A zero point the day before the first game, so every line starts at 0
  const start = addDays(dates[0]!, -1);
  const points: Point[] = [start, ...dates].map((date, i) => {
    const row: Point = { date };
    for (const t of teams) row[String(t.slot)] = i === 0 ? 0 : totals[t.slot]![i - 1]!;
    return row;
  });
  const top = Math.max(1, ...teams.map((t) => t.pts));
  const tick = (d: string) => (d === start ? "Start" : fmtDate(d));
  const lastDate = dates[dates.length - 1]!;

  return (
    <main className="mx-auto max-w-6xl px-3 py-6 sm:px-4">
      <h1 className="mb-2 text-5xl font-extrabold uppercase">The race</h1>
      <p className="mb-5 text-muted-foreground">
        Every team's points by date, in standings order. Each chart shows one team in red against
        the rest of the pool in gray, all on the same scale. Through {tick(lastDate)}; tap a team
        name for its players.
      </p>
      <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {teams.map((t) => (
          <li key={t.slot} className="min-w-0 rounded-md border bg-card px-2 pb-1 pt-2">
            <div className="flex items-baseline justify-between gap-2 px-1">
              <Link
                to="/teams/$slot"
                params={{ slot: String(t.slot) }}
                className="min-w-0 truncate text-sm font-semibold hover:underline sm:text-base"
              >
                <span className="num text-muted-foreground">{t.rank}</span> {t.name}
              </Link>
              <span className="num shrink-0 text-lg font-bold">{t.pts}</span>
            </div>
            <div
              className="h-28 w-full sm:h-32"
              role="img"
              aria-label={`${t.name}: ${t.pts} points through ${tick(lastDate)}, rank ${t.rank} of ${teams.length}.`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    ticks={[start, lastDate]}
                    interval={0}
                    // First label starts at the left edge, the last ends at the right one
                    tick={({
                      x,
                      y,
                      payload,
                    }: {
                      x: number;
                      y: number;
                      payload: { value: string };
                    }) => (
                      <text
                        x={x}
                        y={y + 12}
                        fontSize={11}
                        fill="var(--color-muted-foreground)"
                        textAnchor={payload.value === start ? "start" : "end"}
                      >
                        {tick(payload.value)}
                      </text>
                    )}
                    tickLine={false}
                    axisLine={{ stroke: "var(--color-border)" }}
                  />
                  <YAxis
                    domain={[0, top]}
                    allowDecimals={false}
                    tickCount={3}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--color-muted-foreground)", strokeWidth: 1 }}
                    content={({ active, label, payload }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0]!.payload as Point;
                      return (
                        <div className="rounded-md border bg-popover px-2.5 py-1.5 text-sm shadow-md">
                          <div className="font-bold">{tick(String(label))}</div>
                          <div className="num">{Number(row[String(t.slot)] ?? 0)} pts</div>
                        </div>
                      );
                    }}
                  />
                  {teams
                    .filter((o) => o.slot !== t.slot)
                    .map((o) => (
                      <Line
                        key={o.slot}
                        dataKey={String(o.slot)}
                        stroke="var(--color-muted-foreground)"
                        strokeOpacity={0.25}
                        strokeWidth={1}
                        dot={false}
                        activeDot={false}
                        isAnimationActive={false}
                      />
                    ))}
                  <Line
                    dataKey={String(t.slot)}
                    stroke="var(--color-red)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4, stroke: "var(--color-card)", strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
