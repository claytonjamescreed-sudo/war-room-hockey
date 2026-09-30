// The players board (filters, sorts, a row per player with his details on tap) and the draft
// board grid (every pick, round by round)
import { Fragment, useMemo, useState } from "react";
import { fmtSeason, pctOf, slotForPick, valueLabel, type Entry } from "@/lib/engine";
import { lastName, nameMatches } from "@/lib/draft-room";
import { useRoom } from "./room-context";

const TAG_STYLE: Record<string, string> = {
  hurt: "bg-red text-white",
  injury: "border border-red text-red",
  declining: "bg-red/15 text-red",
  contract: "bg-red/15 text-red",
  moved: "bg-muted text-foreground",
};
const tagCls = (k: string) =>
  `inline-block rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide ${TAG_STYLE[k] ?? "bg-gold/25 text-foreground"}`;

export function Tags({ e, only }: { e: Entry; only?: string[] }) {
  return (
    <>
      {e.tags
        .filter((t) => !only || only.includes(t.k))
        .map((t) => (
          <span key={t.k + t.t} className={tagCls(t.k)} title={t.d}>
            {t.t}
          </span>
        ))}
    </>
  );
}

// The red Hurt chip on its own, for lists that don't show every tag
export function HurtChip({ e }: { e: Entry | null | undefined }) {
  const t = e?.hurt && e.tags.find((x) => x.k === "hurt");
  return t ? (
    <span className={`ml-1 ${tagCls("hurt")}`} title={t.d}>
      {t.t}
    </span>
  ) : null;
}

const FILTERS: [string, string][] = [
  ["all", "All"],
  ["starred", "Starred"],
  ["rookie", "Rookies"],
  ["bounce", "Bounce-back"],
  ["value", "Value vs ADP"],
  ["stack", "Stacks with my team"],
  ["offense", "Top-8 offense"],
  ["contract", "New big contract"],
  ["rising", "Rising"],
  ["declining", "Declining"],
  ["injury", "Injury flags"],
  ["moved", "New team"],
];

const lastPPG = (e: Entry) => e.p.recent?.rows.at(-1)?.ppg ?? -1;

// The last three seasons' points per game, last season colored against the two before
function Ppg3({ e }: { e: Entry }) {
  const r = e.p.recent;
  if (!r) return <span className="text-muted-foreground">–</span>;
  const cls =
    r.change == null ? "" : r.change >= 0.05 ? "text-up" : r.change <= -0.05 ? "text-red" : "";
  const title = r.rows
    .map(
      (x) =>
        `${fmtSeason(x.season)}: ${x.ppg != null ? `${x.ppg.toFixed(2)} pts/gm in ${x.gp} GP` : "no NHL games"}`,
    )
    .join("\n");
  return (
    <span className="num whitespace-nowrap" title={title}>
      {r.rows.map((x, i) => {
        const v = x.ppg == null ? "–" : x.ppg.toFixed(2);
        return i === r.rows.length - 1 ? (
          <b key={i} className={cls}>
            {v}
          </b>
        ) : (
          <span key={i} className="mr-1 text-muted-foreground">
            {v}
          </span>
        );
      })}
    </span>
  );
}

