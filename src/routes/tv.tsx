import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { toast, Toaster } from "sonner";
import { ConfirmButton } from "@/components/commissioner";
import { OrderSheet } from "@/components/draft/order-sheet";
import { TeamLogo } from "@/components/team-logo";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { msg, useIsCommissioner } from "@/hooks/use-commissioner";
import { supabase } from "@/integrations/supabase/client";
import {
  draftQuery,
  slotName,
  useDraftRealtime,
  useDraftWriter,
  type BoardPick,
  type LiveDraft,
} from "@/lib/draft-live";
import { nameMatches, ordinal } from "@/lib/draft-room";
import { slotForPick } from "@/lib/engine";
import { poolTeamNames } from "@/lib/warroom.functions";

// The TV board: the live draft on a big screen in the room. Public and read-only, with no
// projections, rankings or advice: only the draft itself and last season's points. The
// commissioner, signed in, can also enter picks and undo from here.
export const Route = createFileRoute("/tv")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "TV Board — WG Hockey Pool" },
      {
        name: "description",
        content: "Our pool draft, live: every pick and who's still available.",
      },
    ],
  }),
  component: TvBoard,
});

type PublicPlayer = {
  id: number;
  name: string;
  team: string;
  pos: string;
  gp: number | null;
  g: number | null;
  a: number | null;
  pts: number | null;
};

// Safe columns only: name, NHL team, position and last season's line
const playersQuery = {
  queryKey: ["players-public"],
  staleTime: Infinity,
  queryFn: async (): Promise<PublicPlayer[]> => {
    const { data, error } = await supabase
      .from("players")
      .select("nhl_id,name,team,pos,last_gp,last_g,last_a,last_pts")
      .range(0, 4999);
    if (error) throw new Error(error.message);
    return data.map((p) => ({
      id: p.nhl_id,
      name: p.name,
      team: p.team ?? "",
      pos: p.pos ?? "",
      gp: p.last_gp,
      g: p.last_g,
      a: p.last_a,
      pts: p.last_pts,
    }));
  },
};

const TV_AVAIL = 150;
// Everything after the first name, so the board reads "Van Riemsdyk", not "Riemsdyk"
const surname = (name: string) => {
  const w = name.split(/\s+/);
  return w.length > 1 ? w.slice(1).join(" ") : name;
};
const store = {
  get: (k: string) => {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      sessionStorage.setItem(k, v);
    } catch {
      // storage blocked: the choice lasts until the page reloads
    }
  },
};

function TvBoard() {
  // Always the dark "road sweater", whatever the rest of the site is set to
  useEffect(() => {
    const el = document.documentElement;
    const had = el.classList.contains("dark");
    el.classList.add("dark");
    return () => {
      if (!had) el.classList.remove("dark");
    };
  }, []);
  useDraftRealtime();
  const draft = useQuery(draftQuery);
  const players = useQuery(playersQuery);

  let body;
  if (draft.isPending || players.isPending)
    body = <p className="p-10 text-3xl text-muted-foreground">Loading the draft…</p>;
  else if (draft.error || players.error)
    body = (
      <p className="p-10 text-3xl">The draft didn't load: {msg(draft.error ?? players.error)}</p>
    );
  else if (!draft.data) body = <p className="p-10 text-3xl">No draft has been set up yet.</p>;
  else body = <Board draft={draft.data} players={players.data} />;
  return (
    <div className="min-h-screen bg-background text-foreground">
      {body}
      <Toaster theme="dark" position="bottom-center" richColors />
    </div>
  );
}

