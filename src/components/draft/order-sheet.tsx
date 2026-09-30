// The draft order: who picks in each slot. Randomize, then lock it in so it can't change;
// unlocking takes two taps. Saved to the draft, so the TV board and every device see it.
// Mount it only while open: it starts from what's saved each time.
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmButton, Err } from "@/components/commissioner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { field, primary, quiet, useAction } from "@/hooks/use-commissioner";
import { saveDraftSetup, slotName, type LiveDraft } from "@/lib/draft-live";
import { ordinal, randomizeOrder } from "@/lib/draft-room";

const NEW = "__new";
type Row = { sel: string; text: string };
const rowName = (r: Row) => (r.sel === NEW ? r.text.trim() : r.sel);

function rowsFrom(names: Record<number, string>, count: number, known: Set<string>): Row[] {
  return Array.from({ length: count }, (_, i) => {
    const name = names[i + 1] ?? "";
    return name && !known.has(name) ? { sel: NEW, text: name } : { sel: name, text: "" };
  });
}

function OrderList({ list, myTeam }: { list: string[]; myTeam: string }) {
  return (
    <ol className="my-4 grid gap-1 sm:grid-cols-2">
      {list.map((n, i) => (
        <li key={i} className="flex items-center gap-3 rounded border bg-card px-3 py-2 text-lg">
          <span className="num w-7 text-right text-2xl font-bold">{i + 1}</span>
          <span className={n === myTeam ? "font-bold" : ""}>{n}</span>
        </li>
      ))}
    </ol>
  );
}

