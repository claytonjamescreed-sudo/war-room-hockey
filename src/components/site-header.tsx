import { Link, useRouterState } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { InstallButton } from "./install-button";

const nav = [
  { to: "/", label: "Standings" },
  { to: "/race", label: "Race" },
  { to: "/leaders", label: "Leaders" },
  { to: "/rules", label: "Swaps & Rules" },
] as const;

const item =
  "shrink-0 whitespace-nowrap rounded px-3 py-2 text-sm font-semibold uppercase tracking-wider text-band-foreground/75 hover:text-band-foreground xl:text-base";
const active = "!text-band-foreground underline decoration-2 underline-offset-8";

export function SiteHeader() {
  const [dark, setDark] = useState(false);
  // History and Team Lockers are two views of one page
  const history = useRouterState({
    select: (st) =>
      st.location.pathname === "/history"
        ? (st.location.search as { view?: string }).view === "teams"
          ? "lockers"
          : "history"
        : null,
  });
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  // On a phone the menu is one row that scrolls sideways: keep the current page's link in view
  const navRef = useRef<HTMLElement>(null);
  const href = useRouterState({ select: (st) => st.location.href });
  useEffect(() => {
    // Only the menu slides sideways; the page keeps its own scroll (e.g. coming back to a list)
    const nav = navRef.current;
    const link = nav?.querySelector('[aria-current="page"]');
    if (!nav || !link) return;
    const n = nav.getBoundingClientRect();
    const l = link.getBoundingClientRect();
    if (l.left < n.left) nav.scrollLeft += l.left - n.left - 8;
    else if (l.right > n.right) nav.scrollLeft += l.right - n.right + 8;
  }, [href]);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // storage blocked: the theme just won't be remembered
    }
  };
  return (
    <header className="bg-band text-band-foreground">
      {/* Wide screens: one line. Narrower: the logo and buttons, then the menu as a row that
          scrolls sideways */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 px-4 pt-2 xl:flex-nowrap xl:gap-x-6 xl:py-3">
        <Link
          to="/"
          className="py-1 font-display text-3xl font-extrabold uppercase leading-none tracking-wide xl:py-0 xl:text-4xl"
        >
          War Room
        </Link>
        <nav
          ref={navRef}
          aria-label="Main"
          className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-2 pb-1 [scrollbar-width:none] xl:order-none xl:mx-0 xl:w-auto xl:flex-1 xl:overflow-visible xl:px-0 xl:pb-0 [&::-webkit-scrollbar]:hidden"
        >
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className={item}
              activeProps={{ className: active }}
            >
              {n.label}
            </Link>
          ))}
          <Link
            to="/history"
            className={`${item} ${history === "history" ? active : ""}`}
            activeOptions={{ exact: true, includeSearch: true }}
            aria-current={history === "history" ? "page" : undefined}
          >
            History
          </Link>
          <Link
            to="/history"
            search={{ view: "teams" }}
            className={`${item} ${history === "lockers" ? active : ""}`}
            activeOptions={{ exact: true, includeSearch: true }}
            aria-current={history === "lockers" ? "page" : undefined}
          >
            Team Lockers
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <InstallButton />
          <button
            onClick={toggle}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            className="rounded p-2 text-band-foreground hover:bg-band-foreground/10 xl:p-3"
          >
            {dark ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
          </button>
        </div>
      </div>
      <div className="h-1.5 bg-red" />
      <div className="h-1.5 bg-gold" />
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto flex max-w-6xl gap-4 px-4 pb-8 pt-4 text-sm text-muted-foreground">
      <Link to="/tv" className="hover:underline">
        TV board
      </Link>
      <Link to="/admin" className="hover:underline">
        Commissioner
      </Link>
      {/* Which published version this page is running, to compare after "Update now" */}
      <span className="num ml-auto">Version {__APP_BUILD__}</span>
    </footer>
  );
}
