import { Link } from "@tanstack/react-router";
import { ShowAllButton } from "@/components/show-all";
import { useShowAll } from "@/hooks/use-show-all";
import { lockerSearch } from "@/lib/history";
import { gamesInOrder, LATEST_GOALS, type LiveData, type TickerPerson } from "@/lib/live";
import { fmtDate } from "@/lib/season-query";

function statusLine(live: LiveData) {
  if (live.games.some((g) => g.status === "live")) return "Live · updates every minute";
  if (live.games.every((g) => g.status === "done")) return "All games final";
  const next = live.games.find((g) => g.status === "upcoming");
  return next ? `First puck drop ${next.label}` : "";
}

// A pool team's player in bold with his team in gold (the team that gets the point); anyone else
// in the play in plain text
function Who({ p }: { p: TickerPerson }) {
  if (!p.owner || p.slot == null) return <>{p.name}</>;
  return (
    <>
      <b>{p.name}</b>{" "}
      <Link
        to="/history"
        search={lockerSearch(p.owner)}
        className="font-semibold text-[#8A5A00] hover:underline dark:text-gold"
      >
        ({p.owner})
      </Link>
    </>
  );
}

export function LiveTonight({ live }: { live: LiveData }) {
  // A busy night has dozens of pool goals: the newest few show, the rest are a tap away
  const { all: allGoals, toggle: toggleGoals, box: goalsBox } = useShowAll<HTMLDivElement>();
  if (!live.anyGames) return null;
  const goals = allGoals ? live.ticker : live.ticker.slice(0, LATEST_GOALS);
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
      {/* Phones: one row to swipe through, however many games there are (a full night
          is 16, which wrapped into eight rows). Wider screens have the room to show them all. */}
      <ul
        className="flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 py-3 md:flex-wrap md:overflow-visible"
        aria-label="Tonight's games"
      >
        {gamesInOrder(live.games).map((g) => (
          <li
            key={g.id}
            className={`min-w-[9.5rem] shrink-0 snap-start rounded border px-3 py-2 ${g.status === "live" ? "border-red" : ""}`}
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
      <div ref={goalsBox} className="scroll-mt-3 border-t px-4 py-3">
        <h3 className="mb-2 text-xl font-bold uppercase">
          Pool goals tonight
          {live.ticker.length > 0 && (
            <span className="num text-muted-foreground"> · {live.ticker.length}</span>
          )}
        </h3>
        {live.ticker.length === 0 ? (
          <p className="text-muted-foreground">No pool player has a point yet tonight.</p>
        ) : (
          <ol className="divide-y" aria-live="polite">
            {goals.map((e) => (
              // Phones and tablets: time and score, then the sentence under it. Wide screens: one row.
              <li key={e.key} className="py-2.5 lg:flex lg:items-baseline lg:gap-x-3 lg:py-2">
                <span className="num block text-sm text-muted-foreground lg:w-24 lg:shrink-0 lg:text-lg">
                  {e.label}
                  <span className="lg:hidden"> · {e.score}</span>
                </span>
                <span className="block min-w-0 lg:flex-1 lg:text-lg">
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
                  <span className="hidden text-muted-foreground lg:inline"> · {e.score}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
        {live.ticker.length > LATEST_GOALS && (
          <ShowAllButton
            all={allGoals}
            total={live.ticker.length}
            few={`the latest ${LATEST_GOALS}`}
            onToggle={toggleGoals}
          />
        )}
      </div>
    </section>
  );
}
