import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CommissionerGate, ConfirmButton, Err } from "@/components/commissioner";
import { field, msg, primary, quiet, useAction } from "@/hooks/use-commissioner";
import {
  adminState,
  rebuildTotals,
  recordSwap,
  renameTeam,
  searchNhlPlayers,
  setCountFrom,
  syncBatch,
  undoSwap,
} from "@/lib/admin.functions";
import type { getSeason } from "@/lib/season.functions";
import { fmtDate, seasonQuery } from "@/lib/season-query";

// The commissioner's tools. Client-only: the session lives in the browser.
export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Commissioner — War Room Hockey Pool" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

const todayET = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8 rounded-md border bg-card">
      <h2 className="border-b px-4 py-3 text-3xl font-bold uppercase">{title}</h2>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

function Admin() {
  return (
    <main className="mx-auto max-w-4xl px-3 py-6 sm:px-4">
      <h1 className="mb-6 text-4xl font-extrabold uppercase sm:text-5xl">Commissioner</h1>
      <CommissionerGate>
        {({ email, signOut }) => <Tools email={email} onSignOut={signOut} />}
      </CommissionerGate>
    </main>
  );
}

function Tools({ email, onSignOut }: { email: string | null; onSignOut: () => void }) {
  const qc = useQueryClient();
  const state = useQuery({ queryKey: ["admin"], queryFn: () => adminState() });
  const season = useQuery(seasonQuery);
  const refresh = () =>
    Promise.all(["admin", "season", "live"].map((k) => qc.invalidateQueries({ queryKey: [k] })));

  if (state.isPending || season.isPending)
    return <p className="text-lg text-muted-foreground">Loading the league…</p>;
  if (state.error || season.error)
    return <p className="text-lg">The league didn't load: {msg(state.error ?? season.error)}</p>;

  const s = state.data;
  return (
    <>
      <p className="mb-6 flex flex-wrap items-center gap-3 text-muted-foreground">
        Signed in as {email}.
        <button onClick={onSignOut} className="underline">
          Sign out
        </button>
        <Link to="/draft" className="font-semibold text-foreground underline">
          Draft room
        </Link>
        <Link to="/tv" className="font-semibold text-foreground underline">
          TV board
        </Link>
      </p>
      <SyncPanel lastSyncedAt={s.season.lastSyncedAt} refresh={refresh} />
      <SwapPanel admin={s} season={season.data} refresh={refresh} />
      <TeamsPanel admin={s} refresh={refresh} />
      <SeasonPanel admin={s} refresh={refresh} />
    </>
  );
}

type AdminData = Awaited<ReturnType<typeof adminState>>;
type SeasonData = Awaited<ReturnType<typeof getSeason>>;
type Refresh = () => Promise<unknown>;

const BATCH = 40;

