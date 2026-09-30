import { Link } from "@tanstack/react-router";
import { nightBrief, type BriefPart } from "@/lib/brief";
import { lockerSearch } from "@/lib/history";
import type { SeasonData } from "@/lib/season";
import { fmtDate } from "@/lib/season-query";

function Part({ p }: { p: BriefPart }) {
  if (typeof p === "string") return <>{p}</>;
  if ("team" in p)
    return (
      <Link to="/history" search={lockerSearch(p.team)} className="font-bold hover:underline">
        {p.team}
      </Link>
    );
  return <b>{p.player}</b>;
}

// An announcer-style rundown of the last synced game day, above the standings
export function NightBrief({
  data,
}: {
  data: Pick<SeasonData, "teams" | "lastNight" | "lastDate">;
}) {
  const { shout, lines } = nightBrief(data);
  if (!lines.length) return null;
  return (
    <section className="mb-8 rounded-md border bg-card" aria-labelledby="recap-h">
      <h2 id="recap-h" className="border-b px-4 py-3 text-3xl font-extrabold uppercase">
        Recap{" "}
        <span className="text-muted-foreground">
          · {fmtDate(data.lastDate, { weekday: "short", month: "short", day: "numeric" })}
        </span>
      </h2>
      <p className="px-4 py-3 text-lg leading-relaxed">
        {shout && <span className="font-extrabold uppercase text-primary">{shout} </span>}
        {lines.map((line, i) => (
          <span key={i}>
            {i > 0 && " "}
            {line.map((p, j) => (
              <Part key={j} p={p} />
            ))}
          </span>
        ))}
      </p>
    </section>
  );
}
