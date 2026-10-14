import { Link } from "@tanstack/react-router";
import { BOOTHS, nightBrief, type BriefLine, type BriefPart } from "@/lib/brief";
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

function Line({ line }: { line: BriefLine }) {
  return (
    <>
      {line.map((p, j) => (
        <Part key={j} p={p} />
      ))}
    </>
  );
}

// An announcer-style rundown of the last synced game day, above the standings, called from a
// different Vancouver booth each game day (see brief.ts and src/data/booths.ts)
export function NightBrief({
  data,
}: {
  data: Pick<SeasonData, "teams" | "lastNight" | "lastDate">;
}) {
  const { booth, open, shout, lines, saying, signoff } = nightBrief(data);
  if (!lines.length) return null;
  return (
    <section className="mb-8 rounded-md border bg-card" aria-labelledby="recap-h">
      <h2 id="recap-h" className="border-b px-4 py-3 text-3xl font-extrabold uppercase">
        Recap{" "}
        <span className="text-muted-foreground">
          · {fmtDate(data.lastDate, { weekday: "short", month: "short", day: "numeric" })}
        </span>
      </h2>
      <p className="px-4 pt-3 text-lg leading-relaxed">
        {open && (
          <span className="italic text-muted-foreground">
            <Line line={open} />{" "}
          </span>
        )}
        {shout && <span className="font-extrabold uppercase text-primary">{shout} </span>}
        {lines.map((line, i) => (
          <span key={i}>
            {i > 0 && " "}
            <Line line={line} />
          </span>
        ))}
        {saying && <> {saying}</>}
        {signoff && (
          <span className="italic text-muted-foreground">
            {" "}
            <Line line={signoff} />
          </span>
        )}
      </p>
      {booth && (
        <p className="px-4 pb-3 pt-1 text-sm text-muted-foreground">
          Called in the spirit of {BOOTHS[booth].name}.
        </p>
      )}
    </section>
  );
}
