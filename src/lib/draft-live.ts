// The live draft in the browser: the current draft and its picks (public), pushed to every open
// screen within a second or two through Supabase realtime. Writes need the commissioner's
// session; RLS rejects anyone else.
import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BoardPick = { id: number | null; label: string | null };
export type LiveDraft = {
  id: string;
  teams: number;
  rounds: number;
  teamNames: Record<number, string>;
  orderLockedAt: string | null;
  picks: BoardPick[];
};

const NOT_SAVED = "That didn't save. Check you're still signed in as the commissioner.";
const fail = (e: { message: string; code?: string } | null) => {
  if (e) throw new Error(e.code === "42501" ? NOT_SAVED : e.message);
};
// RLS turns a write by someone who isn't the commissioner into a no-op, not an error
const changed = (rows: unknown[] | null) => {
  if (!rows?.length) throw new Error(NOT_SAVED);
};

async function loadDraft(): Promise<LiveDraft | null> {
  const { data: d, error } = await supabase
    .from("drafts")
    .select("*")
    .eq("is_current", true)
    .maybeSingle();
  fail(error);
  if (!d) return null;
  const rows = await supabase
    .from("draft_board")
    .select("pick_no,nhl_id,label")
    .eq("draft_id", d.id)
    .order("pick_no");
  fail(rows.error);
  const names: Record<number, string> = {};
  for (const [k, v] of Object.entries((d.team_names ?? {}) as Record<string, unknown>))
    if (typeof v === "string" && v.trim()) names[Number(k)] = v;
  return {
    id: d.id,
    teams: d.teams,
    rounds: d.rounds,
    teamNames: names,
    orderLockedAt: d.order_locked_at,
    picks: (rows.data ?? []).map((r) => ({ id: r.nhl_id, label: r.label })),
  };
}

export const draftQuery = queryOptions({
  queryKey: ["draft"],
  queryFn: loadDraft,
  staleTime: 2_000,
  // A fallback in case the realtime connection drops
  refetchInterval: 15_000,
});

// Refetch the draft whenever a pick or the order changes on any device
export function useDraftRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const refetch = () => qc.invalidateQueries({ queryKey: ["draft"] });
    const channel = supabase
      .channel("draft-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "draft_board" }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "drafts" }, refetch)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

const row = (draftId: string, n: number, p: BoardPick) => ({
  draft_id: draftId,
  pick_no: n + 1,
  nhl_id: p.id,
  label: p.id == null ? p.label || "Player not on list" : null,
});

// n is the 0-based pick index, as in the engine
export async function addPick(draftId: string, n: number, p: BoardPick) {
  const { error } = await supabase.from("draft_board").insert(row(draftId, n, p));
  // Unique violations: the player (draft_board_player) or the pick number (pkey) is taken
  if (error?.code === "23505")
    throw new Error(
      error.message.includes("draft_board_player")
        ? "He's already been drafted."
        : "That pick was just made on another screen.",
    );
  fail(error);
}

export async function removePick(draftId: string, n: number) {
  const { data, error } = await supabase
    .from("draft_board")
    .delete()
    .eq("draft_id", draftId)
    .eq("pick_no", n + 1)
    .select("pick_no");
  fail(error);
  changed(data);
}

export async function replacePick(draftId: string, n: number, p: BoardPick) {
  const { draft_id: _d, pick_no: _n, ...change } = row(draftId, n, p);
  const { data, error } = await supabase
    .from("draft_board")
    .update(change)
    .eq("draft_id", draftId)
    .eq("pick_no", n + 1)
    .select("pick_no");
  if (error?.code === "23505") throw new Error("He's already been drafted.");
  fail(error);
  changed(data);
}

export async function clearPicks(draftId: string) {
  const { error } = await supabase.from("draft_board").delete().eq("draft_id", draftId);
  fail(error);
}

export async function saveDraftSetup(
  draftId: string,
  change: {
    teams?: number;
    rounds?: number;
    teamNames?: Record<number, string>;
    locked?: boolean;
  },
) {
  const { data, error } = await supabase
    .from("drafts")
    .update({
      ...(change.teams != null && { teams: change.teams }),
      ...(change.rounds != null && { rounds: change.rounds }),
      ...(change.teamNames && { team_names: change.teamNames }),
      ...(change.locked != null && {
        order_locked_at: change.locked ? new Date().toISOString() : null,
      }),
    })
    .eq("id", draftId)
    .select("id");
  fail(error);
  changed(data);
}

export async function startDraft(id: string) {
  const { error } = await supabase.rpc("start_draft", { _id: id });
  fail(error);
}

// Pick, undo and fix with the screen updated at once; the realtime refetch (or the one after an
// error) brings back what the database holds. Errors are rethrown for the caller to show.
export function useDraftWriter() {
  const qc = useQueryClient();
  const optimistic = async (change: (d: LiveDraft) => LiveDraft, write: () => Promise<void>) => {
    await qc.cancelQueries({ queryKey: ["draft"] });
    qc.setQueryData<LiveDraft | null>(["draft"], (d) => (d ? change(d) : d));
    try {
      await write();
    } finally {
      await qc.invalidateQueries({ queryKey: ["draft"] });
    }
  };
  return {
    pick: (d: LiveDraft, p: BoardPick) =>
      optimistic(
        (x) => ({ ...x, picks: [...x.picks, p] }),
        () => addPick(d.id, d.picks.length, p),
      ),
    undo: (d: LiveDraft) =>
      optimistic(
        (x) => ({ ...x, picks: x.picks.slice(0, -1) }),
        () => removePick(d.id, d.picks.length - 1),
      ),
    replace: (d: LiveDraft, n: number, p: BoardPick) =>
      optimistic(
        (x) => ({ ...x, picks: x.picks.map((q, i) => (i === n ? p : q)) }),
        () => replacePick(d.id, n, p),
      ),
  };
}

// A slot's team name, or "Team N" until it's set
export const slotName = (d: LiveDraft, slot: number) => d.teamNames[slot] || `Team ${slot}`;
