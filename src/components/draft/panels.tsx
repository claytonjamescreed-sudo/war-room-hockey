// The draft room's panels: the clock, the War Room pick card (or the results once the draft is
// done), a team's roster and the draft log
import { useState, type ReactNode } from "react";
import { pctOf, shortDate, slotForPick, teamTotals, type Entry } from "@/lib/engine";
import { lastName, ordinal, stacks } from "@/lib/draft-room";
import { HurtChip } from "./board";
import { useRoom } from "./room-context";

export function Panel({
  title,
  sub,
  hot,
  children,
}: {
  title: ReactNode;
  sub?: ReactNode;
  hot?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-md border bg-card ${hot ? "border-2 border-red" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-2xl font-extrabold uppercase">{title}</h2>
        {sub && <span className="text-muted-foreground">{sub}</span>}
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

const btn = "rounded border px-3 py-1.5 font-semibold hover:bg-muted";

export function Clock() {
  const room = useRoom();
  const s = room.status;
  const { teams, mySlot } = room.settings;
  const pct = (n: number) => ((n + 0.5) / s.total) * 100;
  let body: ReactNode;
  if (s.done) body = <span className="font-display text-4xl font-extrabold">Draft complete</span>;
  else {
    const who = s.myTurn ? "You're on the clock" : `${room.teamLabel(s.onClock!)} on the clock`;
    const next = !mySlot ? (
      "Set your draft slot to get picks"
    ) : s.myTurn ? (
      s.afterThat != null ? (
        `Then you pick again at #${s.afterThat + 1}`
      ) : (
        "Your last pick"
      )
    ) : s.nextMine != null ? (
      <>
        You pick in <b>{s.picksUntilMine}</b> (at #{s.nextMine + 1})
      </>
    ) : (
      "You're done picking"
    );
    body = (
      <>
        <span className="num font-display text-5xl font-extrabold">#{s.current + 1}</span>
        <span>
          <b className="text-xl">{who}</b>
          <br />
          Round {s.round} · pick {s.pickInRound} of {teams} · {next}
        </span>
      </>
    );
  }
  return (
    <div
      className={`rounded-md border px-4 py-3 ${s.myTurn && !s.done ? "border-2 border-red bg-red/10" : "bg-card"}`}
    >
      <div className="flex flex-wrap items-center gap-4">{body}</div>
      {/* The draft as a strip: filled to the current pick, a tick at each of my picks */}
      <div className="relative mt-3 h-3 rounded bg-muted" aria-hidden>
        <div
          className="absolute inset-y-0 left-0 rounded bg-gold"
          style={{ width: `${(s.current / s.total) * 100}%` }}
        />
        {s.mine.map((n) => (
          <span
            key={n}
            title={`Your pick #${n + 1}`}
            className={`absolute -top-1 h-5 w-1 rounded ${n < s.current ? "bg-muted-foreground" : "bg-red"}`}
            style={{ left: `${pct(n)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// A loud warning on a pick card for anyone hurt or suspended: red when it costs games, amber
// when he's due back before his team plays
function HurtBanner({ e }: { e: Entry }) {
  const h = e.hurt;
  if (!h) return null;
  const level = h.season || h.games >= 3 ? "out" : h.games > 0 ? "doubt" : "minor";
  const cls =
    level === "out"
      ? "border-red bg-red/15"
      : level === "doubt"
        ? "border-gold bg-gold/15"
        : "border-border bg-muted";
  return (
    <div role="note" className={`mt-2 rounded border-l-4 px-3 py-2 ${cls}`}>
      <div className="font-bold uppercase">
        {h.season ? "Out for the season" : h.status}
        {h.type ? ` · ${h.type}` : ""}
      </div>
      <div>
        <b>{h.line}</b>
      </div>
      {h.games > 0 && !h.season && (
        <div>His projection already leaves out those {h.games} games.</div>
      )}
      {h.note && (
        <div className="text-sm">
          {h.noteDate ? `ESPN, ${shortDate(h.noteDate)}: ` : "ESPN: "}
          {h.note}
        </div>
      )}
      <a
        className="text-sm underline"
        href="https://www.rotowire.com/hockey/injury-report.php"
        target="_blank"
        rel="noopener noreferrer"
      >
        Check RotoWire's injury report
      </a>
    </div>
  );
}

export function RecPanel() {
  const room = useRoom();
  const { status: s, rec, ev, settings } = room;
  const { mySlot, teams } = settings;

  if (!mySlot) {
    const top = ev.list.filter((e) => !e.taken).slice(0, 5);
    const locked = room.mode === "real" && room.orderLocked;
    return (
      <Panel title="Where do you pick?" sub={`Snake draft, ${teams} teams`}>
        {locked ? (
          <>
            <p className="mb-3">
              The draft order is locked in{room.myTeam ? `, and ${room.myTeam} isn't in it` : ""}.
              Until you're in it the board below is ranked by projected pool value.
            </p>
            <button className={btn} onClick={() => room.openSheet("order")}>
              See the draft order
            </button>
          </>
        ) : (
          <>
            <p className="mb-3">
              When the order is announced, set it team by team, or just tap your slot. Until then
              the board below is ranked by projected pool value.
            </p>
            {room.mode === "real" && (
              <button
                className="mb-3 rounded bg-primary px-4 py-2 font-bold uppercase text-primary-foreground"
                onClick={() => room.openSheet("order")}
              >
                Set the draft order
              </button>
            )}
            <div className="flex flex-wrap gap-1" role="group" aria-label="Your draft slot">
              {Array.from({ length: teams }, (_, i) => (
                <button
                  key={i}
                  className="num h-11 w-11 rounded border text-lg font-bold hover:bg-muted"
                  onClick={() => room.tapSlot(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </>
        )}
        <h3 className="mt-4 text-sm font-bold uppercase text-muted-foreground">
          Top of the board right now
        </h3>
        <ul className="divide-y">
          {top.map((e) => (
            <li key={e.id} className="flex justify-between py-1.5">
              <span>
                {e.p.name} <span className="text-muted-foreground">{e.p.team}</span>
              </span>
              <span className="text-muted-foreground">{Math.round(e.proj)} pts</span>
            </li>
          ))}
        </ul>
      </Panel>
    );
  }
  if (s.done) return <Results />;
  if (s.nextMine == null)
    return (
      <Panel title="You're done">
        <p>
          All {settings.rounds} of your picks are in. Your roster is under “Your team”.
          {room.cpuMock ? " The computer teams are finishing the draft." : ""}
        </p>
      </Panel>
    );

  const title = s.myTurn ? `Your pick · #${s.current + 1}` : `Your next pick · #${s.nextMine + 1}`;
  const sub = s.myTurn
    ? `Round ${s.round}${s.afterThat != null ? ` · next at #${s.afterThat + 1}` : " · last pick"}`
    : `${s.picksUntilMine} pick${s.picksUntilMine === 1 ? "" : "s"} away · slot ${mySlot}`;
  const labels = s.myTurn
    ? (i: number) => (i === 0 ? "Take" : `Alternative ${i}`)
    : (i: number) => ["Plan A", "If he's gone", "Then", "After that"][i] ?? "";
  const list: { e: Entry; reach: number; reasons: string[]; label: string; best: boolean }[] =
    rec.picks.map((r, i) => ({ ...r, label: labels(i), best: i === 0 }));
  // Last rounds: a high-upside flier, since a bust can be swapped out at the All-Star break
  if (rec.chance) list.push({ ...rec.chance, label: "Or take a chance", best: false });
  const odds = (x: number) => `${pctOf(x)}%`;

  return (
    <Panel title={title} sub={sub} hot={s.myTurn}>
      {room.cpuMock && !s.myTurn && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded bg-muted px-3 py-2">
          <span>Computer teams are picking…</span>
          {room.mock?.opts.speed !== "instant" && (
            <button className={btn} onClick={room.skipToMine}>
              Skip to my pick
            </button>
          )}
        </div>
      )}
      <div className="space-y-3">
        {list.map(({ e, reach, reasons, label, best }) => (
          <div
            key={`${label}-${e.id}`}
            className={`rounded-md border p-3 ${best ? "border-2 border-gold" : ""}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  {label}
                </div>
                <div className="font-display text-3xl font-extrabold uppercase leading-tight">
                  {e.p.name}
                </div>
                <div>
                  {e.p.team} · {e.p.pos} · {Math.round(e.proj)} projected pts
                  {!s.myTurn && ` · ${odds(reach)} there at #${s.nextMine! + 1}`}
                </div>
              </div>
              {s.myTurn && (
                <button
                  className={`rounded px-4 py-2 text-lg font-bold uppercase ${best ? "bg-red text-white" : "border hover:bg-muted"}`}
                  onClick={() => room.draftPlayer(e.id)}
                >
                  Draft {lastName(e.p.name)}
                </button>
              )}
            </div>
            <HurtBanner e={e} />
            <ul className="mt-2 list-disc space-y-0.5 pl-5">
              {reasons.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {!s.myTurn && (
        <>
          <h3 className="mt-4 text-sm font-bold uppercase text-muted-foreground">
            Likely still there at #{s.nextMine + 1}
          </h3>
          <ul className="divide-y">
            {rec.targets.slice(0, 8).map((t) => (
              <li key={t.e.id} className="flex justify-between gap-2 py-1.5">
                <span>
                  {t.e.p.name}{" "}
                  <span className="text-muted-foreground">
                    {t.e.p.team} · {Math.round(t.e.proj)} pts
                  </span>
                </span>
                <span className="num text-muted-foreground">{odds(t.reach)}</span>
              </li>
            ))}
          </ul>
          {rec.goners.length > 0 && (
            <>
              <h3 className="mt-4 text-sm font-bold uppercase text-muted-foreground">
                Probably gone before you pick
              </h3>
              <ul className="divide-y">
                {rec.goners.slice(0, 5).map((t) => (
                  <li key={t.e.id} className="flex justify-between gap-2 py-1.5">
                    <span>
                      {t.e.p.name}{" "}
                      <span className="text-muted-foreground">
                        {t.e.p.team} · {Math.round(t.e.proj)} pts
                      </span>
                    </span>
                    <span className="num text-muted-foreground">{odds(t.reach)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Panel>
  );
}

const CPU_STYLE: Record<string, string> = {
  espn: "drafts off ESPN ADP",
  proj: "drafts off ESPN projections",
  points: "drafts off last season",
  pool: "drafts like your pool",
};

// End of the draft: every team's projected points, where you finished, your steals and reaches
function Results() {
  const room = useRoom();
  const { settings, picks, ev, mock } = room;
  const { teams, mySlot } = settings;
  const table = teamTotals(ev, settings, picks);
  const mine = table.find((t) => t.slot === mySlot);
  const rank = mine ? table.indexOf(mine) + 1 : null;
  const isMock = room.mode === "mock";
  const myPicks = picks.filter((_, i) => slotForPick(i, teams) === mySlot);
  const followed = myPicks.filter((p) => p.followed).length;
  const cpuStyle = (slot: number) => {
    const c = room.cpuMock ? mock?.cpu[slot] : undefined;
    return c ? c.note || CPU_STYLE[c.style] || CPU_STYLE["espn"] : "";
  };
  const gains = (mine?.players ?? []).map(({ e, pick }) => ({ e, pick, gain: pick + 1 - e.rank }));
  const steals = gains
    .filter((x) => x.gain >= 12)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, 3);
  const reaches = gains
    .filter((x) => x.gain <= -20)
    .sort((a, b) => a.gain - b.gain)
    .slice(0, 3);
  const PickList = ({
    list,
    how,
  }: {
    list: typeof gains;
    how: (x: (typeof gains)[number]) => string;
  }) => (
    <ul className="divide-y">
      {list.map((x) => (
        <li key={x.e.id} className="flex justify-between gap-2 py-1.5">
          <span>
            {x.e.p.name}{" "}
            <span className="text-muted-foreground">
              taken #{x.pick + 1}, ranked #{x.e.rank}
            </span>
          </span>
          <span className="text-muted-foreground">{how(x)}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <Panel
      title={isMock ? "Mock results" : "Projected standings"}
      sub={`${teams} teams · ${settings.rounds} rounds`}
    >
      <p className="text-muted-foreground">Tap any team to see its roster.</p>
      {rank && mine && (
        <p className="my-2 text-xl">
          You finished{" "}
          <b>
            {ordinal(rank)} of {teams}
          </b>{" "}
          with <b>{Math.round(mine.total).toLocaleString()}</b> projected points.
        </p>
      )}
      {isMock && myPicks.length > 0 && (
        <p>
          You took the top recommendation on {followed} of {myPicks.length} picks.
        </p>
      )}
      <p className="my-2 text-sm text-muted-foreground">
        Graded on this app's projected points, so it shows how well you drafted by these
        projections, not how the season will go.
        {room.cpuMock
          ? " Each computer team drafts off the list shown next to it, with some randomness."
          : ""}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-sm uppercase text-muted-foreground">
            <tr>
              <th className="py-1">#</th>
              <th>Team</th>
              <th className="text-right">Proj pts</th>
              <th className="hidden pl-3 md:table-cell">Best player</th>
            </tr>
          </thead>
          <tbody>
            {table.map((t, i) => {
              const best = [...t.players].sort((a, b) => b.e.proj - a.e.proj)[0];
              return (
                <tr key={t.slot} className={`border-t ${t.slot === mySlot ? "bg-gold/15" : ""}`}>
                  <td className="num py-1.5">{i + 1}</td>
                  <td>
                    <button
                      className="font-semibold hover:underline"
                      onClick={() => room.viewTeam(t.slot)}
                    >
                      {room.teamLabel(t.slot)}
                      {t.slot === mySlot && room.myTeam ? ` (${room.myTeam})` : ""}
                    </button>{" "}
                    <span className="text-sm text-muted-foreground">
                      slot {t.slot}
                      {cpuStyle(t.slot) ? ` · ${cpuStyle(t.slot)}` : ""}
                    </span>
                  </td>
                  <td className="num text-right font-bold">
                    {Math.round(t.total).toLocaleString()}
                  </td>
                  <td className="hidden pl-3 md:table-cell">{best?.e.p.name ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {steals.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-bold uppercase text-muted-foreground">Your steals</h3>
          <PickList list={steals} how={(x) => `${x.gain} spots later`} />
        </>
      )}
      {reaches.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-bold uppercase text-muted-foreground">Your reaches</h3>
          <PickList list={reaches} how={(x) => `${-x.gain} spots early`} />
        </>
      )}
      {isMock && mock && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded bg-primary px-4 py-2 font-bold uppercase text-primary-foreground"
            onClick={() => room.startMock(mock.opts)}
          >
            Run another mock
          </button>
          <button className={btn} onClick={() => room.openSheet("mock")}>
            Change mock settings
          </button>
          <button className={btn} onClick={room.exitMock}>
            Back to the real draft
          </button>
        </div>
      )}
    </Panel>
  );
}

export function TeamPanel({
  slot: shown,
  onSlot,
}: {
  slot: number | null;
  onSlot: (slot: number | null) => void;
}) {
  const room = useRoom();
  const { settings, picks, ev } = room;
  const T = settings.teams;
  const mySlot = settings.mySlot;
  const slot = shown && shown <= T ? shown : mySlot;
  const isMine = slot === mySlot;
  const roster = picks.flatMap((p, i) =>
    slot && slotForPick(i, T) === slot
      ? [{ i, p, e: p.id != null ? (ev.byId.get(p.id) ?? null) : null }]
      : [],
  );
  const total = roster.reduce((a, m) => a + (m.e ? m.e.proj : 0), 0);
  const pairs = stacks(roster.flatMap((m) => (m.e ? [m.e] : [])));
  const empty = !slot
    ? "Choose your draft slot once the order is set."
    : isMine
      ? "Your picks will show up here."
      : "This team hasn't picked yet.";
  return (
    <Panel
      title={isMine ? "Your team" : room.teamLabel(slot!)}
      sub={slot ? `${roster.length}/${settings.rounds} players` : ""}
    >
      <label className="mb-3 block">
        <span className="sr-only">Show a team's roster</span>
        <select
          value={isMine ? "" : String(slot)}
          onChange={(e) => onSlot(e.target.value ? Number(e.target.value) : null)}
          className="w-full rounded border bg-card px-3 py-2 text-lg"
        >
          <option value="">{mySlot ? `Your team (slot ${mySlot})` : "Your team"}</option>
          {Array.from({ length: T }, (_, i) => i + 1)
            .filter((n) => n !== mySlot)
            .map((n) => (
              <option key={n} value={n}>
                {room.teamLabel(n)} (slot {n})
              </option>
            ))}
        </select>
      </label>
      {roster.length ? (
        <>
          <ul className="divide-y">
            {roster.map((m) => (
              <li key={m.i} className="flex items-baseline gap-2 py-1.5">
                <span className="num w-10 shrink-0 text-muted-foreground">#{m.i + 1}</span>
                <span className="min-w-0 flex-1">
                  {m.e ? (
                    <>
                      {m.e.p.name}{" "}
                      <span className="text-muted-foreground">
                        {m.e.p.team} · {m.e.p.pos}
                      </span>
                      <HurtChip e={m.e} />
                    </>
                  ) : (
                    m.p.label
                  )}
                </span>
                <span className="num font-bold">{m.e ? Math.round(m.e.proj) : "–"}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between border-t pt-2 text-lg font-bold">
            <span>Projected total</span>
            <span className="num">{Math.round(total)}</span>
          </div>
          {pairs.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">Stacks: {pairs.join(" · ")}</p>
          )}
        </>
      ) : (
        <p className="text-muted-foreground">{empty}</p>
      )}
    </Panel>
  );
}

export function LogPanel() {
  const room = useRoom();
  const { picks, settings, ev, status } = room;
  const [all, setAll] = useState(false);
  const recent = picks
    .map((p, i) => ({ p, i }))
    .slice(all ? 0 : -14)
    .reverse();
  return (
    <Panel title="Draft log" sub={`${picks.length} of ${status.total} picks`}>
      {recent.length ? (
        <>
          <ul className="divide-y">
            {recent.map(({ p, i }) => {
              const e = p.id != null ? ev.byId.get(p.id) : null;
              const slot = slotForPick(i, settings.teams);
              return (
                <li
                  key={i}
                  className={`flex items-baseline gap-2 py-1.5 ${slot === settings.mySlot ? "font-semibold" : ""}`}
                >
                  <span className="num w-10 shrink-0 text-muted-foreground">#{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    {e ? e.p.name : p.label}{" "}
                    <span className="font-normal text-muted-foreground">
                      {room.teamLabel(slot)}
                    </span>
                  </span>
                  {!room.cpuMock && (
                    <button className="text-sm underline" onClick={() => room.setReplacing(i)}>
                      Fix
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {picks.length > 14 && (
            <button className="mt-2 text-sm underline" onClick={() => setAll(!all)}>
              {all ? "Show the latest only" : `Show all ${picks.length} picks`}
            </button>
          )}
        </>
      ) : (
        <p className="text-muted-foreground">
          Check players off as they're picked: type a name in the search box and press Enter, or tap
          Pick on the board. Picks go to whoever is on the clock, in snake order.
        </p>
      )}
    </Panel>
  );
}
