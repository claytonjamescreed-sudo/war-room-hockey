import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { fmtDate, seasonQuery } from "@/lib/season-query";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Standings — War Room Hockey Pool" },
      { name: "description", content: "Season standings for our 15-team NHL hockey pool: points, last night, last 7 days and projected finish." },
      { property: "og:title", content: "Standings — War Room Hockey Pool" },
      { property: "og:description", content: "Season standings for our 15-team NHL hockey pool." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(seasonQuery),
  errorComponent: ({ error }) => <p className="p-8 text-lg">Standings didn't load: {error.message}</p>,
  notFoundComponent: () => <p className="p-8">Not found</p>,
  component: Standings,
});

function Move({ rank, prev }: { rank: number; prev: number | null }) {
  if (prev == null || prev === rank) return <Minus className="h-4 w-4 text-muted-foreground" aria-label="no change" />;
  return prev > rank ? (
    <span className="flex items-center text-sm font-bold text-up"><ArrowUp className="h-4 w-4" />{prev - rank}</span>
  ) : (
    <span className="flex items-center text-sm font-bold text-red"><ArrowDown className="h-4 w-4" />{rank - prev}</span>
  );
}

function Standings() {
  const { data } = useSuspenseQuery(seasonQuery);
  return (
    <main className="mx-auto max-w-6xl px-3 py-6 sm:px-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-5xl font-extrabold uppercase">Standings</h1>
        <p className="text-muted-foreground">
          Through {fmtDate(data.lastDate, { weekday: "short", month: "short", day: "numeric" })} · {data.gameDays} game day{data.gameDays === 1 ? "" : "s"}
        </p>
      </div>
      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full min-w-[640px] text-left">
          <thead className="bg-muted text-sm uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-3">#</th>
              <th className="px-3 py-3">Team</th>
              <th className="px-3 py-3 text-right">Pts</th>
              <th className="px-3 py-3 text-right">Last night</th>
              <th className="px-3 py-3 text-right">Last 7</th>
              <th className="px-3 py-3 text-right">Back</th>
              <th className="px-3 py-3 text-right">Proj.</th>
            </tr>
          </thead>
          <tbody>
            {data.teams.map((t) => (
              <tr key={t.slot} className="border-t">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="num w-7 text-2xl font-bold">{t.rank}</span>
                    <Move rank={t.rank} prev={t.prevRank} />
                  </div>
                </td>
                <td className="px-3 py-3">
                  <Link to="/teams/$slot" params={{ slot: String(t.slot) }} className="text-lg font-semibold hover:underline">
                    {t.name}
                  </Link>
                </td>
                <td className="num px-3 py-3 text-right text-3xl font-extrabold">{t.pts}</td>
                <td className="num px-3 py-3 text-right text-xl">{t.lastNight || "–"}</td>
                <td className="num px-3 py-3 text-right text-xl">{t.last7}</td>
                <td className="num px-3 py-3 text-right text-xl text-muted-foreground">{t.back || "–"}</td>
                <td className="px-3 py-3 text-right">
                  <div className="num text-xl font-bold">{t.projected}</div>
                  <div className="text-xs text-muted-foreground">draft {t.preseason}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.lastNight.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-3xl font-bold uppercase">Last night's scorers</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {data.lastNight.map((p) => (
              <li key={p.id} className="flex justify-between rounded border bg-card px-4 py-3">
                <span><b>{p.name}</b> <span className="text-muted-foreground">({p.owner})</span></span>
                <span className="num text-lg">{p.lastNight!.g}G {p.lastNight!.a}A</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
