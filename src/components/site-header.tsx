import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import { builtAt, CURRENT, fmtBuilt } from "@/lib/release";
import { InstallButton } from "./install-button";
import { Logo } from "./logo";

type Section = "standings" | "race" | "leaders" | "rules" | "history" | "lockers";

const item =
  "whitespace-nowrap rounded px-3 py-2 text-sm font-semibold uppercase tracking-wider text-band-foreground/75 hover:text-band-foreground xl:text-base";
const active = "!text-band-foreground underline decoration-2 underline-offset-8";
const row = (on: boolean) =>
  `block rounded px-4 py-3 text-lg font-semibold uppercase tracking-wider ${on ? "bg-band-foreground/10 text-band-foreground" : "text-band-foreground/80 hover:bg-band-foreground/10"}`;

// The six pages, marked when current. TanStack marks a link it sees as active too, so its match
// rules here keep it to the same one (History and Team Lockers are two views of one page).
function NavLinks({
  section,
  linkClass,
  onPick,
}: {
  section: Section | null;
  linkClass: (on: boolean) => string;
  onPick?: () => void;
}) {
  const props = (key: Section) => ({
    className: linkClass(section === key),
    "aria-current": section === key ? ("page" as const) : undefined,
    activeProps: {},
    onClick: onPick,
  });
  return (
    <>
      <Link to="/" activeOptions={{ exact: true }} {...props("standings")}>
        Standings
      </Link>
      <Link to="/race" {...props("race")}>
        Race
      </Link>
      <Link to="/leaders" {...props("leaders")}>
        Leaders
      </Link>
      <Link to="/rules" {...props("rules")}>
        Swaps & Rules
      </Link>
      <Link
        to="/history"
        activeOptions={{ exact: true, includeSearch: true }}
        {...props("history")}
      >
        History
      </Link>
      <Link
        to="/history"
        search={{ view: "teams" }}
        activeOptions={{ exact: true, includeSearch: true }}
        {...props("lockers")}
      >
        Team Lockers
      </Link>
    </>
  );
}

export function SiteHeader() {
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false); // the phone menu
  const section = useRouterState({
    select: (st): Section | null => {
      const path = st.location.pathname;
      if (path === "/") return "standings";
      if (path === "/race") return "race";
      if (path === "/leaders") return "leaders";
      if (path === "/rules") return "rules";
      if (path === "/history")
        return (st.location.search as { view?: string }).view === "teams" ? "lockers" : "history";
      return null;
    },
  });
  const href = useRouterState({ select: (st) => st.location.href });
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  // The phone menu closes on moving to another page, and on Escape
  useEffect(() => setOpen(false), [href]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
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
  const close = () => setOpen(false);
  return (
    <>
      <header className="relative z-40 bg-band text-band-foreground">
        {/* Phones: the logo, Get the app and the menu button. Tablets and up: the logo and the
            buttons, then the menu as a second row (one line can't hold the name and six links). */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 px-4 py-2 md:gap-x-4 md:pb-0 xl:pt-3">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className="flex items-center gap-2 py-1 font-display text-2xl font-extrabold uppercase leading-none tracking-wide min-[400px]:text-[28px] sm:text-3xl xl:text-4xl"
          >
            {/* The narrowest phones keep the name and drop the mark, so the bar stays on one row */}
            <Logo className="hidden h-9 w-9 shrink-0 min-[360px]:block sm:h-10 sm:w-10 xl:h-12 xl:w-12" />
            WG Hockey Pool
          </Link>
          <nav
            aria-label="Main"
            className="order-last -ml-3 hidden w-[calc(100%+0.75rem)] gap-1 pb-1 md:flex"
          >
            <NavLinks section={section} linkClass={(on) => `${item} ${on ? active : ""}`} />
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <InstallButton />
            <button
              onClick={toggle}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              className="hidden rounded p-2 text-band-foreground hover:bg-band-foreground/10 md:block xl:p-3"
            >
              {dark ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
            </button>
            <button
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="phone-menu"
              aria-label={open ? "Close menu" : "Menu"}
              className="flex items-center gap-1 rounded px-1.5 py-2 text-sm font-semibold uppercase tracking-wider text-band-foreground hover:bg-band-foreground/10 md:hidden"
            >
              {open ? (
                <X className="h-5 w-5" aria-hidden />
              ) : (
                <Menu className="h-5 w-5" aria-hidden />
              )}
              {/* Stays "Menu" when open (the icon turns to ✕), so the bar doesn't shift */}
              <span aria-hidden>Menu</span>
            </button>
          </div>
        </div>
        <div className="h-1.5 bg-red" />
        <div className="h-1.5 bg-gold" />
        {open && (
          <nav
            id="phone-menu"
            aria-label="Main"
            className="absolute inset-x-0 top-full border-b border-band-foreground/20 bg-band shadow-lg md:hidden"
          >
            <div className="flex flex-col gap-1 px-2 py-2">
              <NavLinks section={section} linkClass={row} onPick={close} />
              <div className="mt-1 border-t border-band-foreground/20 pt-1">
                <InstallButton variant="row" />
              </div>
              <button
                onClick={toggle}
                className={`${row(false)} flex w-full items-center gap-3 text-left`}
              >
                {dark ? (
                  <Sun className="h-6 w-6" aria-hidden />
                ) : (
                  <Moon className="h-6 w-6" aria-hidden />
                )}
                {dark ? "Light mode" : "Dark mode"}
              </button>
            </div>
          </nav>
        )}
      </header>
      {/* Dims the page behind the phone menu; tapping it closes the menu */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={close} aria-hidden />
      )}
    </>
  );
}

export function SiteFooter() {
  const built = builtAt(__APP_BUILD__);
  return (
    <footer className="mx-auto flex max-w-6xl flex-wrap gap-x-4 gap-y-1 px-4 pb-8 pt-4 text-sm text-muted-foreground">
      <Link to="/tv" className="hover:underline">
        TV board
      </Link>
      <Link to="/admin" className="hover:underline">
        Commissioner
      </Link>
      <Link to="/whats-new" className="hover:underline">
        What's new
      </Link>
      {/* Which published version this page is running: the release, and the build (the same one
          "Update now" compares, so after an update it shows the page moved to the new build) */}
      <Link
        to="/whats-new"
        className="num ml-auto hover:underline"
        title={built ? `Built ${fmtBuilt(built)}` : undefined}
      >
        v{CURRENT.version} · build {__APP_BUILD__}
      </Link>
    </footer>
  );
}
