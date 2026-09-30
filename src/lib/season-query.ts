import { queryOptions } from "@tanstack/react-query";
import type { ArchivedRoster } from "./archive";
import { getLive, getRosterArchive, getSeason } from "./season.functions";

export const seasonQuery = queryOptions({
  queryKey: ["season"],
  queryFn: () => getSeason(),
  staleTime: 60_000,
  refetchInterval: 5 * 60_000,
});

export const fmtDate = (
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) =>
  iso
    ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-CA", { ...opts, timeZone: "UTC" })
    : "—";

// Every minute while a game is on (or about to start), every 10 minutes otherwise
export const liveQuery = queryOptions({
  queryKey: ["live"],
  queryFn: () => getLive(),
  staleTime: 20_000,
  refetchInterval: (q) => (q.state.data?.anyLive ? 60_000 : 10 * 60_000),
  refetchIntervalInBackground: false,
});

// Past seasons' rosters change once a season, when the next one starts
export const archiveQuery = queryOptions({
  queryKey: ["roster-archive"],
  queryFn: async () => JSON.parse(await getRosterArchive()) as ArchivedRoster[],
  staleTime: 60 * 60_000,
});