export function OrderSheet({
  draft,
  poolTeams,
  myTeam,
  onClose,
}: {
  draft: LiveDraft;
  poolTeams: string[];
  myTeam: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const known = new Set(poolTeams);
  const [count, setCount] = useState(draft.teams);
  const [rows, setRows] = useState<Row[]>(() => rowsFrom(draft.teamNames, draft.teams, known));
  const [note, setNote] = useState("");
  const [warn, setWarn] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [shuffles, setShuffles] = useState(0);
  const { busy, error, run } = useAction();
  const started = draft.picks.length > 0;
  const locked = !!draft.orderLockedAt;

  const resize = (n: number) => {
    const next = Math.max(2, Math.min(30, n || rows.length));
    setCount(next);
    setRows((r) => Array.from({ length: next }, (_, i) => r[i] ?? { sel: "", text: "" }));
  };
  // A team can only be in one slot: choosing it again clears the other one
  const choose = (i: number, sel: string) =>
    setRows((r) =>
      r.map((row, j) =>
        j === i
          ? { sel, text: sel === NEW ? row.text : "" }
          : sel && sel !== NEW && row.sel === sel
            ? { sel: "", text: "" }
            : row,
      ),
    );
  const names = () => {
    const out: Record<number, string> = {};
    rows.forEach((r, i) => {
      const n = rowName(r);
      if (n) out[i + 1] = n;
    });
    return out;
  };
  const refresh = () => qc.invalidateQueries({ queryKey: ["draft"] });

  const fill = () => {
    setRows(Array.from({ length: count }, (_, i) => ({ sel: poolTeams[i] ?? "", text: "" })));
    setNote("");
  };
  const shuffle = () => {
    const r = randomizeOrder(rows.map(rowName), poolTeams);
    if (!r) {
      setNote("Enter the teams first (or fill in last season's), then randomize.");
      return;
    }
    setRows(r.list.map((n) => (n && !known.has(n) ? { sel: NEW, text: n } : { sel: n, text: "" })));
    setShuffles((s) => s + 1);
    const at = new Date().toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
    setNote(
      `Randomized at ${at}${r.filled ? `, with last season's teams in the ${r.filled} empty slot${r.filled > 1 ? "s" : ""}` : ""}. ${r.list[0]} picks first. Lock in this order to keep it, or randomize again.`,
    );
  };
  const save = () =>
    run(async () => {
      await saveDraftSetup(draft.id, {
        ...(!started && { teams: count }),
        teamNames: names(),
      });
      await refresh();
      toast("Draft order saved");
      onClose();
    });
  const askLock = () => {
    const empty = rows.map((r, i) => (rowName(r) ? 0 : i + 1)).filter(Boolean);
    if (empty.length) {
      setWarn(
        empty.length === rows.length
          ? "Enter the teams first (or fill in last season's), then lock it in."
          : `Slot${empty.length > 1 ? "s" : ""} ${empty.join(", ")} ${empty.length > 1 ? "are" : "is"} empty. Give every slot a team before locking it in.`,
      );
      return;
    }
    setWarn("");
    setConfirming(true);
  };
  const lock = () =>
    run(async () => {
      const n = names();
      await saveDraftSetup(draft.id, {
        ...(!started && { teams: count }),
        teamNames: n,
        locked: true,
      });
      await refresh();
      const mine = Object.entries(n).find(([, v]) => myTeam && v === myTeam)?.[0];
      toast(
        `Draft order locked in. ${n[1]} picks first${mine ? `; you pick ${ordinal(Number(mine))} of ${rows.length}` : ""}.`,
      );
      onClose();
    });
  const unlock = () =>
    run(async () => {
      await saveDraftSetup(draft.id, { locked: false });
      await refresh();
      toast("Draft order unlocked");
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        {locked ? (
          <>
            <DialogTitle className="flex items-center gap-3 text-3xl font-extrabold uppercase">
              Draft order
              <span className="rounded bg-gold px-2 py-0.5 text-sm font-bold text-accent-foreground">
                Locked
              </span>
            </DialogTitle>
            <DialogDescription className="text-base">
              Locked in at{" "}
              {new Date(draft.orderLockedAt!).toLocaleString(undefined, {
                weekday: "short",
                hour: "numeric",
                minute: "2-digit",
              })}
              . Nobody can change or re-randomize it until it's unlocked.
            </DialogDescription>
            <OrderList
              list={Array.from({ length: draft.teams }, (_, i) => slotName(draft, i + 1))}
              myTeam={myTeam}
            />
            <div className="flex flex-wrap justify-between gap-2">
              <ConfirmButton
                label="Unlock"
                confirmLabel="Tap again to unlock"
                disabled={busy}
                onConfirm={unlock}
              />
              <button className={primary} onClick={() => onClose()}>
                Close
              </button>
            </div>
            <Err error={error} />
          </>
        ) : confirming ? (
          <>
            <DialogTitle className="text-3xl font-extrabold uppercase">
              Lock in this order?
            </DialogTitle>
            <DialogDescription className="text-base">
              Once it's locked, nobody can change or re-randomize it. <b>{rowName(rows[0]!)}</b>{" "}
              picks first.
            </DialogDescription>
            <OrderList list={rows.map(rowName)} myTeam={myTeam} />
            <div className="flex flex-wrap justify-between gap-2">
              <button className={quiet} onClick={() => setConfirming(false)}>
                Go back
              </button>
              <button className={primary} disabled={busy} onClick={lock} autoFocus>
                {busy ? "Locking…" : "Yes, lock it in"}
              </button>
            </div>
            <Err error={error} />
          </>
        ) : (
          <>
            <DialogTitle className="text-3xl font-extrabold uppercase">Draft order</DialogTitle>
            <DialogDescription className="text-base">
              Who picks in each slot, first to last. Names show on the clock, the draft log, the
              draft board and the TV board. When it's final, lock it in so it can't change.
            </DialogDescription>
            <label className="mt-2 flex items-center gap-3 font-semibold">
              Teams
              <input
                type="number"
                min={2}
                max={30}
                value={count}
                disabled={started}
                onChange={(e) => resize(Number(e.target.value))}
                className={`${field} w-24`}
              />
            </label>
            {started ? (
              <p className="text-muted-foreground">
                The draft has started, so the number of teams is fixed. You can still fix names.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {poolTeams.length > 0 && (
                  <button className={quiet} onClick={fill}>
                    Fill in last season's {poolTeams.length} teams
                  </button>
                )}
                <button className={quiet} onClick={shuffle}>
                  Randomize order
                </button>
              </div>
            )}
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {note ||
                "Randomize puts every team in a random order: the ones entered, plus last season's teams in any empty slots. Lock it in to keep it."}
            </p>
            <div key={shuffles} className="grid gap-2 sm:grid-cols-2">
              {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="num w-7 shrink-0 text-right text-2xl font-bold">{i + 1}</span>
                  <select
                    aria-label={`Slot ${i + 1}`}
                    value={r.sel}
                    onChange={(e) => choose(i, e.target.value)}
                    className={`${field} min-w-0 flex-1`}
                  >
                    <option value="">Not set</option>
                    {poolTeams.map((t) => (
                      <option key={t} value={t}>
                        {t}
                        {t === myTeam ? " (you)" : ""}
                      </option>
                    ))}
                    <option value={NEW}>Someone new…</option>
                  </select>
                  {r.sel === NEW && (
                    <input
                      aria-label={`Slot ${i + 1} team name`}
                      placeholder="Their team name"
                      maxLength={30}
                      value={r.text}
                      autoFocus
                      onChange={(e) =>
                        setRows((all) =>
                          all.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)),
                        )
                      }
                      className={`${field} min-w-0 flex-1`}
                    />
                  )}
                </div>
              ))}
            </div>
            {warn && <p className="font-semibold text-red">{warn}</p>}
            <div className="mt-2 flex flex-wrap justify-between gap-2">
              <button className={quiet} onClick={() => onClose()}>
                Cancel
              </button>
              <span className="flex flex-wrap gap-2">
                <button className={quiet} disabled={busy} onClick={save}>
                  Save for now
                </button>
                <button className={primary} disabled={busy} onClick={askLock}>
                  Lock in this order
                </button>
              </span>
            </div>
            <Err error={error} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
