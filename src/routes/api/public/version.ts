import { createFileRoute } from "@tanstack/react-router";

// The build the server is running, for open pages to compare with their own
export const Route = createFileRoute("/api/public/version")({
  server: {
    handlers: {
      GET: () =>
        Response.json({ build: __APP_BUILD__ }, { headers: { "cache-control": "no-store" } }),
    },
  },
});