function SyncPanel({ lastSyncedAt, refresh }: { lastSyncedAt: string | null; refresh: Refresh }) {
  const [progress, setProgress] = useState<string | null>(null);
  const { busy, error, run } = useAction();
  const sync = () =>
    run(async () => {
      for (let offset = 0; ; offset += BATCH) {
        const r = await syncBatch({ data: { offset, limit: BATCH } });
        setProgress(`Game logs: ${Math.min(offset + BATCH, r.total)} of ${r.total} players`);
        if (r.done) break;
      }
      setProgress("Rebuilding the standings…");
      const r = await rebuildTotals();
      await refresh();
      setProgress(`Done. Standings are through ${fmtDate(r.lastDate)}.`);
    });
  return (
    <Panel title="Stats sync">
      <p className="mb-3 text-lg">
        Last synced:{" "}
        <b>
          {lastSyncedAt
            ? new Date(lastSyncedAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : "never"}
        </b>
      </p>
      <p className="mb-4 text-muted-foreground">
        The site pulls every pool player's games from NHL.com each morning. Use this if last night's
        points are missing.
      </p>
      <button onClick={sync} disabled={busy} className={primary}>
        {busy ? "Syncing…" : "Sync now"}
      </button>
      {progress && (
        <p className="mt-3 text-lg" aria-live="polite">
          {progress}
        </p>
      )}
      <Err error={error} />
    </Panel>
  );
}

type Found = Awaited<ReturnType<typeof searchNhlPlayers>>[number];

function SwapPanel({
  admin,
  season,
  refresh,
}: {
  admin: AdminData;
  season: SeasonData;
  refresh: Refresh;
}) {
  const limit = admin.season.swapsPerTeam;
  const used = (slot: number) => admin.moves.filter((m) => m.slot === slot).length;
  const teamName = (slot: number) => admin.teams.find((t) => t.slot === slot)?.name ?? `#${slot}`;
  const { names, owner } = useMemo(() => {
    const names = new Map<number, string>();
    const owner = new Map<number, string>();
    for (const t of season.teams) {
      for (const p of [...t.roster, ...t.dropped]) names.set(p.id, p.name);
      for (const p of t.roster) owner.set(p.id, t.name);
    }
    return { names, owner };
  }, [season]);

  const [slot, setSlot] = useState<number | null>(null);
  const [outId, setOutId] = useState<number | null>(null);
  const [incoming, setIncoming] = useState<Found | null>(null);
  const [date, setDate] = useState(todayET);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const search = useQuery({
    queryKey: ["nhl-search", debounced],
    enabled: debounced.length >= 2,
    queryFn: () => searchNhlPlayers({ data: { q: debounced } }),
    staleTime: 60_000,
  });
  const roster = season.teams.find((t) => t.slot === slot)?.roster ?? [];
  const add = useAction();
  const undo = useAction();

  const reset = () => {
    setOutId(null);
    setIncoming(null);
    setQ("");
  };
  const ready =
    slot != null && outId != null && incoming != null && /^\d{4}-\d{2}-\d{2}$/.test(date);
  const save = () =>
    add.run(async () => {
      await recordSwap({
        data: { date, slot: slot!, outId: outId!, inId: incoming!.id, inName: incoming!.name },
      });
      reset();
      setSlot(null);
      await refresh();
    });

  return (
    <Panel title="Redraft swaps">
      <p className="mb-4 text-muted-foreground">
        Each team can make {limit} swaps. A swap dated February 5 counts the new player's February 5
        game. Recording or undoing a swap rebuilds every total.
      </p>

      {admin.moves.length === 0 ? (
        <p className="mb-6 text-lg">No swaps yet.</p>
      ) : (
        <ul className="mb-6 divide-y rounded border">
          {admin.moves.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-3">
              <span className="text-lg">
                <b>{teamName(m.slot)}</b> · {fmtDate(m.date)}: out{" "}
                {names.get(m.outId) ?? `#${m.outId}`}, in {m.inName ?? names.get(m.inId)}
              </span>
              <ConfirmButton
                label="Undo"
                confirmLabel="Tap again to undo"
                disabled={undo.busy}
                onConfirm={() =>
                  undo.run(async () => {
                    await undoSwap({ data: { id: m.id } });
                    await refresh();
                  })
                }
              />
            </li>
          ))}
        </ul>
      )}
      <Err error={undo.error} />

      <h3 className="mb-3 text-xl font-bold uppercase">Record a swap</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block font-semibold">Team</span>
          <select
            value={slot ?? ""}
            onChange={(e) => {
              setSlot(e.target.value ? Number(e.target.value) : null);
              reset();
            }}
            className={`${field} w-full`}
          >
            <option value="">Choose a team</option>
            {admin.teams.map((t) => (
              <option key={t.slot} value={t.slot} disabled={used(t.slot) >= limit}>
                {t.name} ({used(t.slot)} of {limit} used)
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block font-semibold">First day the new player counts</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${field} w-full`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-semibold">Player out</span>
          <select
            value={outId ?? ""}
            disabled={slot == null}
            onChange={(e) => setOutId(e.target.value ? Number(e.target.value) : null)}
            className={`${field} w-full`}
          >
            <option value="">{slot == null ? "Choose a team first" : "Choose a player"}</option>
            {roster.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.team ?? "—"}, {p.pts} pts)
              </option>
            ))}
          </select>
        </label>
        <div>
          <label htmlFor="swap-in" className="mb-1 block font-semibold">
            Player in
          </label>
          {incoming ? (
            <div className="flex items-center justify-between gap-2 rounded border bg-card px-3 py-2 text-lg">
              <span>
                <b>{incoming.name}</b> {incoming.team ?? ""} {incoming.pos}
              </span>
              <button className="underline" onClick={() => setIncoming(null)}>
                Change
              </button>
            </div>
          ) : (
            <>
              <input
                id="swap-in"
                type="search"
                placeholder="Search any NHL skater"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className={`${field} w-full`}
              />
              {debounced.length >= 2 && (
                <ul className="mt-1 max-h-72 overflow-y-auto rounded border">
                  {search.isPending ? (
                    <li className="px-3 py-2 text-muted-foreground">Searching…</li>
                  ) : search.error ? (
                    <li className="px-3 py-2 text-red">Search failed: {msg(search.error)}</li>
                  ) : search.data?.length === 0 ? (
                    <li className="px-3 py-2 text-muted-foreground">No skaters found.</li>
                  ) : (
                    search.data?.map((p) => {
                      const on = owner.get(p.id);
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            disabled={!!on}
                            onClick={() => setIncoming(p)}
                            className="flex w-full justify-between gap-2 px-3 py-2 text-left text-lg hover:bg-muted disabled:opacity-50"
                          >
                            <span>
                              <b>{p.name}</b> {p.team ?? ""} {p.pos}
                            </span>
                            {on && <span className="text-sm">on {on}</span>}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
      {ready && (
        <p className="mt-4 text-lg">
          <b>{teamName(slot!)}</b> drops <b>{names.get(outId!)}</b> and adds <b>{incoming!.name}</b>
          , counting from {fmtDate(date, { weekday: "short", month: "short", day: "numeric" })}.
        </p>
      )}
      <div className="mt-4">
        <ConfirmButton
          label={add.busy ? "Saving…" : "Record swap"}
          confirmLabel="Tap again to record"
          disabled={!ready || add.busy}
          className={primary}
          onConfirm={save}
        />
      </div>
      <Err error={add.error} />
    </Panel>
  );
}

function TeamsPanel({ admin, refresh }: { admin: AdminData; refresh: Refresh }) {
  return (
    <Panel title="Team names">
      <ul className="grid gap-3 sm:grid-cols-2">
        {admin.teams.map((t) => (
          <TeamRow
            key={`${t.slot}:${t.name}`}
            seasonId={admin.season.id}
            team={t}
            refresh={refresh}
          />
        ))}
      </ul>
    </Panel>
  );
}

function TeamRow({
  seasonId,
  team,
  refresh,
}: {
  seasonId: string;
  team: { slot: number; name: string };
  refresh: Refresh;
}) {
  const [name, setName] = useState(team.name);
  const { busy, error, run } = useAction();
  const changed = name.trim() !== team.name && name.trim().length > 0;
  return (
    <li>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await renameTeam({ data: { seasonId, slot: team.slot, name: name.trim() } });
            await refresh();
          });
        }}
      >
        <label className="sr-only" htmlFor={`team-${team.slot}`}>
          Name for draft slot {team.slot}
        </label>
        <input
          id={`team-${team.slot}`}
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          className={`${field} min-w-0 flex-1`}
        />
        <button type="submit" disabled={!changed || busy} className={quiet}>
          {busy ? "Saving…" : "Save"}
        </button>
      </form>
      <Err error={error} />
    </li>
  );
}

function SeasonPanel({ admin, refresh }: { admin: AdminData; refresh: Refresh }) {
  const [date, setDate] = useState(admin.season.countFrom);
  const { busy, error, run } = useAction();
  const changed = date !== admin.season.countFrom && /^\d{4}-\d{2}-\d{2}$/.test(date);
  return (
    <Panel title="Season">
      <p className="mb-4 text-muted-foreground">
        Points count from this date. Changing it rebuilds every total.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block font-semibold">Count points from</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={field}
          />
        </label>
        <ConfirmButton
          label={busy ? "Saving…" : "Save"}
          confirmLabel="Tap again to rebuild"
          disabled={!changed || busy}
          onConfirm={() =>
            run(async () => {
              await setCountFrom({ data: { seasonId: admin.season.id, date } });
              await refresh();
            })
          }
        />
      </div>
      <Err error={error} />
      <p className="mt-6 text-muted-foreground">
        Public pages:{" "}
        <Link to="/" className="underline">
          Standings
        </Link>{" "}
        ·{" "}
        <Link to="/rules" className="underline">
          Swaps & Rules
        </Link>
      </p>
    </Panel>
  );
}
