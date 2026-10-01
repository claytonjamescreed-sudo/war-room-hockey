// ESPN's public NHL injury report: one call for the whole league, kept for 20 minutes. Only the
// few fields the site shows are kept (the report is over a megabyte of comments and photos).
import type { ReportLine } from "./injuries";

const URL = "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/injuries";
const TTL = 20 * 60_000;
let memo: { at: number; lines: ReportLine[] } | null = null;

// The parts of ESPN's answer the site reads
type EspnInjury = {
  status?: string;
  shortComment?: string;
  details?: { type?: string; returnDate?: string };
  athlete?: {
    displayName?: string;
    firstName?: string;
    lastName?: string;
    team?: { abbreviation?: string };
    position?: { abbreviation?: string };
  };
};
type EspnReport = { injuries?: { injuries?: EspnInjury[] }[] };

export async function fetchInjuryReport(): Promise<ReportLine[]> {
  if (memo && Date.now() - memo.at < TTL) return memo.lines;
  try {
    const res = await fetch(URL, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const report = (await res.json()) as EspnReport;
    const lines = (report.injuries ?? []).flatMap((team) =>
      (team.injuries ?? []).map((i): ReportLine => ({
        name: i.athlete?.displayName ?? "",
        first: i.athlete?.firstName ?? "",
        last: i.athlete?.lastName ?? "",
        team: i.athlete?.team?.abbreviation ?? null,
        pos: i.athlete?.position?.abbreviation ?? null,
        status: i.status ?? "",
        detail: i.details?.type ?? null,
        returnDate: i.details?.returnDate?.slice(0, 10) ?? null,
        note: i.shortComment ?? null,
      })),
    );
    memo = { at: Date.now(), lines: lines.filter((l) => l.name && l.status) };
    return memo.lines;
  } catch (err) {
    console.error("injury report failed", err);
    // The last report is better than none; with none, nobody shows as hurt
    return memo?.lines ?? [];
  }
}
