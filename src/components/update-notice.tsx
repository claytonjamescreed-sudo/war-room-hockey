// When a newer version of the site has been published, an "Update now" button appears in the
// bottom-right corner; tapping it reloads the page onto the new version. Open pages check when
// they open, when they come back into view (switching tabs or apps, or the back button), as
// people move around the site, and every couple of minutes, at most once a minute.
//
// Lovable's hosting pins a browser to the version it loaded with a "__dpl" cookie, so requests
// from an open page keep going to that version's server. The check leaves the cookie out to ask
// the newest version, and the button clears it so the reload lands on the newest version.
import { useRouterState } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

const EVERY = 2 * 60_000;
const MIN_GAP = 60_000;
const PIN = "__dpl";

function update() {
  document.cookie = `${PIN}=; Max-Age=0; path=/; secure; samesite=lax`;
  window.location.reload();
}

export function UpdateNotice() {
  const [ready, setReady] = useState(false);
  const lastCheck = useRef(0);
  const href = useRouterState({ select: (s) => s.location.href });

  const check = useCallback(async () => {
    if (document.hidden || Date.now() - lastCheck.current < MIN_GAP) return;
    lastCheck.current = Date.now();
    try {
      const res = await fetch("/api/public/version", { cache: "no-store", credentials: "omit" });
      if (!res.ok) return;
      const { build } = (await res.json()) as { build?: string };
      if (build && build !== __APP_BUILD__) setReady(true);
    } catch {
      // offline or mid-deploy: try again next time
    }
  }, []);

  useEffect(() => {
    if (ready) return;
    const onShow = () => void check();
    const timer = setInterval(onShow, EVERY);
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    window.addEventListener("pageshow", onShow);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
      window.removeEventListener("pageshow", onShow);
    };
  }, [ready, check]);

  // On opening, and on every move to another page
  useEffect(() => {
    if (!ready) void check();
  }, [href, ready, check]);

  if (!ready) return null;
  return (
    <button
      onClick={update}
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-50 flex items-center gap-3 rounded-full bg-red py-3 pl-4 pr-5 text-left text-white shadow-lg ring-2 ring-gold hover:brightness-110"
    >
      <RefreshCw className="h-6 w-6 shrink-0" aria-hidden />
      <span className="leading-tight">
        <span className="block text-lg font-bold uppercase tracking-wide">Update now</span>
        <span className="block text-sm opacity-90">A new version of the site is ready</span>
      </span>
    </button>
  );
}