function Board({ draft, players }: { draft: LiveDraft; players: PublicPlayer[] }) {
  const { isAdmin } = useIsCommissioner();
  const writer = useDraftWriter();
  const T = draft.teams;
  const R = draft.rounds;
  const total = T * R;
  const current = draft.picks.length;
  const done = current >= total;
  const onClock = done ? null : slotForPick(current, T);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const takenAt = useMemo(
    () => new Map(draft.picks.flatMap((p, i) => (p.id != null ? [[p.id, i] as const] : []))),
    [draft.picks],
  );
  const [boardHidden, setBoardHidden] = useState(() => store.get("tv-board") === "hidden");
  const [teamPop, setTeamPop] = useState<number | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const pool = useQuery({
    queryKey: ["pool-team-names"],
    enabled: isAdmin && orderOpen,
    queryFn: () => poolTeamNames(),
    staleTime: Infinity,
  });
  const team = (slot: number) => slotName(draft, slot);
  const player = (p: BoardPick | undefined) => {
    const pl = p?.id != null ? byId.get(p.id) : undefined;
    return pl
      ? { name: pl.name, meta: `${pl.team} · ${pl.pos}`, pts: pl.pts }
      : { name: p?.label || (p?.id != null ? `#${p.id}` : ""), meta: "", pts: null };
  };

  const draftTo = async (p: BoardPick) => {
    if (done) return;
    const name = p.id != null ? (byId.get(p.id)?.name ?? "") : p.label;
    try {
      await writer.pick(draft, p);
      toast(`#${current + 1} · ${team(onClock!)} took ${name}`);
    } catch (e) {
      toast.error(msg(e));
    }
  };
  const undo = async () => {
    try {
      await writer.undo(draft);
      toast(`Undid pick #${current}`);
    } catch (e) {
      toast.error(msg(e));
    }
  };

  // The next three picks. At the turn of a snake round a team picks twice in a row: say "again".
  const tile = (label: string, n: number, cls: string) => {
    if (n >= total)
      return (
        <div className={`rounded-lg border-2 border-border p-4 opacity-50 ${cls}`}>
          <div className="text-lg font-bold uppercase tracking-wider">{label}</div>
          <div className="font-display text-5xl font-extrabold uppercase">—</div>
        </div>
      );
    const slot = slotForPick(n, T);
    const again = n > current && slotForPick(n - 1, T) === slot;
    return (
      <div className={`rounded-lg p-4 ${cls}`}>
        <div className="text-lg font-bold uppercase tracking-wider opacity-90">
          {label} · pick #{n + 1}
        </div>
        <div className="flex items-center gap-4 font-display text-5xl font-extrabold uppercase leading-tight xl:text-6xl">
          <TeamLogo name={team(slot)} size={64} className="xl:h-20 xl:w-20" />
          <span>
            {team(slot)}
            {again && <span className="ml-3 align-middle text-2xl opacity-80">again</span>}
          </span>
        </div>
      </div>
    );
  };

  // Everyone not drafted yet, most points last season first
  const left = useMemo(
    () =>
      players
        .filter((p) => !takenAt.has(p.id))
        .sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0) || a.name.localeCompare(b.name)),
    [players, takenAt],
  );
  const recent = draft.picks
    .map((p, i) => ({ p, i }))
    .slice(-6)
    .reverse();

  return (
    <div className="flex min-h-screen flex-col gap-4 p-4 xl:p-6">
      <header className="grid items-stretch gap-4 lg:grid-cols-[auto_1fr]">
        <div className="flex flex-col justify-center border-l-8 border-gold pl-4">
          <div className="font-display text-4xl font-extrabold uppercase leading-none text-gold xl:text-5xl">
            {draft.id}
            <br />
            Pool Draft
          </div>
          <div className="mt-2 text-2xl font-bold uppercase">
            {done ? "Complete" : `Round ${Math.floor(current / T) + 1} of ${R}`}
          </div>
        </div>
        {done ? (
          <div className="rounded-lg bg-red p-4 text-white">
            <div className="text-lg font-bold uppercase tracking-wider">
              All {total} picks are in
            </div>
            <div className="font-display text-6xl font-extrabold uppercase">Draft complete</div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {tile("On the clock", current, "bg-red text-white")}
            {tile("Up next", current + 1, "bg-gold text-black")}
            {tile("On deck", current + 2, "border-2 border-border bg-card")}
          </div>
        )}
      </header>

      <TvSearch
        players={players}
        takenAt={takenAt}
        teamOfPick={(n) => team(slotForPick(n, T))}
        onClockName={onClock ? team(onClock) : null}
        canPick={isAdmin && !done}
        onPick={draftTo}
      />
      {isAdmin && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xl">
          <span>
            {done ? (
              "The draft is complete."
            ) : (
              <>
                Pick #{current + 1} goes to <b>{team(onClock!)}</b>
              </>
            )}
          </span>
          <ConfirmButton
            label="Undo last pick"
            confirmLabel="Tap again to undo"
            disabled={current === 0}
            onConfirm={undo}
          />
        </div>
      )}

      <div className="grid flex-1 gap-4 xl:grid-cols-[1fr_22rem]">
        <main className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-3xl font-extrabold uppercase">Draft board</h2>
            <button
              className="rounded border px-4 py-2 text-lg font-semibold hover:bg-muted"
              onClick={() => {
                store.set("tv-board", boardHidden ? "shown" : "hidden");
                setBoardHidden(!boardHidden);
              }}
            >
              {boardHidden ? "Show draft board ▼" : "Hide draft board ▲"}
            </button>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[1100px] table-fixed border-collapse text-left">
              <thead>
                <tr className="bg-card">
                  <th className="w-10" />
                  {Array.from({ length: T }, (_, i) => (
                    <th key={i} className="border-l px-1 py-2 align-bottom">
                      <button
                        onClick={() => setTeamPop(i + 1)}
                        className="w-full text-center text-[13px] font-bold leading-tight [overflow-wrap:anywhere] hover:underline 2xl:text-sm"
                        title={`See ${team(i + 1)}'s picks`}
                      >
                        <TeamLogo name={team(i + 1)} size={30} className="mx-auto mb-1 block" />
                        {team(i + 1)}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              {!boardHidden && (
                <tbody>
                  {Array.from({ length: R }, (_, r) => (
                    <tr key={r} className="border-t">
                      <th className="px-1 text-center text-lg font-bold text-muted-foreground">
                        R{r + 1}
                      </th>
                      {Array.from({ length: T }, (_, t) => {
                        const n = r * T + (r % 2 === 0 ? t : T - 1 - t);
                        const p = draft.picks[n];
                        const now = n === current;
                        const pl = player(p);
                        return (
                          <td
                            key={t}
                            title={pl.name}
                            className={`h-16 border-l px-1 py-1 align-top ${now ? "bg-red text-white" : n === current - 1 ? "bg-gold/25" : ""}`}
                          >
                            <div className="num text-xs opacity-70">#{n + 1}</div>
                            {p ? (
                              <>
                                <div className="truncate text-sm font-bold leading-tight 2xl:text-base">
                                  {surname(pl.name)}
                                </div>
                                <div className="truncate text-xs opacity-70">{pl.meta}</div>
                              </>
                            ) : (
                              now && <div className="text-sm font-bold">On the clock</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
          <AvailableList left={left} picks={current} />
        </main>
        <aside className="flex flex-col gap-4">
          {draft.picks.length ? (
            <section className="rounded-md border bg-card p-4">
              <h3 className="mb-2 font-display text-3xl font-extrabold uppercase">Latest picks</h3>
              <ol className="divide-y">
                {recent.map(({ p, i }) => {
                  const pl = player(p);
                  return (
                    <li key={i} className="flex gap-3 py-2 text-xl">
                      <span className="num w-12 shrink-0 text-muted-foreground">#{i + 1}</span>
                      <span>
                        <b>{pl.name}</b> <span className="text-muted-foreground">{pl.meta}</span>
                        <br />
                        <span className="inline-flex items-center gap-2 text-muted-foreground">
                          <TeamLogo name={team(slotForPick(i, T))} size={22} />
                          {team(slotForPick(i, T))}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : (
            <section className="rounded-md border bg-card p-4">
              <h3 className="mb-2 flex items-center gap-3 font-display text-3xl font-extrabold uppercase">
                Draft order
                {draft.orderLockedAt && (
                  <span className="rounded bg-gold px-2 py-0.5 font-sans text-sm font-bold text-black">
                    Locked
                  </span>
                )}
              </h3>
              <ol>
                {Array.from({ length: T }, (_, i) => (
                  <li key={i} className="flex gap-3 py-1 text-xl">
                    <span className="num w-8 text-right text-muted-foreground">{i + 1}</span>
                    <button
                      className="flex items-center gap-2.5 hover:underline"
                      onClick={() => setTeamPop(i + 1)}
                    >
                      <TeamLogo name={team(i + 1)} size={28} />
                      {team(i + 1)}
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <nav className="flex flex-wrap gap-2 text-lg">
            {isAdmin && (
              <button
                className="rounded border px-4 py-2 font-semibold hover:bg-muted"
                onClick={() => setOrderOpen(true)}
              >
                Draft order{draft.orderLockedAt ? " (locked)" : ""}
              </button>
            )}
            <Link to="/" className="rounded border px-4 py-2 font-semibold hover:bg-muted">
              Exit TV board
            </Link>
          </nav>
        </aside>
      </div>

      {teamPop != null && teamPop <= T && (
        <TeamPicks
          draft={draft}
          slot={teamPop}
          name={team(teamPop)}
          player={player}
          onClose={() => setTeamPop(null)}
        />
      )}
      {orderOpen && pool.data && (
        <OrderSheet
          draft={draft}
          poolTeams={pool.data}
          myTeam=""
          onClose={() => setOrderOpen(false)}
        />
      )}
    </div>
  );
}

// "Is he still available?" Search any player: Available, or Taken · pick #N by Team
function TvSearch({
  players,
  takenAt,
  teamOfPick,
  onClockName,
  canPick,
  onPick,
}: {
  players: PublicPlayer[];
  takenAt: Map<number, number>;
  teamOfPick: (n: number) => string;
  onClockName: string | null;
  canPick: boolean;
  onPick: (p: BoardPick) => Promise<void>;
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const hits = useMemo(
    () =>
      q.trim()
        ? players
            .filter((p) => nameMatches(p.name, p.team, q))
            .sort(
              (a, b) =>
                Number(takenAt.has(a.id)) - Number(takenAt.has(b.id)) ||
                (b.pts ?? 0) - (a.pts ?? 0),
            )
            .slice(0, 8)
        : [],
    [players, takenAt, q],
  );
  const open = hits.filter((p) => !takenAt.has(p.id));
  const selected = open[Math.min(sel, Math.max(0, open.length - 1))];
  const pick = async (p: BoardPick) => {
    await onPick(p);
    setQ("");
    setSel(0);
    input.current?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") setSel((s) => Math.min(s + 1, open.length - 1));
    else if (e.key === "ArrowUp") setSel((s) => Math.max(s - 1, 0));
    else if (e.key === "Escape") setQ("");
    else if (e.key === "Enter" && canPick && selected) pick({ id: selected.id, label: null });
    else return;
    e.preventDefault();
  };
  return (
    <div className="relative">
      <input
        ref={input}
        type="search"
        autoComplete="off"
        spellCheck={false}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setSel(0);
        }}
        onKeyDown={onKey}
        placeholder="Search a player: is he still available?"
        aria-label="Search a player"
        className="w-full rounded-lg border-2 border-gold bg-card px-5 py-4 text-3xl placeholder:text-muted-foreground"
      />
      {q.trim() && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 rounded-lg border-2 bg-card shadow-2xl">
          {hits.map((p) => {
            const at = takenAt.get(p.id);
            const isSel = p === selected;
            return (
              <div
                key={p.id}
                className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3 text-2xl ${at != null ? "opacity-70" : ""} ${isSel && canPick ? "bg-muted" : ""}`}
              >
                <span>
                  <b>{p.name}</b>{" "}
                  <span className="text-muted-foreground">
                    {p.team} · {p.pos} · {p.pts ?? 0} pts last season
                  </span>
                </span>
                {at != null ? (
                  <span className="rounded bg-red px-3 py-1 font-bold text-white">
                    Taken · pick #{at + 1} by {teamOfPick(at)}
                  </span>
                ) : (
                  <span className="flex items-center gap-3">
                    <span className="rounded bg-up px-3 py-1 font-bold text-white">Available</span>
                    {canPick && onClockName && (
                      <button
                        className="rounded bg-primary px-4 py-2 text-xl font-bold uppercase text-primary-foreground"
                        onClick={() => pick({ id: p.id, label: null })}
                      >
                        Draft to {onClockName}
                      </button>
                    )}
                  </span>
                )}
              </div>
            );
          })}
          {open.length === 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-2xl">
              <span className="text-muted-foreground">
                No available player matches “{q.trim()}”.
              </span>
              {canPick && onClockName && (
                <button
                  className="rounded border px-4 py-2 text-xl font-semibold"
                  onClick={() => pick({ id: null, label: q.trim() })}
                >
                  Not on list: draft “{q.trim()}”
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Who's left, most points last season first. It scrolls itself slowly like a broadcast's
// best-available crawl: it rests at the top and the bottom, starts over, holds still for a few
// seconds whenever someone touches or scrolls it, and goes back to the top after each pick.
function AvailableList({ left, picks }: { left: PublicPlayer[]; picks: number }) {
  const box = useRef<HTMLOListElement>(null);
  const [on, setOn] = useState(() => store.get("tv-scroll") !== "0");
  const s = useRef({ pos: 0, last: 0, holdUntil: 0, userUntil: 0, atEnd: false });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.scrollTop = s.current.pos = 0;
    s.current.atEnd = false;
    s.current.holdUntil = performance.now() + 5000;
  }, [picks]);
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    const st = s.current;
    st.last = 0;
    const tick = (now: number) => {
      const el = box.current;
      if (el) {
        const dt = Math.min(0.1, (now - (st.last || now)) / 1000);
        st.last = now;
        const max = el.scrollHeight - el.clientHeight;
        if (max > 4 && now >= st.userUntil && now >= st.holdUntil && !document.hidden) {
          if (Math.abs(el.scrollTop - st.pos) > 3) st.pos = el.scrollTop; // someone scrolled it
          if (st.pos >= max - 1) {
            if (st.atEnd) {
              el.scrollTop = st.pos = 0;
              st.holdUntil = now + 5000;
            } else st.holdUntil = now + 4000;
            st.atEnd = !st.atEnd;
          } else {
            const row = (el.firstElementChild as HTMLElement | null)?.offsetHeight || 36;
            st.pos = Math.min(max, st.pos + row * 0.6 * dt);
            el.scrollTop = st.pos;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  const hold = (ms: number) => () => {
    s.current.userUntil = performance.now() + ms;
  };
  const cols =
    "grid grid-cols-[2rem_minmax(0,1fr)_3rem_2rem_3rem] items-center gap-2 sm:grid-cols-[3rem_minmax(0,1fr)_4rem_3rem_repeat(4,3.5rem)]";
  const wide = "hidden text-right sm:block";
  return (
    <section className="flex min-h-[24rem] flex-1 flex-col rounded-md border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <h3 className="font-display text-3xl font-extrabold uppercase">
          Available{" "}
          <span className="font-sans text-base font-normal normal-case text-muted-foreground">
            · most points last season first
          </span>
        </h3>
        <button
          className="rounded border px-4 py-2 text-lg font-semibold hover:bg-muted"
          onClick={() => {
            store.set("tv-scroll", on ? "0" : "1");
            setOn(!on);
          }}
        >
          {on ? "Pause scrolling" : "Start scrolling"}
        </button>
      </div>
      <div
        className={`${cols} border-b px-4 py-2 text-sm font-bold uppercase tracking-wider text-muted-foreground`}
        aria-hidden
      >
        <span>#</span>
        <span>Player</span>
        <span>Team</span>
        <span>Pos</span>
        <span className={wide}>GP</span>
        <span className={wide}>G</span>
        <span className={wide}>A</span>
        <span className="text-right">Pts</span>
      </div>
      <ol
        ref={box}
        className="h-[28rem] flex-1 overflow-y-auto px-4 xl:h-auto xl:max-h-[60vh]"
        onWheel={hold(8000)}
        onTouchStart={hold(8000)}
        onPointerDown={hold(8000)}
        onPointerMove={hold(4000)}
      >
        {left.slice(0, TV_AVAIL).map((p, i) => (
          <li key={p.id} className={`${cols} border-b py-2 text-lg sm:text-2xl`}>
            <span className="num text-muted-foreground">{i + 1}</span>
            <span className="truncate font-semibold">{p.name}</span>
            <span>{p.team}</span>
            <span>{p.pos}</span>
            <span className={`num ${wide}`}>{p.gp ?? "–"}</span>
            <span className={`num ${wide}`}>{p.g ?? "–"}</span>
            <span className={`num ${wide}`}>{p.a ?? "–"}</span>
            <span className="num text-right font-bold text-gold">{p.pts ?? "–"}</span>
          </li>
        ))}
        {left.length > TV_AVAIL && (
          <li className="py-3 text-lg text-muted-foreground">
            {left.length - TV_AVAIL} more on the list: search a name above to check anyone else.
          </li>
        )}
      </ol>
    </section>
  );
}

// A team's picks, round by round; it stays up to date as picks come in
function TeamPicks({
  draft,
  slot,
  name,
  player,
  onClose,
}: {
  draft: LiveDraft;
  slot: number;
  name: string;
  player: (p: BoardPick | undefined) => { name: string; meta: string; pts: number | null };
  onClose: () => void;
}) {
  const T = draft.teams;
  const current = draft.picks.length;
  const done = current >= T * draft.rounds;
  let total = 0;
  let count = 0;
  let next = true;
  const rows = Array.from({ length: draft.rounds }, (_, r) => {
    const n = r * T + (r % 2 === 0 ? slot - 1 : T - slot);
    const p = draft.picks[n];
    if (!p) {
      const label = next && !done ? (n === current ? "On the clock now" : "Next pick") : "";
      next = false;
      return { r, n, p: null, label };
    }
    const pl = player(p);
    total += pl.pts ?? 0;
    count++;
    return { r, n, p: pl, label: "" };
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogDescription className="text-lg">
          Picks {ordinal(slot)} · {count} of {draft.rounds} players drafted
        </DialogDescription>
        <DialogTitle className="flex items-center gap-4 font-display text-5xl font-extrabold uppercase">
          <TeamLogo name={name} size={64} />
          {name}
        </DialogTitle>
        <table className="w-full text-left text-xl">
          <thead className="text-sm uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="py-2">Round</th>
              <th>Pick</th>
              <th>Player</th>
              <th className="text-right">Pts last season</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r, n, p, label }) => (
              <tr key={r} className={`border-t ${n === current ? "bg-red/20" : ""}`}>
                <td className="py-2">R{r + 1}</td>
                <td className="num">#{n + 1}</td>
                {p ? (
                  <>
                    <td>
                      <b>{p.name}</b> <span className="text-muted-foreground">{p.meta}</span>
                    </td>
                    <td className="num text-right">{p.pts ?? "–"}</td>
                  </>
                ) : (
                  <td colSpan={2} className="text-muted-foreground">
                    {label}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {count > 0 && (
            <tfoot>
              <tr className="border-t font-bold">
                <td colSpan={3} className="py-2">
                  Total last season, {count} player{count > 1 ? "s" : ""}
                </td>
                <td className="num text-right">{total}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </DialogContent>
    </Dialog>
  );
}
