import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { fmtDate, seasonQuery } from "@/lib/season-query";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Swaps & Rules — WG Hockey Pool" },
      {
        name: "description",
        content: "How our hockey pool is scored, and the log of All-Star redraft swaps.",
      },
      { property: "og:title", content: "Swaps & Rules — WG Hockey Pool" },
      { property: "og:description", content: "Scoring rules and the All-Star redraft swap log." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(seasonQuery),
  errorComponent: ({ error }) => (
    <p className="p-8 text-lg">
      This page didn't load: {error instanceof Error ? error.message : String(error)}
    </p>
  ),
  notFoundComponent: () => <p className="p-8">Not found</p>,
  component: Rules,
});

function Rules() {
  const { data } = useSuspenseQuery(seasonQuery);
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 text-lg leading-relaxed">
      <h1 className="mb-4 text-5xl font-extrabold uppercase">Swaps</h1>
      {data.moves.length === 0 ? (
        <p className="rounded border bg-card px-4 py-4 text-muted-foreground">
          No swaps yet this season.
        </p>
      ) : (
        <ul className="divide-y rounded border bg-card">
          {data.moves.map((m, i) => (
            <li key={i} className="px-4 py-3">
              <b>{fmtDate(m.date)}</b> · {m.team}: <span className="line-through">{m.out}</span>{" "}
              out, <b>{m.in}</b> in
            </li>
          ))}
        </ul>
      )}
      <h2 className="mb-3 mt-10 text-4xl font-extrabold uppercase">The rules</h2>
      <ul className="list-disc space-y-3 pl-6">
        <li>15 teams each draft 10 NHL skaters in a snake draft. No goalies, no position rules.</li>
        <li>
          A player scores one point per goal and one per assist, in regular-season games only,
          counted from {fmtDate(data.countFrom, { month: "long", day: "numeric", year: "numeric" })}
          .
        </li>
        <li>A team's total is the sum of its current players' points.</li>
        <li>
          At the All-Star break each team can swap out up to {data.redraftSwaps} players. A swap
          dated, say, February 5 counts the new player's February 5 game and not the dropped
          player's. Before February 5 the old roster counts. From that date the dropped player takes
          all his points with him, and the new player counts for his whole season.
        </li>
        <li>Teams with the same points share a rank.</li>
        <li>
          Projected finish: for each player, his points so far plus his scoring rate times the games
          he's expected to play. That's his NHL team's games left (of {data.seasonGames}), less the
          games he's expected to miss if he's on the injury report with a return date. The rate is
          points per game he has played, blending his draft-day projection, counted as 20 games,
          with his actual scoring. A swapped-in player with no draft projection starts at 0.45
          points a game.
        </li>
      </ul>
    </main>
  );
}