// Points per game across the five seasons, one point per season (a gap under 10 games), on a
// shared zero baseline. The end dot is last season, colored by the trend.
function Spark({ e }: { e: Entry }) {
  const { ctx } = useRoom();
  const p = e.p;
  const W = 70;
  const H = 22;
  const pad = 3;
  const vals = ctx.seasons.map((season) => {
    const h = p.hist.find((r) => r.season === season);
    return { season, gp: h?.gp ?? 0, v: h && h.gp >= 10 ? h.pts / h.gp : null };
  });
  const lastI = vals.map((x) => x.v != null).lastIndexOf(true);
  if (lastI < 0) return <span className="text-muted-foreground">–</span>;
  const max = Math.max(0.4, ...vals.flatMap((x) => (x.v != null ? [x.v] : []))) * 1.1;
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (vals.length - 1);
  const y = (v: number) => H - pad - (v / max) * (H - 2 * pad);
  let d = "";
  let pen = false;
  vals.forEach((pt, i) => {
    if (pt.v == null) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(pt.v).toFixed(1)}`;
    pen = true;
  });
  const dir = p.trend?.dir ?? 0;
  const color = dir > 0 ? "text-up" : dir < 0 ? "text-red" : "text-muted-foreground";
  const title = vals
    .map(
      (pt) =>
        `${fmtSeason(pt.season)}: ${pt.v != null ? `${pt.v.toFixed(2)} pts/gm in ${pt.gp} GP` : pt.gp ? `${pt.gp} GP` : "did not play"}`,
    )
    .join("\n");
  const lastV = vals[lastI]!.v!;
  return (
    <span className={`inline-flex items-center gap-1 ${color}`} title={title}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden>
        <line
          x1={pad}
          x2={W - pad}
          y1={H - pad}
          y2={H - pad}
          className="stroke-border"
          strokeWidth={1}
        />
        <path d={d} fill="none" stroke="currentColor" strokeWidth={1.6} />
        <circle cx={x(lastI).toFixed(1)} cy={y(lastV).toFixed(1)} r={2.6} fill="currentColor" />
      </svg>
      <span className="num text-sm">
        {dir !== 0 && (
          <i aria-label={dir > 0 ? "rising" : "declining"} className="not-italic">
            {dir > 0 ? "▲" : "▼"}
          </i>
        )}
        {lastV.toFixed(2)}
      </span>
    </span>
  );
}

function DetailRow({ e, cols }: { e: Entry; cols: number }) {
  const room = useRoom();
  const { ev, status, prefs } = room;
  const p = e.p;
  const first = p.hist[0]?.season;
  const seasons = room.ctx.seasons.filter((season) => first && season >= first);
  const starred = prefs.starred.includes(e.id);
  const avoiding = prefs.avoid.includes(e.id);
  const hasContract = e.tags.some((t) => t.k === "contract");
  const espn = p.espn;
  const canPick = !e.taken && !status.done && !(room.cpuMock && !status.myTurn);
  const btn = "rounded border px-3 py-1.5 font-semibold hover:bg-muted";
  return (
    <tr className="bg-muted/40">
      <td colSpan={cols} className="px-3 py-4">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <h4 className="text-lg font-bold uppercase">Projection</h4>
            <p>
              <b>{Math.round(e.proj)} pts</b> over ~{e.expGP} games.{" "}
              {e.espn != null && !e.speculative
                ? `ESPN projects ${Math.round(e.espn)}${espn?.gp ? ` in ${espn.gp} GP` : ""}; our 3-season model says ${Math.round(e.own)}.`
                : e.speculative
                  ? "No NHL history and no ESPN projection, so this is a rough guess from his draft slot."
                  : "ESPN doesn't project him; this is our 3-season model on ESPN's scale."}
              {e.missedNow
                ? ` Expected to miss about ${e.missedNow} games to start the season.`
                : ""}
            </p>
            <p>
              Draft score {e.score} (rank #{e.rank})
              {p.draft ? ` · drafted ${p.draft.year}, #${p.draft.overall} overall` : ""}
            </p>
            {e.tags.map((t) => (
              <p key={t.k + t.t}>
                <span className={tagCls(t.k)}>{t.t}</span> {t.d}
              </p>
            ))}
            <div className="flex flex-wrap gap-2 pt-2">
              {canPick && (
                <button
                  className={`rounded px-3 py-1.5 font-bold ${status.myTurn ? "bg-red text-white" : "bg-primary text-primary-foreground"}`}
                  onClick={() => room.draftPlayer(e.id)}
                >
                  {status.myTurn
                    ? `Draft ${lastName(p.name)}`
                    : `${room.teamLabel(status.onClock!)} took him (#${status.current + 1})`}
                </button>
              )}
              <button className={btn} onClick={() => room.toggleList("starred", e.id)}>
                {starred ? "Unstar" : "Star"}
              </button>
              <button className={btn} onClick={() => room.toggleList("avoid", e.id)}>
                {avoiding ? "Stop avoiding" : "Avoid"}
              </button>
              <button className={btn} onClick={() => room.toggleContract(e.id, !hasContract)}>
                {hasContract ? "Not a big new contract" : "Flag big new contract"}
              </button>
              <a
                className={btn}
                href={`https://www.nhl.com/player/${p.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                NHL.com
              </a>
              {espn?.id ? (
                <a
                  className={btn}
                  href={`https://www.espn.com/nhl/player/_/id/${espn.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ESPN
                </a>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-lg font-bold uppercase">Last five seasons</h4>
            {seasons.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="text-left">Season</th>
                      <th className="text-left">Team</th>
                      <th>GP</th>
                      <th>G</th>
                      <th>A</th>
                      <th>PTS</th>
                      <th>P/GP</th>
                      <th>PPP</th>
                      <th>TOI</th>
                    </tr>
                  </thead>
                  <tbody className="num">
                    {seasons.map((season) => {
                      const h = p.hist.find((r) => r.season === season);
                      if (!h)
                        return (
                          <tr key={season}>
                            <td className="text-left">{fmtSeason(season)}</td>
                            <td colSpan={8} className="text-left text-muted-foreground">
                              Did not play in the NHL
                            </td>
                          </tr>
                        );
                      return (
                        <tr key={season}>
                          <td className="text-left">{fmtSeason(h.season)}</td>
                          <td className="text-left">{h.teams}</td>
                          <td>{h.gp}</td>
                          <td>{h.g}</td>
                          <td>{h.a}</td>
                          <td>
                            <b>{h.pts}</b>
                          </td>
                          <td>{h.gp ? (h.pts / h.gp).toFixed(2) : "–"}</td>
                          <td>{h.ppp}</td>
                          <td>
                            {Math.floor(h.toi / 60)}:{String(h.toi % 60).padStart(2, "0")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>Has not played in the NHL in the last five seasons.</p>
            )}
            <h4 className="pt-2 text-lg font-bold uppercase">Plays most with</h4>
            {p.mates.some(([id]) => ev.byId.has(id)) ? (
              <>
                <ul className="divide-y">
                  {p.mates.map(([id, share]) => {
                    const m = ev.byId.get(id);
                    if (!m) return null;
                    return (
                      <li key={id} className="flex justify-between gap-2 py-1">
                        <span>
                          {m.p.name}{" "}
                          <span className="text-muted-foreground">
                            {m.p.pos === "D" ? "D" : "F"}
                          </span>
                        </span>
                        <span className="text-muted-foreground">
                          {Math.round(share * 100)}% of his shifts
                        </span>
                        <span className="text-muted-foreground">
                          {m.taken ? "drafted" : `#${m.rank}`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="text-sm text-muted-foreground">
                  Share of his ice time spent with each teammate, from NHL shift charts (end of last
                  season and this preseason). Linemates and power-play partners show up here.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">Not enough shift data with his current team.</p>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

type Sort = "rank" | "proj" | "last" | "ppg" | "trend" | "odds";

export function PlayersBoard() {
  const room = useRoom();
  const { ev, rec, status, settings, picks, prefs } = room;
  const [filter, setFilter] = useState("all");
  const [pos, setPos] = useState<"all" | "F" | "D">("all");
  const [showTaken, setShowTaken] = useState(true);
  const [sort, setSort] = useState<Sort>("rank");
  const [limit, setLimit] = useState(150);
  const [open, setOpen] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const replacing = room.replacing;
  const hideTaken = !showTaken || replacing != null;

  const sorts: Record<Sort, (a: Entry, b: Entry) => number> = {
    rank: (a, b) => a.rank - b.rank,
    proj: (a, b) => b.proj - a.proj,
    last: (a, b) => (b.p.lastRow?.pts ?? -1) - (a.p.lastRow?.pts ?? -1),
    ppg: (a, b) => lastPPG(b) - lastPPG(a),
    trend: (a, b) => (b.p.trend?.rel ?? -9) - (a.p.trend?.rel ?? -9),
    odds: (a, b) => (rec.reachById.get(b.id) ?? -1) - (rec.reachById.get(a.id) ?? -1),
  };
  const rows = ev.list
    .filter((e) => {
      if (e.taken && hideTaken) return false;
      if (pos === "F" && e.p.pos === "D") return false;
      if (pos === "D" && e.p.pos !== "D") return false;
      if (filter === "starred" && !prefs.starred.includes(e.id)) return false;
      if (filter === "injury" && !e.tags.some((t) => t.k === "injury" || t.k === "hurt"))
        return false;
      if (!["all", "starred", "injury"].includes(filter) && !e.tags.some((t) => t.k === filter))
        return false;
      if (q && !nameMatches(e.p.name, e.p.team, q)) return false;
      return true;
    })
    .sort(sorts[sort]);
  // `limit` available players, with drafted ones crossed off in their place
  const shown: Entry[] = [];
  let availCount = 0;
  for (const e of rows) {
    if (!e.taken) {
      if (availCount >= limit) break;
      availCount++;
    }
    shown.push(e);
  }
  const hiddenCount = rows.length - shown.length;
  const T = settings.teams;
  const takenBy = useMemo(() => new Map(picks.map((p, i) => [p.id, i])), [picks]);
  const mine = new Set(
    picks.flatMap((p, i) => (p.id != null && slotForPick(i, T) === settings.mySlot ? [p.id] : [])),
  );
  const oddsLabel = status.myTurn
    ? `At #${(status.afterThat ?? 0) + 1}`
    : status.nextMine != null
      ? `At #${status.nextMine + 1}`
      : "Odds";
  const cols = settings.mySlot ? 8 : 7;
  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm font-semibold ${on ? "border-foreground bg-foreground text-background" : "hover:bg-muted"}`;
  const Th = ({
    k,
    label,
    cls = "",
    title,
  }: {
    k: Sort;
    label: string;
    cls?: string;
    title: string;
  }) => (
    <th className={`px-2 py-2 text-right ${cls}`} title={title}>
      <button
        onClick={() => setSort(k)}
        aria-sort={sort === k ? "descending" : undefined}
        className={`uppercase ${sort === k ? "text-foreground underline" : ""}`}
      >
        {label}
      </button>
    </th>
  );

  return (
    <div>
      {replacing != null && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded border-2 border-gold bg-gold/15 px-3 py-2">
          <span className="font-semibold">
            Fixing pick #{replacing + 1}: choose the right player on the board.
          </span>
          <button
            className="rounded border px-3 py-1 font-semibold"
            onClick={() => room.setReplacing(null)}
          >
            Cancel
          </button>
        </div>
      )}
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter the board by name or team"
          aria-label="Filter the board"
          className="min-w-0 flex-1 rounded border bg-card px-3 py-2 text-lg"
        />
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map(([k, t]) => (
          <button
            key={k}
            className={chip(filter === k)}
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
          >
            {k === "value" ? valueLabel(settings.market) : t}
          </button>
        ))}
        <button
          className={chip(pos !== "all")}
          aria-pressed={pos !== "all"}
          onClick={() => setPos(pos === "all" ? "F" : pos === "F" ? "D" : "all")}
        >
          {pos === "all" ? "F + D" : pos === "F" ? "Forwards" : "Defence"}
        </button>
        <button
          className={chip(!showTaken)}
          aria-pressed={!showTaken}
          onClick={() => setShowTaken(!showTaken)}
          title="Drafted players stay on the board, crossed off. Hide them to see only who's left."
        >
          Hide drafted
        </button>
      </div>
      <div className="overflow-x-auto rounded-md border bg-card">
        <table className="w-full text-left">
          <thead className="bg-muted text-sm text-muted-foreground">
            <tr>
              <Th
                k="rank"
                label="#"
                cls="text-left"
                title="Our rank: projection adjusted for your settings"
              />
              <th className="px-2 py-2 uppercase">Player</th>
              <Th k="proj" label="Proj" title="Projected points this season" />
              <Th
                k="last"
                label="Last yr"
                cls="hidden md:table-cell"
                title="Points and games played last season"
              />
              <Th
                k="trend"
                label="5-yr P/GP"
                cls="hidden lg:table-cell"
                title="Points per game in each of the last five seasons (hover for numbers). Sort puts the fastest risers first."
              />
              <Th
                k="ppg"
                label="P/GP 3 yrs"
                cls="hidden lg:table-cell"
                title="Points per game in each of the last three seasons, oldest first. Last season is green if it's up 5% or more on the two before, red if it's down."
              />
              {settings.mySlot && (
                <Th k="odds" label={oddsLabel} title="Chance he's still available at your pick" />
              )}
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {shown.map((e) => {
              const p = e.p;
              const h = p.lastRow;
              const reach = rec.reachById.get(e.id);
              const i = takenBy.get(e.id);
              const isMine = mine.has(e.id);
              let act = null;
              if (replacing != null || (!e.taken && !(room.cpuMock && !status.myTurn))) {
                const label = replacing != null ? "Use" : status.myTurn ? "Draft" : "Pick";
                act = (
                  <button
                    className={`rounded px-3 py-1.5 font-bold ${status.myTurn && replacing == null ? "bg-red text-white" : "border hover:bg-muted"} disabled:opacity-40`}
                    disabled={status.done && replacing == null}
                    onClick={() => room.draftPlayer(e.id)}
                    title={`${p.name} to ${replacing != null ? `pick #${replacing + 1}` : status.done ? "" : `${room.teamLabel(status.onClock!)} at #${status.current + 1}`}`}
                  >
                    {label}
                  </button>
                );
              }
              const pct = reach == null || e.taken ? null : pctOf(reach);
              return (
                <Fragment key={e.id}>
                  <tr
                    className={`border-t ${e.taken ? "text-muted-foreground" : ""} ${isMine ? "bg-gold/15" : ""} ${room.flash === e.id ? "bg-up/20" : ""}`}
                  >
                    <td className="num px-2 py-2 text-lg">{e.rank}</td>
                    <td className="px-2 py-2">
                      <button
                        className={`text-left text-lg font-semibold hover:underline ${e.taken ? "line-through" : ""}`}
                        onClick={() => setOpen(open === e.id ? null : e.id)}
                        aria-expanded={open === e.id}
                      >
                        {prefs.starred.includes(e.id) && (
                          <span className="text-gold" title="Starred">
                            ★{" "}
                          </span>
                        )}
                        {p.name}
                      </button>
                      <div className="text-sm text-muted-foreground">
                        {p.team} ·{" "}
                        {p.pos === "D" ? "D" : p.pos === "C" ? "C" : p.pos === "L" ? "LW" : "RW"}
                        {p.age ? ` · ${Math.floor(p.age)}` : ""}
                        {prefs.avoid.includes(e.id) && " (avoiding)"}
                      </div>
                      {e.taken && i != null ? (
                        <span
                          className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-bold ${isMine ? "bg-gold text-black" : "bg-muted text-foreground"}`}
                        >
                          {isMine
                            ? `Your pick · #${i + 1}`
                            : `Picked #${i + 1} · ${room.teamLabel(slotForPick(i, T))}`}
                        </span>
                      ) : (
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Tags e={e} />
                        </div>
                      )}
                    </td>
                    <td className="num px-2 py-2 text-right">
                      <span className="text-xl font-bold">{Math.round(e.proj)}</span>
                      {e.speculative && <div className="text-xs text-muted-foreground">guess</div>}
                    </td>
                    <td className="num hidden px-2 py-2 text-right md:table-cell">
                      {h ? (
                        <>
                          {h.pts}
                          <div className="text-xs text-muted-foreground">{h.gp} GP</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </td>
                    <td className="hidden px-2 py-2 text-right lg:table-cell">
                      <Spark e={e} />
                    </td>
                    <td className="hidden px-2 py-2 text-right lg:table-cell">
                      <Ppg3 e={e} />
                    </td>
                    {settings.mySlot && (
                      <td className="px-2 py-2 text-right">
                        {pct != null && (
                          <span
                            className={`num font-semibold ${pct < 35 ? "text-red" : pct < 70 ? "text-gold" : ""}`}
                          >
                            {pct}%
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-2 py-2 text-right">{act}</td>
                  </tr>
                  {open === e.id && <DetailRow e={e} cols={cols} />}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-center">
        {hiddenCount > 0 ? (
          <button
            className="rounded border px-4 py-2 font-semibold hover:bg-muted"
            onClick={() => setLimit(limit + 150)}
          >
            Show more players ({hiddenCount} more)
          </button>
        ) : (
          !rows.length && (
            <span className="text-muted-foreground">
              No players match.{" "}
              {q ? "Check the spelling, or use “Not on list” in the search at the top." : ""}
            </span>
          )
        )}
      </div>
    </div>
  );
}

// Every pick so far, round by round and team by team. Tap a filled square to fix it.
export function DraftGrid() {
  const room = useRoom();
  const { settings, picks, ev } = room;
  const { teams: T, rounds: R, mySlot } = settings;
  const canFix = !room.cpuMock;
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full min-w-[900px] table-fixed border-collapse text-left text-sm">
        <thead>
          <tr>
            <th className="w-10" />
            {Array.from({ length: T }, (_, i) => (
              <th
                key={i}
                className={`border-l px-1 py-2 text-center font-bold uppercase leading-tight ${i + 1 === mySlot ? "bg-gold/25" : ""}`}
                title={`Slot ${i + 1}`}
              >
                {room.teamLabel(i + 1)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: R }, (_, r) => (
            <tr key={r} className="border-t">
              <th className="text-center text-muted-foreground">R{r + 1}</th>
              {Array.from({ length: T }, (_, t) => {
                const n = r * T + (r % 2 === 0 ? t : T - 1 - t);
                const pick = picks[n];
                const now = n === picks.length;
                const cls = `h-14 border-l px-1 py-1 align-top ${t + 1 === mySlot ? "bg-gold/10" : ""} ${now ? "outline outline-2 -outline-offset-2 outline-red" : ""}`;
                if (!pick)
                  return (
                    <td key={t} className={cls}>
                      <div className="num text-xs text-muted-foreground">#{n + 1}</div>
                      {now && <div className="text-xs font-bold text-red">on the clock</div>}
                    </td>
                  );
                const e = pick.id != null ? ev.byId.get(pick.id) : null;
                const label = (
                  <>
                    <div className="truncate font-semibold">{e ? e.p.name : pick.label}</div>
                    {e && (
                      <div className="truncate text-xs text-muted-foreground">
                        {e.p.team} · {e.p.pos} · {Math.round(e.proj)}
                      </div>
                    )}
                  </>
                );
                return (
                  <td key={t} className={cls}>
                    <div className="num text-xs text-muted-foreground">#{n + 1}</div>
                    {canFix ? (
                      <button
                        className="w-full text-left hover:underline"
                        title={`Fix pick #${n + 1}`}
                        onClick={() => room.setReplacing(n)}
                      >
                        {label}
                      </button>
                    ) : (
                      label
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
