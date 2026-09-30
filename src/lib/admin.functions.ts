// Commissioner tools. Every function except prepareCommissionerLogin requires a signed-in user
// with the admin role; league writes go through that user's RLS-bound client, and the synced
// stats tables (service-role only) are written after the role check.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireCommissioner } from "./commissioner";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2027-02-05");

// Before sending a sign-in link: only the commissioner's email gets an account. Sign-ups are
// otherwise closed, so the account is created here with the service role.
export const prepareCommissionerLogin = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string }) => z.object({ email: z.string().trim().email() }).parse(d))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const { adminClient } = await import("./sync.server");
    const sb = await adminClient();
    const { data: row } = await sb
      .from("admin_emails")
      .select("email")
      .ilike("email", email)
      .maybeSingle();
    if (!row) return { ok: false as const };
    const created = await sb.auth.admin.createUser({ email, email_confirm: true });
    if (created.error && !/already|registered|exists/i.test(created.error.message))
      throw new Error(created.error.message);
    return { ok: true as const };
  });

export const whoami = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { email: (context.claims as { email?: string }).email ?? null, isAdmin: !!data };
  });

// Everything the admin page edits, with ids
export const adminState = createServerFn({ method: "GET" })
  .middleware([requireCommissioner])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: season, error } = await sb
      .from("seasons")
      .select("*")
      .eq("is_current", true)
      .single();
    if (error || !season) throw new Error("No current season");
    const [teams, moves] = await Promise.all([
      sb.from("pool_teams").select("slot,name").eq("season_id", season.id).order("slot"),
      sb
        .from("roster_moves")
        .select("*")
        .eq("season_id", season.id)
        .order("move_date")
        .order("created_at"),
    ]);
    return {
      season: {
        id: season.id,
        countFrom: season.count_from,
        swapsPerTeam: season.swaps_per_team,
        lastSyncedAt: season.last_synced_at,
      },
      teams: teams.data ?? [],
      moves: (moves.data ?? []).map((m) => ({
        id: m.id,
        date: m.move_date,
        slot: m.slot,
        outId: m.out_id,
        inId: m.in_id,
        inName: m.in_name,
      })),
    };
  });

// Find any NHL skater for a swap
export const searchNhlPlayers = createServerFn({ method: "GET" })
  .middleware([requireCommissioner])
  .inputValidator((d: { q: string }) => z.object({ q: z.string().trim().min(2).max(40) }).parse(d))
  .handler(async ({ data }) => {
    const { nhlJSON } = await import("./nhl.server");
    const url = `https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=20&active=true&q=${encodeURIComponent(data.q)}`;
    type Hit = {
      playerId: string | number;
      name: string;
      positionCode?: string;
      teamAbbrev?: string | null;
      lastTeamAbbrev?: string | null;
    };
    const rows = (await nhlJSON<Hit[]>(url, 60_000).catch(() => null)) ?? [];
    return rows
      .filter((r) => r.positionCode !== "G")
      .map((r) => ({
        id: Number(r.playerId),
        name: String(r.name),
        team: (r.teamAbbrev ?? r.lastTeamAbbrev ?? null) as string | null,
        pos: String(r.positionCode ?? ""),
      }));
  });

async function afterLeagueChange(syncIds: number[] = []) {
  const { adminClient, syncGameLogs, rebuildDailyTotals } = await import("./sync.server");
  const { bustCaches } = await import("./league.server");
  const sb = await adminClient();
  if (syncIds.length) await syncGameLogs(sb, syncIds);
  const result = await rebuildDailyTotals(sb);
  bustCaches();
  return result;
}

export const recordSwap = createServerFn({ method: "POST" })
  .middleware([requireCommissioner])
  .inputValidator(
    (d: { date: string; slot: number; outId: number; inId: number; inName: string }) =>
      z
        .object({
          date: isoDate,
          slot: z.number().int().positive(),
          outId: z.number().int().positive(),
          inId: z.number().int().positive(),
          inName: z.string().trim().min(1).max(80),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { loadLeague } = await import("./league.server");
    const { rosterOn } = await import("./live");
    const sb = context.supabase;
    const { season, draft, setup } = await loadLeague(sb as never);
    const used = setup.moves.filter((m) => m.slot === data.slot).length;
    if (used >= season.swaps_per_team)
      throw new Error(`That team has already used its ${season.swaps_per_team} swaps.`);
    const roster = rosterOn(draft, setup, data.date);
    if (!roster.get(data.slot)?.includes(data.outId))
      throw new Error("That player isn't on this team on that date.");
    for (const [slot, ids] of roster)
      if (ids.includes(data.inId))
        throw new Error(
          `${data.inName} is already on ${draft.teams.find((t) => t.slot === slot)?.name}.`,
        );
    const { error } = await sb.from("roster_moves").insert({
      season_id: season.id,
      move_date: data.date,
      slot: data.slot,
      out_id: data.outId,
      in_id: data.inId,
      in_name: data.inName,
    });
    if (error) throw new Error(error.message);
    return afterLeagueChange([data.inId]);
  });

export const undoSwap = createServerFn({ method: "POST" })
  .middleware([requireCommissioner])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("roster_moves").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return afterLeagueChange();
  });

export const renameTeam = createServerFn({ method: "POST" })
  .middleware([requireCommissioner])
  .inputValidator((d: { seasonId: string; slot: number; name: string }) =>
    z
      .object({
        seasonId: z.string().min(1),
        slot: z.number().int().positive(),
        name: z.string().trim().min(1).max(40),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("pool_teams")
      .update({ name: data.name })
      .eq("season_id", data.seasonId)
      .eq("slot", data.slot);
    if (error) throw new Error(error.message);
    const { bustCaches } = await import("./league.server");
    bustCaches();
    return { ok: true };
  });

export const setCountFrom = createServerFn({ method: "POST" })
  .middleware([requireCommissioner])
  .inputValidator((d: { seasonId: string; date: string }) =>
    z.object({ seasonId: z.string().min(1), date: isoDate }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("seasons")
      .update({ count_from: data.date })
      .eq("id", data.seasonId);
    if (error) throw new Error(error.message);
    return afterLeagueChange();
  });

// "Sync now": the caller walks through the players in batches, then rebuilds the totals
export const syncBatch = createServerFn({ method: "POST" })
  .middleware([requireCommissioner])
  .inputValidator((d: { offset: number; limit: number }) =>
    z.object({ offset: z.number().int().min(0), limit: z.number().int().min(1).max(60) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { adminClient, syncGameLogs } = await import("./sync.server");
    const { loadLeague } = await import("./league.server");
    const sb = await adminClient();
    const { ids } = await loadLeague(sb);
    const synced = await syncGameLogs(sb, ids.slice(data.offset, data.offset + data.limit));
    return { synced, total: ids.length, done: data.offset + data.limit >= ids.length };
  });

export const rebuildTotals = createServerFn({ method: "POST" })
  .middleware([requireCommissioner])
  .handler(async () => afterLeagueChange());
