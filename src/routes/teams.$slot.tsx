import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { fmtDate, seasonQuery } from "@/lib/season-query";

export const Route = createFileRoute("/teams/$slot")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(seasonQuery);
    const team = data.teams.find((t) => String(t.slot) === params.slot);
    if (!team) throw notFound();
    return { name: team.name };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.name} — War Room Hockey Pool` : "Team — War Room";
    const description = loaderData ? `${loaderData.name}'s roster, points and swaps in our NHL hockey pool.` : "Pool team roster.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  errorComponent: ({ error }) => <p className="p-8 text-lg">This team didn't load: {error.message}</p>,
  notFoundComponent: () => <p className="p-8 text-lg">No such team. <Link to="/" className="underline">Back to standings</Link></p>,
  component: TeamPage,
});

function TeamPage() {
  const { slot } = Route.useParams();
  const { data } = useSuspenseQuery(seasonQuery);
  const t = data.teams.find((x) => String(x.slot) === slot)!;
  return (
    <main className="mx-auto max-w-5xl px-3 py-6 sm:px-4">
      <Link to="/" className="text-muted-foreground hover:underline">← Standings</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-5xl font-extrabold uppercase">{t.name}</h1>
        <div className="flex gap-6 text-center">
          <Stat label="Rank" value={t.rank} />
          <Stat label="Points" value={t.pts} />
          <Stat label="Projected" value={t.projected} />
          <Stat label="Swaps left" value={Math.max(0, data.redraftSwaps - t.swapsUsed)} />
        </div>
      </div>
      <div className="mt-6 overflow-x-auto rounded-md border bg-card">
        <table className="w-full min-w-[600px] text-left">
          <thead className="bg-muted text-sm uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Player</th>
              <th className="px-3 py-3 text-right">GP</th>
              <th className="px-3 py-3 text-right">G</th>
              <th className="px-3 py-3 text-right">A</th>
              <th className="px-3 py-3 text-right">P</th>
              <th className="px-3 py-3">Last game</th>
              <th className="px-3 py-3">Tonight</th>
            </tr>
          </thead>
          <tbody>
            {t.roster.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-3 py-3">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-sm text-muted-foreground">{p.team} · {p.pos}</div>
                </td>
                <td className="num px-3 py-3 text-right text-lg">{p.gp}</td>
                <td className="num px-3 py-3 text-right text-lg">{p.g}</td>
                <td className="num px-3 py-3 text-right text-lg">{p.a}</td>
                <td className="num px-3 py-3 text-right text-2xl font-bold">{p.pts}</td>
                <td className="px-3 py-3 text-sm">
                  {p.lastGame ? `${fmtDate(p.lastGame.date)} ${p.lastGame.home ? "vs" : "@"} ${p.lastGame.opp}: ${p.lastGame.g}G ${p.lastGame.a}A` : "—"}
                </td>
                <td className="px-3 py-3 text-sm">
                  {p.playsNext ? <span className="rounded bg-gold px-2 py-1 font-semibold text-accent-foreground">Plays</span> : <span className="text-muted-foreground">No game</span>}
                </td>
              </tr>
            ))}
            {t.dropped.map((p) => (
              <tr key={`d${p.id}`} className="border-t text-muted-foreground">
                <td className="px-3 py-3">
                  <div className="font-semibold line-through">{p.name}</div>
                  <div className="text-sm">Dropped {fmtDate(p.droppedOn)} for {p.replacedBy}</div>
                </td>
                <td className="num px-3 py-3 text-right line-through">{p.gp}</td>
                <td className="num px-3 py-3 text-right line-through">{p.g}</td>
                <td className="num px-3 py-3 text-right line-through">{p.a}</td>
                <td className="num px-3 py-3 text-right line-through">{p.pts}</td>
                <td colSpan={2} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Draft-day projection: {t.preseason} points.</p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="num text-4xl font-extrabold">{value}</div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
