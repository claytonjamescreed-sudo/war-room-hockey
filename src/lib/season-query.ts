import { queryOptions } from "@tanstack/react-query";
import { getLive, getSeason } from "./season.functions";

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
