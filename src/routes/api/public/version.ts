import { createFileRoute } from "@tanstack/react-router";

import { CURRENT } from "@/lib/release";

// The build the server is running, for open pages to compare with their own, and its release
export const Route = createFileRoute("/api/public/version")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          { build: __APP_BUILD__, version: CURRENT.version },
          { headers: { "cache-control": "no-store" } },
        ),
    },
  },
});
