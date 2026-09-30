import { Link } from "@tanstack/react-router";
import { lockerSearch } from "@/lib/history";
import type { LiveData, TickerPerson } from "@/lib/live";
import { fmtDate } from "@/lib/season-query";

function statusLine(live: LiveData) {
  if (live.games.some((g) => g.status === "live")) return "Live · updates every minute";
  if (live.games.every((g) => g.status === "done")) return "All games final";
  const next = live.games.find((g) => g.status === "upcoming");
  return next ? `First puck drop ${next.label}` : "";
}

function Who({ p }: { p: TickerPerson }) {
  return (
    <>
      <b>{p.name}</b>
      {p.owner && p.slot != null && (
        <>
          {" "}
          <Link
            to="/history"
            search={lockerSearch(p.owner)}
            className="text-muted-foreground hover:underline"
          >
            ({p.owner})
          </Link>
        </>
      )}
    </>
  );
}

export function LiveTonight({ live }: { live: LiveData }) {
  if (!live.anyGames) return null;
  return (
    <section className="mb-8 rounded-md border bg-card" aria-labelledby="tonight-h">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 id="tonight-h" className="text-3xl font-extrabold uppercase">
          Tonight{" "}
          <span className="text-muted-foreground">
            · {fmtDate(live.date, { weekday: "short", month: "short", day: "numeric" })}
          </span>
        </h2>
        <p className="flex items-center gap-2 font-semibold">
          {live.anyLive && (
            <span
              className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red"
              aria-hidden
            />
          )}
          {statusLine(live)}
        </p>
      </div>
      <ul className="flex flex-wrap gap-2 px-4 py-3" aria-label="Tonight's games">
        {live.games.map((g) => (
          <li
            key={g.id}
            className={`min-w-[9.5rem] rounded border px-3 py-2 ${g.status === "live" ? "border-red" : ""}`}
          >
            <div className="num flex justify-between gap-3 text-xl font-bold">
              <span>{g.away}</span>
              <span>{g.awayScore ?? ""}</span>
            </div>
            <div className="num flex justify-between gap-3 text-xl font-bold">
              <span>{g.home}</span>
              <span>{g.homeScore ?? ""}</span>
            </div>
            <div
              className={`text-sm font-semibold ${g.status === "live" ? "text-red" : "text-muted-foreground"}`}
            >
              {g.label}
            </div>
          </li>
        ))}
      </ul>
      <div className="border-t px-4 py-3">
        <h3 className="mb-2 text-xl font-bold uppercase">Pool goals tonight</h3>
        {live.ticker.length === 0 ? (
          <p className="text-muted-foreground">No pool player has a point yet tonight.</p>
        ) : (
          <ol className="divide-y" aria-live="polite">
            {live.ticker.map((e) => (
              <li
                key={e.key}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-lg"
              >
                <span className="num w-24 shrink-0 text-muted-foreground">{e.label}</span>
                <span className="min-w-0 flex-1">
                  <Who p={e.scorer} /> scored
                  {e.assists.length > 0 && (
                    <>
                      , assisted by{" "}
                      {e.assists.map((a, i) => (
                        <span key={`${a.id}-${i}`}>
                          {i > 0 && (i === e.assists.length - 1 ? " and " : ", ")}
                          <Who p={a} />
                        </span>
                      ))}
                    </>
                  )}
                  <span className="text-muted-foreground"> · {e.score}</span>
                </span>
                <span className="flex flex-wrap gap-1">
                  {e.credits.map((c) => (
                    <span
                      key={c.slot}
                      className="rounded bg-gold px-2 py-0.5 text-sm font-bold text-accent-foreground"
                    >
                      {c.name} +{c.pts} → {c.total}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
