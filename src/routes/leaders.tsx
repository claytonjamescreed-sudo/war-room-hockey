import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { TeamLogo } from "@/components/team-logo";
import { lockerSearch } from "@/lib/history";
import type { Leader } from "@/lib/season";
import { seasonQuery } from "@/lib/season-query";

export const Route = createFileRoute("/leaders")({
  head: () => ({
    meta: [
      { title: "Leaders — War Room Hockey Pool" },
      {
        name: "description",
        content:
          "Top pool scorers with their owners, and the best players on no pool team for the All-Star redraft.",
      },
      { property: "og:title", content: "Leaders — War Room Hockey Pool" },
      { property: "og:description", content: "Top pool scorers and best available players." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(seasonQuery),
  errorComponent: ({ error }) => (
    <p className="p-8 text-lg">Leaders didn't load: {error.message}</p>
  ),
  notFoundComponent: () => <p className="p-8">Not found</p>,
  component: Leaders,
});

function Leaders() {
  const { data } = useSuspenseQuery(seasonQuery);
  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-3 py-6 sm:px-4 lg:grid-cols-2">
      <section>
        <h1 className="mb-3 text-4xl font-extrabold uppercase">Top pool scorers</h1>
        <ol className="divide-y rounded-md border bg-card">
          {data.topPool.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <span className="num w-6 text-xl text-muted-foreground">{i + 1}</span>
              <div className="flex-1">
                <div className="font-semibold">
                  {p.name} <span className="text-sm text-muted-foreground">{p.team}</span>
                </div>
                <Link
                  to="/history"
                  search={lockerSearch(p.owner)}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:underline"
                >
                  <TeamLogo name={p.owner} size={18} />
                  {p.owner}
                </Link>
              </div>
              <span className="num text-sm text-muted-foreground">
                {p.g}G {p.a}A
              </span>
              <span className="num w-10 text-right text-2xl font-bold">{p.pts}</span>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h2 className="mb-1 text-4xl font-extrabold uppercase">Best available</h2>
        <p className="mb-3 text-muted-foreground">
          Top NHL scorers on no pool team — the All-Star redraft list.
        </p>
        <ol className="max-h-[70vh] divide-y overflow-y-auto rounded-md border bg-card">
          {data.availableAll.map((p: Leader, i: number) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <span className="num w-8 text-xl text-muted-foreground">{i + 1}</span>
              <div className="flex-1 font-semibold">
                {p.name}{" "}
                <span className="text-sm text-muted-foreground">
                  {p.team} · {p.pos}
                </span>
              </div>
              <span className="num text-sm text-muted-foreground">
                {p.gp} GP · {p.g}G {p.a}A
              </span>
              <span className="num w-10 text-right text-2xl font-bold">{p.pts}</span>
            </li>
          ))}
          {data.availableAll.length === 0 && (
            <li className="px-4 py-6 text-muted-foreground">No NHL scoring leaders yet.</li>
          )}
        </ol>
      </section>
    </main>
  );
}
