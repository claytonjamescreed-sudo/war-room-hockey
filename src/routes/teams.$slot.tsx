import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { lockerSearch } from "@/lib/history";
import { seasonQuery } from "@/lib/season-query";

// A team's page is its locker now (roster, points and history together); old links land there
export const Route = createFileRoute("/teams/$slot")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(seasonQuery);
    const team = data.teams.find((t) => String(t.slot) === params.slot);
    if (!team) throw notFound();
    throw redirect({ to: "/history", search: lockerSearch(team.name) });
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
});
