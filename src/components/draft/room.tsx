// The draft room: the War Room for the commissioner's own picks, pick entry for every team, and
// practice mocks. The real draft lives in the database (the TV board shows it live); mocks stay
// on this device.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { msg } from "@/hooks/use-commissioner";
import { supabase } from "@/integrations/supabase/client";
import {
  draftQuery,
  useDraftRealtime,
  useDraftWriter,
  type BoardPick,
  type LiveDraft,
} from "@/lib/draft-live";
import {
  mySlotFor,
  nameMatches,
  newMock,
  ordinal,
  readPrefs,
  type Mock,
  type MockOpts,
  type PoolTeam,
  type Prefs,
} from "@/lib/draft-room";
import {
  cpuBoards,
  cpuPick,
  DEFAULT_SETTINGS,
  DEFAULT_WEIGHTS,
  evaluate,
  marketOrder,
  prepare,
  recommend,
  seededRandom,
  slotForPick,
  type ContractsFile,
  type CpuBoards,
  type Ctx,
  type DraftPick,
  type Market,
  type MarketOrders,
  type PlayersFile,
  type PoolTeamsFile,
  type Settings,
} from "@/lib/engine";
import { warRoomData } from "@/lib/warroom.functions";
import { DraftGrid, HurtChip, PlayersBoard } from "./board";
import { OrderSheet } from "./order-sheet";
import { Clock, LogPanel, RecPanel, TeamPanel } from "./panels";
import { RoomContext, useRoom, type Room } from "./room-context";
import { MockSheet, SettingsSheet } from "./sheets";

type WarRoomRaw = { data: PlayersFile; contracts: ContractsFile; poolTeams: PoolTeamsFile };

const DEFAULT_TEAM = "ACE";

const local = {
  get<T>(k: string): T | null {
    try {
      const v = localStorage.getItem(k);
      return v == null ? null : (JSON.parse(v) as T);
    } catch {
      return null;
    }
  },
  set(k: string, v: unknown) {
    try {
      if (v == null) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(v));
    } catch {
      // storage blocked: the mock lasts until the page reloads
    }
  },
};

