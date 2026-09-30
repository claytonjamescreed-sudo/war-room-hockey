import { queryOptions } from "@tanstack/react-query";
import { getSeason } from "./season.functions";

export const seasonQuery = queryOptions({
  queryKey: ["season"],
  queryFn: () => getSeason(),
  staleTime: 60_000,
  refetchInterval: 5 * 60_000,
});

export const fmtDate = (iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) =>
  iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-CA", { ...opts, timeZone: "UTC" }) : "—";
