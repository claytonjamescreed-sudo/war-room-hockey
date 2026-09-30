// The version of the site this page is running: the release at the top of the changelog, and the
// build stamp set in vite.config.ts (which also tells an open page when a newer build is out).
import { CHANGELOG } from "../data/changelog";

export const CURRENT = CHANGELOG[0]!;

// "1.2.3" compared as numbers, so 1.10.0 comes after 1.9.0
export function compareVersions(a: string, b: string) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

// The build stamp is the build's time in base 36
export function builtAt(build: string): Date | null {
  const ms = parseInt(build, 36);
  return Number.isFinite(ms) && ms > 0 ? new Date(ms) : null;
}

const PT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
});
export const fmtBuilt = (d: Date) => `${PT.format(d)} PT`;
