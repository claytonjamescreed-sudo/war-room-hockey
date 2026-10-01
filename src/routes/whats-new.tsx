import { createFileRoute } from "@tanstack/react-router";
import { CHANGELOG, type ChangeKind } from "@/data/changelog";
import { builtAt, CURRENT, fmtBuilt } from "@/lib/release";
import { fmtDate } from "@/lib/season-query";

export const Route = createFileRoute("/whats-new")({
  head: () => ({
    meta: [
      { title: "What's new — WG Hockey Pool" },
      {
        name: "description",
        content: "Every version of the WG Hockey Pool site and what changed in it.",
      },
      { property: "og:title", content: "What's new — WG Hockey Pool" },
      { property: "og:description", content: "Every version of the WG Hockey Pool site." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WhatsNew,
});

const KIND: Record<ChangeKind, { label: string; className: string }> = {
  new: { label: "New", className: "bg-gold text-accent-foreground" },
  improved: { label: "Better", className: "bg-up text-white" },
  fixed: { label: "Fixed", className: "bg-red text-white" },
};

function WhatsNew() {
  const built = builtAt(__APP_BUILD__);
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-2 text-5xl font-extrabold uppercase">What's new</h1>
      <p className="mb-8 text-lg text-muted-foreground">
        You're on <b className="text-foreground">version {CURRENT.version}</b>
        {built && <> · built {fmtBuilt(built)}</>} · build{" "}
        <span className="num">{__APP_BUILD__}</span>
      </p>
      <ol className="space-y-8">
        {CHANGELOG.map((r) => (
          <li key={r.version} className="rounded-md border bg-card">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
              <h2 className="text-3xl font-extrabold uppercase">
                {r.title} <span className="text-muted-foreground">· v{r.version}</span>
              </h2>
              <time dateTime={r.date} className="text-muted-foreground">
                {fmtDate(r.date, { month: "long", day: "numeric", year: "numeric" })}
              </time>
            </div>
            <ul className="space-y-3 px-4 py-4 text-lg">
              {r.changes.map((c, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className={`mt-1 h-fit shrink-0 rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${KIND[c.kind].className}`}
                  >
                    {KIND[c.kind].label}
                  </span>
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </main>
  );
}
