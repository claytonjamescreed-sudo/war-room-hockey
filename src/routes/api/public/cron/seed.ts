import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// One-time, idempotent import of players.json, contracts.json and pool-teams.json.
export const Route = createFileRoute("/api/public/cron/seed")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { seedModelData } = await import("@/lib/seed.server");
        return Response.json(await seedModelData());
      },
    },
  },
});
