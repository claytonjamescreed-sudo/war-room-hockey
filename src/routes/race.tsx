import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  validateSearch: (s: Record<string, unknown>): { team?: number } => {
    const n = Number(s["team"]);
    return Number.isInteger(n) && n > 0 ? { team: n } : {};
  },
  head: () => ({
    meta: [
      { title: "The Race — War Room Hockey Pool" },
      {
        name: "description",
        content: "Every pool team's points by date over the season, with one team highlighted.",
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

function Race() {
  const { data } = useSuspenseQuery(seasonQuery);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/race" });
  const teams = data.teams; // standings order
  const hi = teams.some((t) => t.slot === search.team) ? search.team! : teams[0]!.slot;
  const hiTeam = teams.find((t) => t.slot === hi)!;
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
  const last = points[points.length - 1]!;
  const tick = (d: string) => (d === start ? "Start" : fmtDate(d));

  return (
    <main className="mx-auto max-w-6xl px-3 py-6 sm:px-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-5xl font-extrabold uppercase">The race</h1>
        <label className="flex items-center gap-2 text-lg font-semibold">
          Highlight
          <select
            value={hi}
            onChange={(e) => navigate({ search: { team: Number(e.target.value) }, replace: true })}
            className="rounded border bg-card px-3 py-2 text-lg"
          >
            {teams.map((t) => (
              <option key={t.slot} value={t.slot}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mb-3 text-muted-foreground">
        Points by date. Hover or tap the chart for every team's total on that date; the standings
        have the numbers.
      </p>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-sm font-semibold">
        <span className="flex items-center gap-2">
          <span className="inline-block h-1 w-6 rounded bg-red" aria-hidden />
          {hiTeam.name} · {String(last[String(hi)])}
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <span className="inline-block h-0.5 w-6 rounded bg-muted-foreground/40" aria-hidden />
          the other {teams.length - 1} teams
        </span>
      </div>
      <div
        className="h-[420px] w-full rounded-md border bg-card p-2 sm:h-[520px]"
        role="img"
        aria-label={`Points by date for every team, with ${hiTeam.name} highlighted.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 16, right: 24, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={tick}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 13 }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-border)" }}
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 13 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ stroke: "var(--color-muted-foreground)", strokeWidth: 1 }}
              content={({ active, label, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]!.payload as Point;
                const list = teams
                  .map((t) => ({ t, v: Number(row[String(t.slot)] ?? 0) }))
                  .sort((a, b) => b.v - a.v);
                return (
                  <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
                    <div className="mb-1 font-bold">{tick(String(label))}</div>
                    {list.map(({ t, v }) => (
                      <div
                        key={t.slot}
                        className={`grid grid-cols-[2.5rem_1fr] gap-2 ${t.slot === hi ? "font-bold text-foreground" : "text-muted-foreground"}`}
                      >
                        <span className="num text-right">{v}</span>
                        <span>{t.name}</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            />
            {teams
              .filter((t) => t.slot !== hi)
              .map((t) => (
                <Line
                  key={t.slot}
                  dataKey={String(t.slot)}
                  stroke="var(--color-muted-foreground)"
                  strokeOpacity={0.35}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              ))}
            <Line
              dataKey={String(hi)}
              stroke="var(--color-red)"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5, stroke: "var(--color-card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </main>
  );
}
