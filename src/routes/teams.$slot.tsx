import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { TeamRoster } from "@/components/team-roster";
import { fmtDate, liveQuery, seasonQuery } from "@/lib/season-query";

export const Route = createFileRoute("/teams/$slot")({
  loader: async ({ context, params }) => {
    const [data] = await Promise.all([
      context.queryClient.ensureQueryData(seasonQuery),
      context.queryClient.ensureQueryData(liveQuery),
    ]);
    const team = data.teams.find((t) => String(t.slot) === params.slot);
    if (!team) throw notFound();
    return { name: team.name };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.name} — War Room Hockey Pool` : "Team — War Room";
    const description = loaderData
      ? `${loaderData.name}'s roster, points and swaps in our NHL hockey pool.`
      : "Pool team roster.";
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
  errorComponent: ({ error }) => (
    <p className="p-8 text-lg">This team didn't load: {error.message}</p>
  ),
  notFoundComponent: () => (
    <p className="p-8 text-lg">
      No such team.{" "}
      <Link to="/" className="underline">
        Back to standings
      </Link>
    </p>
  ),
  component: TeamPage,
});

function TeamPage() {
  const { slot } = Route.useParams();
  const { data } = useSuspenseQuery(seasonQuery);
  const { data: live } = useSuspenseQuery(liveQuery);
  const t = data.teams.find((x) => String(x.slot) === slot)!;
  const lt = live.teams.find((x) => x.slot === t.slot);
  return (
    <main className="mx-auto max-w-5xl px-3 py-6 sm:px-4">
      <Link to="/" className="text-muted-foreground hover:underline">
        ← Standings
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-5xl font-extrabold uppercase">{t.name}</h1>
        <div className="flex gap-6 text-center">
          <Stat label="Rank" value={lt?.rank ?? t.rank} />
          <Stat label="Points" value={lt?.total ?? t.pts} />
          {lt && live.anyGames && <Stat label="Tonight" value={lt.tonight} />}
          <Stat label="Projected" value={t.projected} />
          <Stat label="Swaps left" value={Math.max(0, data.redraftSwaps - t.swapsUsed)} />
        </div>
      </div>
      <div className="mt-6 overflow-x-auto rounded-md border bg-card">
        <div className="min-w-[640px]">
          <TeamRoster team={t} live={live} full />
        </div>
      </div>
      {t.dropped.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-2xl font-bold uppercase">Swapped out</h2>
          <ul className="divide-y rounded-md border bg-card">
            {t.dropped.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-3 text-muted-foreground"
              >
                <span>
                  <span className="font-semibold line-through">{p.name}</span>{" "}
                  <span className="text-sm">
                    dropped {fmtDate(p.droppedOn)} for {p.replacedBy}
                  </span>
                </span>
                <span className="num line-through">
                  {p.gp} GP · {p.g}G {p.a}A · {p.pts} P
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-3 text-sm text-muted-foreground">
        Draft-day projection: {t.preseason} points.
      </p>
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
