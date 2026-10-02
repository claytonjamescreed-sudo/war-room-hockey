// Getting a page that has been open across a publish back onto the newest version.
//
// Lovable's hosting pins each browser to the version it loaded (the "__dpl" cookie), so an open
// page keeps talking to its own version. When that version's files can't be served any more, the
// page fails as soon as it needs a piece it hasn't loaded yet (another page's code, usually). The
// cure is the same as "Update now": drop the pin and load the page again from the newest version.
const PIN = "__dpl";
const LAST = "fresh-start-at";
const TRIED = "fresh-start-for";

// A browser saying it couldn't load part of the site's code (each has its own words for it)
export const isStaleChunk = (error: unknown) =>
  /dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(
    error instanceof Error ? error.message : String(error),
  );

export function freshStart() {
  // The pin is set for this host alone; the other two are in case a browser kept it for the
  // domain instead. Clearing one that isn't there does nothing.
  const host = window.location.hostname;
  for (const domain of host ? [`; domain=${host}`, `; domain=.${host}`, ""] : [""])
    document.cookie = `${PIN}=; Max-Age=0; path=/${domain}; secure; samesite=lax`;
  window.location.reload();
}

// Pages where a reload nobody asked for could interrupt something: the commissioner's pages (a
// form half filled in, a draft in progress) and the TV board
export const leaveOpen = (pathname: string) => /^\/(admin|draft|tv)(\/|$)/.test(pathname);

// Updating without being asked, when someone opens the site or comes back to it: once for each
// new build. If the page is still on the old build after that, the reload didn't get it there,
// so it's left to the "Update now" button rather than reloading again and again. False when it
// didn't reload.
export function freshStartFor(build: string, pathname: string): boolean {
  if (leaveOpen(pathname)) return false;
  try {
    if (sessionStorage.getItem(TRIED) === build) return false;
    sessionStorage.setItem(TRIED, build);
  } catch {
    return false;
  }
  freshStart();
  return true;
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
