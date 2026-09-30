import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "War Room — NHL Hockey Pool" },
      {
        name: "description",
        content:
          "War Room: live standings and draft headquarters for our 15-team NHL hockey pool.",
      },
      { property: "og:title", content: "War Room — NHL Hockey Pool" },
      {
        property: "og:description",
        content:
          "War Room: live standings and draft headquarters for our 15-team NHL hockey pool.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
        15-Team NHL Pool
      </p>
      <h1 className="mt-5 text-6xl font-black uppercase tracking-tight text-foreground sm:text-7xl">
        War Room
      </h1>
      <p className="mt-5 max-w-md text-sm text-muted-foreground">
        Standings and draft headquarters. Setup in progress.
      </p>
    </main>
  );
}
