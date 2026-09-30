// When a newer version of the site has been published, an "Update now" button appears in the
// bottom-right corner; tapping it reloads the page onto the new version. Open pages check when
// they come back into view and every few minutes.
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

const EVERY = 5 * 60_000;

export function UpdateNotice() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready) return;
    const check = async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/public/version", { cache: "no-store" });
        if (!res.ok) return;
        const { build } = (await res.json()) as { build?: string };
        if (build && build !== __APP_BUILD__) setReady(true);
      } catch {
        // offline or mid-deploy: try again next time
      }
    };
    const onShow = () => {
      if (!document.hidden) check();
    };
    const timer = setInterval(check, EVERY);
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, [ready]);
  if (!ready) return null;
  return (
    <button
      onClick={() => window.location.reload()}
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