async function loadPrefs(draftId: string) {
  const { data, error } = await supabase
    .from("warroom_prefs")
    .select("data")
    .eq("draft_id", draftId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return readPrefs(data?.data);
}

const toPick = (p: BoardPick): DraftPick =>
  p.id != null ? { id: p.id } : { id: null, label: p.label ?? "" };

export function DraftRoom() {
  useDraftRealtime();
  const wr = useQuery({
    queryKey: ["warroom"],
    queryFn: async () => JSON.parse(await warRoomData()) as WarRoomRaw,
    staleTime: Infinity,
  });
  const draft = useQuery(draftQuery);
  const draftId = draft.data?.id;
  const prefs = useQuery({
    queryKey: ["warroom-prefs", draftId],
    enabled: !!draftId,
    queryFn: () => loadPrefs(draftId!),
    staleTime: Infinity,
  });
  const ctx = useMemo(
    () => (wr.data ? prepare(wr.data.data, wr.data.contracts.contracts) : null),
    [wr.data],
  );
  const err = wr.error ?? draft.error ?? prefs.error;
  if (err) return <p className="text-lg">The draft room didn't load: {msg(err)}</p>;
  if (draft.data === null)
    return <p className="text-lg">No draft is set up yet. Ask Claude or Lovable to add one.</p>;
  if (!ctx || !wr.data || !draft.data || !prefs.data)
    return <p className="text-lg text-muted-foreground">Loading the War Room…</p>;
  return (
    <Room
      key={draft.data.id}
      ctx={ctx}
      poolTeams={wr.data.poolTeams.teams}
      draft={draft.data}
      initialPrefs={prefs.data}
    />
  );
}

export function Room({
  ctx,
  poolTeams,
  draft,
  initialPrefs,
}: {
  ctx: Ctx;
  poolTeams: PoolTeam[];
  draft: LiveDraft;
  initialPrefs: Prefs;
}) {
  const qc = useQueryClient();
  const writer = useDraftWriter();
  const mockKey = `war-room-mock-${draft.id}`;

  // ----- the commissioner's private settings, saved a moment after each change -----
  const [prefs, setPrefsState] = useState(initialPrefs);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const setPrefs = useCallback(
    (fn: (p: Prefs) => Prefs) => {
      setPrefsState((p) => {
        const next = fn(p);
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
          const { error } = await supabase
            .from("warroom_prefs")
            .upsert({ draft_id: draft.id, data: next, updated_at: new Date().toISOString() });
          if (error) toast.error(`Your settings didn't save: ${error.message}`);
          else qc.setQueryData(["warroom-prefs", draft.id], next);
        }, 600);
        return next;
      });
    },
    [draft.id, qc],
  );
  const myTeam = prefs.settings.myTeam ?? DEFAULT_TEAM;
  const base: Settings = {
    ...DEFAULT_SETTINGS,
    market: (prefs.settings.market as Market | undefined) ?? DEFAULT_SETTINGS.market,
    redraftDrops: prefs.settings.redraftDrops ?? DEFAULT_SETTINGS.redraftDrops,
    weights: { ...DEFAULT_WEIGHTS, ...prefs.settings.weights },
  };

  // ----- real draft or mock -----
  const [mock, setMockState] = useState<Mock | null>(() => local.get<Mock>(mockKey));
  const setMock = (m: Mock | null) => {
    setMockState(m);
    local.set(mockKey, m);
  };
  const [mode, setModeState] = useState<"real" | "mock">(() =>
    local.get("war-room-mode") === "mock" && local.get(mockKey) ? "mock" : "real",
  );
  const setMode = (m: "real" | "mock") => {
    setModeState(m);
    local.set("war-room-mode", m);
  };
  const inMock = mode === "mock" && !!mock;
  const realMySlot = mySlotFor(draft.teamNames, draft.teams, myTeam, prefs.settings.mySlot);
  const settings: Settings = inMock
    ? { ...base, teams: mock.teams, rounds: mock.rounds, mySlot: mock.mySlot }
    : { ...base, teams: draft.teams, rounds: draft.rounds, mySlot: realMySlot };
  const realPicks = useMemo(() => draft.picks.map(toPick), [draft.picks]);
  const picks = inMock ? mock.picks : realPicks;
  const teamNames = inMock ? mock.teamNames : draft.teamNames;
  const cpuMock = inMock && mock.opts.others !== "manual";
  const T = settings.teams;

  // ----- the engine -----
  const evaluateFor = useCallback(
    (list: DraftPick[]) => {
      const taken = new Set(list.flatMap((p) => (p.id != null ? [p.id] : [])));
      const mine = list.flatMap((p, i) =>
        p.id != null && slotForPick(i, settings.teams) === settings.mySlot ? [p.id] : [],
      );
      const ev = evaluate(ctx, settings, taken, mine, { contract: prefs.contract });
      const rec = recommend(ev, settings, list, { top: 4, avoid: new Set(prefs.avoid) });
      return { ev, rec };
    },
    // settings is rebuilt each render; its parts are the real dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, JSON.stringify(settings), prefs.contract, prefs.avoid],
  );
  const { ev, rec } = useMemo(() => evaluateFor(picks), [evaluateFor, picks]);
  const status = rec.status;

  // ----- ui -----
  const [replacing, setReplacingState] = useState<number | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [view, setView] = useState<"players" | "grid">("players");
  const [teamView, setTeamView] = useState<number | null>(null);
  const [sheet, setSheet] = useState<"order" | "settings" | "mock" | null>(null);
  const [skipping, setSkipping] = useState(false);
  const teamPanel = useRef<HTMLDivElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flashRow = (id: number | null) => {
    setFlash(id);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(null), 1800);
  };
  const teamLabel = (slot: number) =>
    slot === settings.mySlot ? "You" : teamNames[slot] || `Team ${slot}`;
  const nameOf = (id: number | null) =>
    id != null ? (ev.byId.get(id)?.p.name ?? `#${id}`) : "a player not on the list";

  // ----- actions -----
  const draftPlayer = (id: number | null, label?: string) => {
    const pick: DraftPick =
      id != null ? { id } : { id: null, label: label || "Player not on list" };
    if (replacing != null) {
      const i = replacing;
      if (id != null && picks.some((p, j) => p.id === id && j !== i))
        return void toast(`${nameOf(id)} is already drafted`);
      setReplacingState(null);
      flashRow(id);
      if (inMock) setMock({ ...mock, picks: mock.picks.map((p, j) => (j === i ? pick : p)) });
      else
        writer
          .replace(draft, i, { id: pick.id, label: pick.label ?? null })
          .catch((e) => toast.error(msg(e)));
      toast(`Pick #${i + 1} is now ${nameOf(id)}`);
      return;
    }
    if (status.done) return void toast("The draft is over. Undo a pick to change it.");
    if (cpuMock && !status.myTurn)
      return void toast("The computer teams are picking. Your turn is coming.");
    if (id != null && picks.some((p) => p.id === id))
      return void toast(`${nameOf(id)} is already drafted`);
    const n = picks.length;
    const slot = slotForPick(n, T);
    flashRow(id);
    if (inMock) {
      if (id != null && rec.picks[0]?.e.id === id) pick.followed = true;
      setMock({ ...mock, picks: [...mock.picks, pick] });
    } else
      writer
        .pick(draft, { id: pick.id, label: pick.label ?? null })
        .catch((e) => toast.error(msg(e)));
    toast(`#${n + 1} · ${teamLabel(slot)} took ${nameOf(id)}`, {
      action: { label: "Undo", onClick: () => undo() },
    });
  };
  const undoRef = useRef<() => void>(() => {});
  const undo = () => undoRef.current();
  undoRef.current = () => {
    if (!picks.length) return;
    if (cpuMock) {
      // Take back my last pick (and the computer picks after it)
      let i = picks.length - 1;
      while (i >= 0 && slotForPick(i, T) !== settings.mySlot) i--;
      if (i < 0) return void toast("You haven't picked yet in this mock");
      const mine = picks[i]!;
      setMock({ ...mock, picks: mock.picks.slice(0, i), auto: false });
      toast(`Took back your pick #${i + 1} (${nameOf(mine.id)}). You're on the clock.`);
      return;
    }
    const last = picks[picks.length - 1]!;
    if (replacing != null && replacing >= picks.length - 1) setReplacingState(null);
    if (inMock) setMock({ ...mock, picks: mock.picks.slice(0, -1) });
    else writer.undo(draft).catch((e) => toast.error(msg(e)));
    toast(`Undid pick #${picks.length} (${last.id != null ? nameOf(last.id) : last.label})`);
  };

  // ----- computer teams in a mock -----
  const cpuCache = useRef<{ seed: number; orders: MarketOrders; boards: CpuBoards } | null>(null);
  useEffect(() => {
    if (!cpuMock || status.done || replacing != null) return;
    if (status.myTurn && !mock.auto) {
      setSkipping(false);
      return;
    }
    const fast = mock.opts.speed === "instant" || skipping;
    const timer = setTimeout(
      () => {
        // How each style ranks the pool, and each team's own board: fixed for a mock
        if (cpuCache.current?.seed !== mock.seed) {
          const orders: MarketOrders = {
            espn: marketOrder(ev.list, "espn"),
            proj: marketOrder(ev.list, "proj"),
            points: marketOrder(ev.list, "points"),
            pool: marketOrder(ev.list, "pool"),
          };
          cpuCache.current = {
            seed: mock.seed,
            orders,
            boards: cpuBoards(orders, mock.cpu, seededRandom(mock.seed || 1)),
          };
        }
        const { orders, boards } = cpuCache.current;
        const total = mock.teams * mock.rounds;
        const next = [...mock.picks];
        const taken = new Set(next.flatMap((p) => (p.id != null ? [p.id] : [])));
        do {
          const n = next.length;
          if (n >= total) break;
          const slot = slotForPick(n, mock.teams);
          if (slot === mock.mySlot) {
            if (!mock.auto) break;
            const top = evaluateFor(next).rec.picks[0];
            if (!top) break;
            next.push({ id: top.e.id, followed: true });
            taken.add(top.e.id);
            continue;
          }
          const cfg = mock.cpu[slot] ?? { style: "espn" as const, noise: 1 };
          // The team's own board already carries its opinions, so it nearly always takes its top player
          const board = boards[slot] ?? orders[cfg.style] ?? orders.pool ?? [];
          const id = cpuPick(board, taken, 0.3);
          next.push(id != null ? { id } : { id: null, label: "Player not on list" });
          if (id != null) taken.add(id);
        } while (fast);
        setMock({ ...mock, picks: next });
      },
      fast ? 0 : status.myTurn ? 450 : 140,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpuMock, mock, status.done, status.myTurn, replacing, skipping]);

  const startMock = (opts: MockOpts | null) => {
    setTeamView(null);
    setReplacingState(null);
    if (opts) {
      const m = newMock(
        opts,
        { teams: draft.teams, rounds: draft.rounds, teamNames: draft.teamNames },
        poolTeams,
        myTeam,
      );
      cpuCache.current = null;
      setMock(m);
      toast(
        `Mock draft started${myTeam ? ` as ${myTeam}` : ""}. You pick ${ordinal(m.mySlot)} of ${m.teams}.${opts.others === "manual" ? " Tap Pick next to each player as he's taken." : ""}`,
      );
    }
    setMode("mock");
  };
  const exitMock = () => {
    setTeamView(null);
    setSkipping(false);
    setReplacingState(null);
    setMode("real");
    toast("Back to your real draft");
  };

  const room: Room = {
    ctx,
    poolTeams,
    mode: inMock ? "mock" : "real",
    draft,
    mock,
    settings,
    picks,
    teamNames,
    prefs,
    myTeam,
    ev,
    rec,
    status,
    cpuMock,
    orderLocked: !!draft.orderLockedAt,
    replacing,
    flash,
    teamLabel,
    draftPlayer,
    undo,
    setReplacing: (i) => {
      setReplacingState(i);
      if (i != null) setView("players");
    },
    toggleList: (key, id) =>
      setPrefs((p) => {
        const set = new Set(p[key]);
        if (set.has(id)) set.delete(id);
        else set.add(id);
        return { ...p, [key]: [...set] };
      }),
    toggleContract: (id, on) => setPrefs((p) => ({ ...p, contract: { ...p.contract, [id]: on } })),
    setPrefs,
    tapSlot: (slot) => {
      if (!inMock && draft.orderLockedAt)
        return void toast(
          "The draft order is locked in. Unlock it under Draft order to change it.",
        );
      setPrefs((p) => ({ ...p, settings: { ...p.settings, mySlot: slot } }));
    },
    viewTeam: (slot) => {
      setTeamView(slot === settings.mySlot ? null : slot);
      teamPanel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    openSheet: setSheet,
    startMock,
    exitMock,
    skipToMine: () => setSkipping(true),
  };

  // What tapping a player does right now, in words, above the board
  let strip = null;
  if (replacing == null) {
    if (status.done)
      strip =
        "The draft is complete. Use Fix in the draft log or the draft board to correct a pick.";
    else if (cpuMock && !status.myTurn)
      strip = `Pick #${status.current + 1}: ${teamLabel(status.onClock!)} (computer) is picking.`;
    else if (status.myTurn)
      strip = `You're on the clock at pick #${status.current + 1}. Search your player at the top, or tap Draft next to him.`;
    else
      strip = `Pick #${status.current + 1} · Round ${status.round} · ${teamLabel(status.onClock!)} is on the clock. Search his name at the top, or tap Pick next to him below.`;
  }
  const btn = "rounded border px-3 py-2 font-semibold hover:bg-muted disabled:opacity-40";

  return (
    <RoomContext.Provider value={room}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">
            {inMock
              ? `Practice mock${myTeam ? ` · as ${myTeam}` : ""}`
              : `${myTeam ? `${myTeam} · ` : ""}${draft.id} · skaters · straight points`}
          </span>
          {inMock && (
            <span className="rounded bg-gold px-2 py-0.5 text-sm font-bold uppercase text-black">
              Mock
            </span>
          )}
          <span className="flex-1" />
          <button className={btn} onClick={undo} disabled={!picks.length}>
            {cpuMock ? "Take back my pick" : "Undo last pick"}
          </button>
          {!inMock && (
            <button className={btn} onClick={() => setSheet("order")}>
              Draft order{draft.orderLockedAt ? " (locked)" : ""}
            </button>
          )}
          {inMock ? (
            <button className={btn} onClick={exitMock}>
              Back to the real draft
            </button>
          ) : (
            <button className={btn} onClick={() => setSheet("mock")}>
              Mock draft
            </button>
          )}
          <button className={btn} onClick={() => setSheet("settings")}>
            Settings
          </button>
          <Link to="/tv" className={btn}>
            TV board
          </Link>
        </div>
        <QuickPick />
        <Clock />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="min-w-0 space-y-4">
            <RecPanel />
            {strip && (
              <p
                className={`rounded px-3 py-2 ${status.myTurn && !status.done ? "bg-red/15 font-semibold" : "bg-muted"}`}
              >
                {strip}
              </p>
            )}
            <div className="flex gap-2" role="tablist">
              {(
                [
                  ["players", "Players"],
                  ["grid", "Draft board"],
                ] as const
              ).map(([k, t]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={view === k}
                  onClick={() => setView(k)}
                  className={`rounded-t border-b-4 px-4 py-2 text-lg font-bold uppercase ${view === k ? "border-red" : "border-transparent text-muted-foreground"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            {view === "grid" ? <DraftGrid /> : <PlayersBoard />}
          </div>
          <div className="space-y-4" ref={teamPanel}>
            <TeamPanel slot={teamView} onSlot={setTeamView} />
            <LogPanel />
          </div>
        </div>
      </div>
      {sheet === "order" && (
        <OrderSheet
          draft={draft}
          poolTeams={poolTeams.map((t) => t.name)}
          myTeam={myTeam}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === "settings" && <SettingsSheet onClose={() => setSheet(null)} />}
      {sheet === "mock" && <MockSheet onClose={() => setSheet(null)} />}
    </RoomContext.Provider>
  );
}

// The search box at the top: type a name, Enter picks the highlighted player for whoever is on
// the clock (or for the pick being fixed). Drafted players show who took them.
function QuickPick() {
  const room = useRoom();
  const { ev, status, picks, settings } = room;
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const hits = q.trim()
    ? ev.list
        .filter((e) => nameMatches(e.p.name, e.p.team, q))
        .sort((a, b) => Number(a.taken) - Number(b.taken) || a.rank - b.rank)
        .slice(0, 8)
    : [];
  const open = hits.filter((e) => !e.taken);
  const selected = open[Math.min(sel, Math.max(0, open.length - 1))];
  const canPick = room.replacing != null || (!status.done && !(room.cpuMock && !status.myTurn));
  const takenAt = new Map(picks.map((p, i) => [p.id, i]));
  const verb = room.replacing != null ? "Use" : status.myTurn ? "Draft" : "Pick";
  const target =
    room.replacing != null
      ? `for pick #${room.replacing + 1}`
      : status.done
        ? ""
        : status.myTurn
          ? `for you at #${status.current + 1}`
          : `for ${room.teamLabel(status.onClock!)} at #${status.current + 1}`;
  const pick = (id: number | null, label?: string) => {
    room.draftPlayer(id, label);
    setQ("");
    setSel(0);
    input.current?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") setSel((s) => Math.min(s + 1, open.length - 1));
    else if (e.key === "ArrowUp") setSel((s) => Math.max(s - 1, 0));
    else if (e.key === "Escape") setQ("");
    else if (e.key === "Enter" && canPick && selected) pick(selected.id);
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
        placeholder={
          room.replacing != null
            ? `Search the right player for pick #${room.replacing + 1}`
            : "Search a player to enter a pick"
        }
        aria-label="Search a player to enter a pick"
        aria-expanded={!!q.trim()}
        className="w-full rounded-lg border-2 border-gold bg-card px-4 py-3 text-2xl"
      />
      {q.trim() && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 rounded-lg border-2 bg-card shadow-2xl">
          {target && canPick && (
            <div className="border-b px-4 py-2 text-sm text-muted-foreground">
              {verb} {target} · Enter picks the highlighted player
            </div>
          )}
          {hits.map((e) => {
            const i = takenAt.get(e.id);
            const isSel = e === selected;
            return (
              <div
                key={e.id}
                className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-lg ${e.taken ? "opacity-60" : ""} ${isSel && canPick ? "bg-muted" : ""}`}
              >
                <span>
                  <b>{e.p.name}</b>{" "}
                  <span className="text-muted-foreground">
                    {e.p.team} · {e.p.pos === "D" ? "D" : "F"} · {Math.round(e.proj)} pts · #
                    {e.rank}
                  </span>
                  {!e.taken && <HurtChip e={e} />}
                </span>
                {e.taken && i != null ? (
                  <span className="rounded bg-muted px-2 py-0.5 text-sm font-bold">
                    Picked #{i + 1} · {room.teamLabel(slotForPick(i, settings.teams))}
                  </span>
                ) : !canPick ? (
                  <span className="text-muted-foreground">
                    {status.done ? "Draft over" : "Computer picking"}
                  </span>
                ) : (
                  <button
                    className={`rounded px-4 py-1.5 font-bold ${status.myTurn && room.replacing == null ? "bg-red text-white" : "bg-primary text-primary-foreground"}`}
                    onClick={() => pick(e.id)}
                  >
                    {verb}
                  </button>
                )}
              </div>
            );
          })}
          {open.length === 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
              <span>
                No available player matches “{q.trim()}”.
                <span className="block text-sm text-muted-foreground">
                  Check the spelling, or record him as a player who isn't on this list.
                </span>
              </span>
              {canPick && room.replacing == null && (
                <button
                  className="rounded border px-3 py-1.5 font-semibold"
                  onClick={() => pick(null, q.trim())}
                >
                  Not on list
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
