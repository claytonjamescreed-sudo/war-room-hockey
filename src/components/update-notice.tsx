// When a newer version of the site has been published, an open page gets itself onto it. Someone
// opening the site, coming back to it (switching tabs or apps, or the back button) or moving to
// another page is updated there and then, without being asked: once for each new version. A page
// that has been in view the whole time shows an "Update now" button instead, so it doesn't reload
// under someone reading it; so do the commissioner's pages. Pages check at those moments and
// every couple of minutes, at most once every 10 seconds.
//
// The button is a bar across the top on phones, where it can't sit under the browser's own
// buttons at the bottom of the screen, and a pill in the bottom-right corner on wider screens.
//
// Lovable's hosting pins a browser to the version it loaded with a "__dpl" cookie, so requests
// from an open page keep going to that version's server (and so does reloading it, for a day).
// The check leaves the cookie out to ask the newest version, and updating clears it so the reload
// lands on the newest version.
import { useRouterState } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { freshStart, freshStartFor, freshStartOnce } from "@/lib/fresh";
import { CURRENT } from "@/lib/release";

const EVERY = 2 * 60_000;
const MIN_GAP = 10_000;

export function UpdateNotice() {
  const [ready, setReady] = useState(false);
  // The new build's release, when it's a different version from this page's
  const [next, setNext] = useState<string | null>(null);
  const lastCheck = useRef(0);
  const href = useRouterState({ select: (s) => s.location.href });

  // `returning`: the site was just opened, come back to, or moved around in
  const check = useCallback(
    async (returning: boolean) => {
      if (document.hidden || Date.now() - lastCheck.current < MIN_GAP) return;
      if (ready && !returning) return;
      lastCheck.current = Date.now();
      try {
        const res = await fetch("/api/public/version", { cache: "no-store", credentials: "omit" });
        if (!res.ok) return;
        const { build, version } = (await res.json()) as { build?: string; version?: string };
        if (build && build !== __APP_BUILD__) {
          if (returning && freshStartFor(build, window.location.pathname)) return;
          if (version && version !== CURRENT.version) setNext(version);
          setReady(true);
        }
      } catch {
        // offline or mid-deploy: try again next time
      }
    },
    [ready],
  );

  useEffect(() => {
    const onReturn = () => void check(true);
    const timer = setInterval(() => void check(false), EVERY);
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    window.addEventListener("pageshow", onReturn);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("pageshow", onReturn);
    };
  }, [check]);

  // A piece of the site that wouldn't load (this page's version is gone): start again on the
  // newest version rather than leave an error on the screen
  useEffect(() => {
    const onPreloadError = (e: Event) => {
      if (freshStartOnce()) e.preventDefault();
    };
    window.addEventListener("vite:preloadError", onPreloadError);
    return () => window.removeEventListener("vite:preloadError", onPreloadError);
  }, []);

  // On opening, and on every move to another page
  useEffect(() => {
    void check(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the page changes
  }, [href]);

  if (!ready) return null;
  return (
    <button
      onClick={freshStart}
      className="sticky top-0 z-50 flex w-full items-center justify-center gap-3 bg-red px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-left text-white shadow-lg hover:brightness-110 md:fixed md:bottom-4 md:left-auto md:right-4 md:top-auto md:w-auto md:rounded-full md:py-3 md:pl-4 md:pr-5 md:ring-2 md:ring-gold"
    >
      <RefreshCw className="h-6 w-6 shrink-0" aria-hidden />
      <span className="leading-tight">
        <span className="block text-lg font-bold uppercase tracking-wide">Update now</span>
        <span className="block text-sm opacity-90">
          {next ? `Version ${next} is ready` : "A new version of the site is ready"}
        </span>
      </span>
    </button>
  );
}
