import playersFile from "@/data/seed/players.json";
import contractsFile from "@/data/seed/contracts.json";
import poolTeamsFile from "@/data/seed/pool-teams.json";

export async function seedModelData() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;
  const players = (playersFile as any).players as any[];
  const safe = players.map((p) => {
    const last = (p.hist || []).find((h: any[]) => h[0] === 20252026);
    return {
      nhl_id: p.id,
      name: p.name,
      team: p.team,
      pos: p.pos,
      last_gp: last ? last[2] : null,
      last_g: last ? last[3] : null,
      last_a: last ? last[4] : null,
      last_pts: last ? last[5] : null,
    };
  });
  const model = players.map((p) => ({ nhl_id: p.id, data: p }));
  for (let i = 0; i < safe.length; i += 200) {
    const a = await sb.from("players").upsert(safe.slice(i, i + 200));
    if (a.error) throw a.error;
    const b = await sb.from("player_model").upsert(model.slice(i, i + 200));
    if (b.error) throw b.error;
  }
  const { players: _omit, ...meta } = playersFile as any;
  const m = await sb.from("model_meta").upsert([
    { key: "players_meta", data: meta },
    { key: "contracts", data: contractsFile },
    { key: "pool_teams", data: poolTeamsFile },
    // players.json order: the draft engine breaks ties by it
    { key: "player_order", data: players.map((p) => p.id) },
  ]);
  if (m.error) throw m.error;
  return { ok: true, players: players.length };
}
