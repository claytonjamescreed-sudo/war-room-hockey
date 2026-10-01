// Getting a page that has been open across a publish back onto the newest version.
//
// Lovable's hosting pins each browser to the version it loaded (the "__dpl" cookie), so an open
// page keeps talking to its own version. When that version's files can't be served any more, the
// page fails as soon as it needs a piece it hasn't loaded yet (another page's code, usually). The
// cure is the same as "Update now": drop the pin and load the page again from the newest version.
const PIN = "__dpl";
const LAST = "fresh-start-at";

// A browser saying it couldn't load part of the site's code (each has its own words for it)
export const isStaleChunk = (error: unknown) =>
  /dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(
    error instanceof Error ? error.message : String(error),
  );

export function freshStart() {
  document.cookie = `${PIN}=; Max-Age=0; path=/; secure; samesite=lax`;
  window.location.reload();
}

// The automatic version: at most once a minute, so a page that is really broken shows its error
// instead of reloading for ever. False when it didn't reload.
export function freshStartOnce(now = Date.now()): boolean {
  try {
    if (now - Number(sessionStorage.getItem(LAST) ?? 0) < 60_000) return false;
    sessionStorage.setItem(LAST, String(now));
  } catch {
    // No storage to remember the last one in: leave it to the "Try again" button
    return false;
  }
  freshStart();
  return true;
}

// Is the published site a newer build than this page? Asked without the pin, so the answer comes
// from the newest version.
export async function newerBuildIsOut(): Promise<boolean> {
  try {
    const res = await fetch("/api/public/version", { cache: "no-store", credentials: "omit" });
    if (!res.ok) return false;
    const { build } = (await res.json()) as { build?: string };
    return !!build && build !== __APP_BUILD__;
  } catch {
    return false;
  }
}
