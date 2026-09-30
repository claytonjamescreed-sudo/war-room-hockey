import { Link } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const nav = [
  { to: "/", label: "Standings" },
  { to: "/race", label: "Race" },
  { to: "/leaders", label: "Leaders" },
  { to: "/rules", label: "Swaps & Rules" },
  { to: "/history", label: "History" },
] as const;

export function SiteHeader() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link
          to="/"
          className="font-display text-4xl font-extrabold uppercase leading-none tracking-wide"
        >
          War Room
        </Link>
        <nav className="flex flex-1 flex-wrap gap-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="rounded px-3 py-2 text-base font-semibold uppercase tracking-wider text-band-foreground/75 hover:text-band-foreground"
              activeProps={{
                className: "!text-band-foreground underline decoration-2 underline-offset-8",
              }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={toggle}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          className="rounded p-3 text-band-foreground hover:bg-band-foreground/10"
        >
          {dark ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
        </button>
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
    </footer>
  );
}
