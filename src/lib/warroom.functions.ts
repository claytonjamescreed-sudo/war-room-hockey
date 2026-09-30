// The War Room's private data: every player's full model record (projections, ADP, injuries,
// linemates), plus contracts and last season's pool teams. Commissioner only.
import { createServerFn } from "@tanstack/react-start";
import { requireCommissioner } from "./commissioner";

export const warRoomData = createServerFn({ method: "GET" })
  .middleware([requireCommissioner])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [meta, rows] = await Promise.all([
      sb.from("model_meta").select("key,data"),
      sb.from("player_model").select("nhl_id,data").range(0, 4999),
    ]);
    if (meta.error) throw new Error(meta.error.message);
    if (rows.error) throw new Error(rows.error.message);
    const byKey = new Map(meta.data.map((m) => [m.key, m.data]));
    // Keep players.json's order: the engine breaks ties by it
    const order = (byKey.get("player_order") as number[] | undefined) ?? [];
    const rank = new Map(order.map((id, i) => [id, i]));
    const players = rows.data
      .sort(
        (a, b) =>
          (rank.get(a.nhl_id) ?? order.length) - (rank.get(b.nhl_id) ?? order.length) ||
          a.nhl_id - b.nhl_id,
      )
      .map((r) => r.data);
    return JSON.stringify({
      data: { ...(byKey.get("players_meta") as object), players },
      contracts: byKey.get("contracts") ?? { contracts: [] },
      poolTeams: byKey.get("pool_teams") ?? { teams: [] },
    });
  });

// Last season's team names only (not their drafting habits), for the draft order on the TV board
export const poolTeamNames = createServerFn({ method: "GET" })
  .middleware([requireCommissioner])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("model_meta")
      .select("data")
      .eq("key", "pool_teams")
      .maybeSingle();
    if (error) throw new Error(error.message);
    const teams = (data?.data as { teams?: { name: string }[] } | null)?.teams ?? [];
    return teams.map((t) => t.name);
  });
