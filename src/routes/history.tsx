import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { TeamLogo } from "@/components/team-logo";
import { TeamRoster } from "@/components/team-roster";
import type { Finish } from "@/data/history";
import type { ArchivedRoster } from "@/lib/archive";
import {
  historyName,
  hypeLine,
  KIND_NAME,
  locker,
  lockerGroups,
  margin,
  ord,
  place,
  poolKey,
  poolName,
  pools,
  records,
  type Pool,
} from "@/lib/history";
import type { LiveData } from "@/lib/live";
import type { SeasonTeam } from "@/lib/season";
import { archiveQuery, fmtDate, liveQuery, seasonQuery } from "@/lib/season-query";

type Search = { view?: "teams"; team?: string };

export const Route = createFileRoute("/history")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    ...(s["view"] === "teams" && { view: "teams" as const }),
    ...(typeof s["team"] === "string" && { team: s["team"] }),
  }),
  head: () => ({
    meta: [
      { title: "History — War Room Hockey Pool" },
      {
        name: "description",
        content:
          "Every champion, podium and points total in our pool since 2020-21: six regular seasons and six playoff pools.",
      },
      { property: "og:title", content: "Banners in the Rafters — War Room Hockey Pool" },
      {
        property: "og:description",
        content: "Every champion, podium and points total in our pool since 2020-21.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loaderDeps: ({ search }) => ({ lockers: search.view === "teams" }),
  // The lockers show this season's rosters live; the banners and podiums need nothing
  loader: async ({ context, deps }) => {
    if (!deps.lockers) return;
    await Promise.all([
      context.queryClient.ensureQueryData(seasonQuery),
      context.queryClient.ensureQueryData(liveQuery),
    ]);
  },
  errorComponent: ({ error }) => (
    <p className="p-8 text-lg">The team lockers didn't load: {error instanceof Error ? error.message : String(error)}</p>
  ),
  component: History,
});

const GOLD = "#FFB81C";
// Medal colours, light and dark
const MEDAL = {
  1: "bg-[#E9A300] dark:bg-[#FFB81C]",
  2: "bg-[#8E8A84] dark:bg-[#BDB8B0]",
  3: "bg-[#A8652F] dark:bg-[#D58B52]",
} as Record<number, string>;
const MEDAL_SOFT = {
  1: "bg-[#FBEBC0] dark:bg-[#3B2E0E]",
  2: "bg-[#ECE8E1] dark:bg-[#2A2723]",
  3: "bg-[#F3E0CF] dark:bg-[#3A2618]",
} as Record<number, string>;
const eyebrow = "text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground";

function History() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/history" });
  const all = pools(); // newest first
  const chrono = [...all].reverse();
  const latest = chrono.slice(-2);
  const older = chrono.slice(0, -2);
  // The menu's History shows the banners and podiums; Team Lockers shows the lockers on their own
  const lockers = search.view === "teams";
  const openTeam = (team: string) => {
    navigate({ search: { view: "teams", team } });
    window.scrollTo({ top: 0 });
  };
  return (
    <>
      {!lockers && <Hero latest={latest} older={older} />}
      <main className="mx-auto max-w-6xl px-3 pb-16 pt-6 sm:px-4">
        {lockers ? (
          <Lockers
            team={search.team}
            onTeam={openTeam}
            onAll={() => navigate({ search: { view: "teams" } })}
          />
        ) : (
          <Podiums all={all} onTeam={openTeam} />
        )}
        <p className="mt-8 max-w-[75ch] text-sm text-muted-foreground">
          Points are official OfficePools totals. 2020-21 was the NHL's 56-game season, so its
          regular-season totals run lower; averages leave that season out and say so. Teams that
          changed their name slightly (like "Longhorn7007" to "Longhorn") are grouped under one
          name, and the old names are listed on each locker.
        </p>
      </main>
    </>
  );
}

// ---------- hero: banners hanging from the rafters ----------

function Hero({ latest, older }: { latest: Pool[]; older: Pool[] }) {
  return (
    <section
      className="relative overflow-hidden text-[#F3EDE1]"
      style={{
        background: "radial-gradient(110% 90% at 85% 0%,#4A0F18 0%,#1A1110 50%,#0B0A09 100%)",
      }}
    >
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-10">
        <div className="grid items-end gap-8 lg:grid-cols-2 lg:gap-12">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#A89F90]">
              Walnut Grove hockey pool · 2020-21 to 2026
            </div>
            <h1
              className="mt-2 origin-bottom-left font-display text-[clamp(48px,7vw,94px)] font-black uppercase leading-[0.95]"
              style={{ transform: "skewX(-8deg)" }}
            >
              Banners in the <span className="text-gold lg:block">Rafters</span>
            </h1>
            <p className="mt-4 max-w-[46ch] text-lg text-[#D8CFBF]">
              Every champion, every podium and every points total from six regular seasons and six
              playoff pools. Find your team, check your résumé, and start the trash talk before the
              draft.
            </p>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.14em] text-gold">
              Reigning champions
            </div>
            <Beam />
            <div className="grid grid-cols-2 gap-3 px-1 sm:gap-6 sm:px-2.5">
              {latest.map((p) => (
                <Banner key={p.key} pool={p} big />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-10">
          <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#A89F90]">
            Championship history
          </div>
          <Beam />
          <div
            className="grid grid-cols-5 gap-1.5 px-1 md:grid-cols-10 md:gap-2.5"
            aria-label="Past champions by season"
          >
            {older.map((p) => (
              <Banner key={p.key} pool={p} />
            ))}
          </div>
        </div>
      </div>
      {/* gold, red, gold stripes along the bottom, like the site header */}
      <div
        className="absolute inset-x-0 bottom-0 h-[18px]"
        style={{
          background: `linear-gradient(${GOLD} 0 5px,#0B0A09 5px 7px,#C8102E 7px 13px,#0B0A09 13px 15px,${GOLD} 15px)`,
        }}
        aria-hidden
      />
    </section>
  );
}

function Beam() {
  return (
    <div
      className="mt-2.5 h-3 rounded-sm"
      style={{
        background: "linear-gradient(#7A746C,#35312C 60%,#211E1B)",
        boxShadow: "0 3px 6px rgba(0,0,0,.5)",
      }}
      aria-hidden
    />
  );
}

// Shrinks a name until it fits its banner
function FitName({ text, className }: { text: string; className: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = "";
      let size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.clientWidth && size > 9) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [text]);
  // A long single word stays on one line and shrinks; shorter names can wrap
  const nowrap = text.split(/\s+/).some((w) => w.length > 9);
  return (
    <span ref={ref} className={`${className} ${nowrap ? "whitespace-nowrap" : ""}`}>
      {text}
    </span>
  );
}

function Banner({ pool, big = false }: { pool: Pool; big?: boolean }) {
  const champ = pool.rows[0]!;
  const playoff = pool.k === "P";
  const edge = big ? 2 : 1.5;
  const tail = big ? 26 : 16;
  return (
    <div className={`relative flex min-w-0 flex-col ${big ? "pt-4" : "pt-3"}`}>
      {/* the two wires it hangs from */}
      {["left-[24%]", "right-[24%]"].map((pos) => (
        <span
          key={pos}
          className={`absolute top-0 ${pos} ${big ? "h-4 w-[3px]" : "h-3 w-0.5"} bg-[#8A847A]`}
          aria-hidden
        />
      ))}
      <div
        className="flex flex-1 flex-col"
        style={{
          filter: `drop-shadow(${edge}px 0 0 ${GOLD}) drop-shadow(-${edge}px 0 0 ${GOLD}) drop-shadow(0 ${edge}px 0 ${GOLD}) drop-shadow(0 ${big ? 12 : 8}px ${big ? 14 : 10}px rgba(0,0,0,.55))`,
        }}
      >
        <div
          className={`flex flex-1 flex-col items-center text-center ${big ? "gap-2.5 px-2 pb-11 pt-6 sm:px-4" : "gap-1.5 px-1 pb-7 pt-3 sm:px-1.5"}`}
          style={{
            background: playoff
              ? "linear-gradient(180deg,#D3172F,#7A0B19)"
              : "linear-gradient(180deg,#34302C,#211E1B)",
            boxShadow: `inset 0 ${big ? 5 : 3}px 0 ${GOLD}`,
            clipPath: `polygon(0 0,100% 0,100% calc(100% - ${tail}px),50% 100%,0 calc(100% - ${tail}px))`,
          }}
        >
          <span
            className={`num whitespace-nowrap font-semibold text-gold ${big ? "text-base sm:text-lg" : "text-[9.5px] sm:text-[11px]"}`}
          >
            {pool.s}
          </span>
          <FitName
            text={champ.t}
            className={`my-auto block w-full font-display font-extrabold uppercase leading-none text-white ${big ? "text-[clamp(26px,4vw,50px)]" : "text-[17px]"}`}
          />
          {big && (
            <span className="num whitespace-nowrap text-[11px] text-[#F3EDE1] sm:text-[13px]">
              {champ.p} pts · won by {margin(pool)}
            </span>
          )}
          <span
            className={`font-semibold uppercase ${playoff ? "text-[#FFE3E3]" : "text-[#CFC5B4]"} ${big ? "text-[10.5px] tracking-[0.14em] sm:text-xs" : "text-[8.5px] tracking-[0.08em] sm:text-[9.5px] sm:tracking-[0.14em]"}`}
          >
            {big
              ? playoff
                ? "Playoff champion"
                : "Season champion"
              : playoff
                ? "Playoffs"
                : "Season"}
          </span>
          <span
            className={`w-[64%] flex-none opacity-85 ${big ? "h-[9px] border-y-[3px]" : "h-[7px] border-y-2"}`}
            style={{ borderColor: GOLD }}
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}

// ---------- podiums ----------

function Podiums({ all, onTeam }: { all: Pool[]; onTeam: (team: string) => void }) {
  const [kind, setKind] = useState<"all" | "R" | "P">("all");
  const r = records();
  const cards: [string, number, string, string][] = [
    [
      "Most championships",
      r.titles.n,
      r.titles.who.join(" & "),
      "Regular season and playoffs combined",
    ],
    [
      "Most podium finishes",
      r.podiums.n,
      r.podiums.who.join(" & "),
      `Top-3 finishes, all ${r.poolCount} pools`,
    ],
    [
      "Biggest regular season",
      r.bestSeason.p,
      r.bestSeason.t,
      `${r.bestSeason.s} · finished ${place(r.bestSeason)}`,
    ],
    [
      "Biggest playoff run",
      r.bestPlayoff.p,
      r.bestPlayoff.t,
      `${r.bestPlayoff.s} playoffs · finished ${place(r.bestPlayoff)}`,
    ],
  ];
  return (
    <section>
      <div className="mb-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, v, who, ctx]) => (
          <div key={label} className="rounded-lg border bg-card px-4 py-3.5">
            <div className={eyebrow}>{label}</div>
            <div className="num mt-1.5 font-display text-4xl font-extrabold leading-none">{v}</div>
            <div className="mt-1 font-semibold">{who}</div>
            <div className="text-sm text-muted-foreground">{ctx}</div>
          </div>
        ))}
      </div>
      <div className="mb-3.5 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-3xl font-extrabold uppercase sm:text-4xl">Top 3, every season</h2>
        <div className="inline-flex overflow-hidden rounded-full border-2 bg-card">
          {(
            [
              ["all", "All"],
              ["R", "Regular season"],
              ["P", "Playoffs"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`px-3.5 py-2 text-xs font-bold uppercase tracking-wider sm:text-sm ${kind === k ? "bg-red text-white" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {all
          .filter((p) => kind === "all" || p.k === kind)
          .map((p) => (
            <article key={p.key} className="rounded-xl border bg-card px-4 pb-3 pt-4 shadow-sm">
              <header className="mb-2.5 flex items-baseline justify-between gap-2">
                <h3 className="text-2xl font-extrabold uppercase">{poolName(p)}</h3>
                <span
                  className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest ${p.k === "P" ? "bg-red/15 text-red" : "bg-foreground/10 text-foreground"}`}
                >
                  {KIND_NAME[p.k]}
                </span>
              </header>
              {p.rows
                .filter((f) => f.r <= 3)
                .map((f) => (
                  <div
                    key={f.t}
                    className={`mt-1.5 grid grid-cols-[34px_1fr_auto] items-center gap-2.5 rounded-lg px-2.5 py-2 ${MEDAL_SOFT[f.r]}`}
                  >
                    <span
                      className={`grid h-[30px] w-[30px] place-items-center rounded-full font-display text-lg font-black text-white ${MEDAL[f.r]}`}
                    >
                      {f.r}
                    </span>
                    <button
                      onClick={() => onTeam(f.t)}
                      className="flex items-center gap-2 text-left font-bold leading-tight hover:underline"
                    >
                      <TeamLogo name={f.t} size={26} />
                      <span>
                        {f.t}
                        {f.raw !== f.t && (
                          <small className="block text-xs font-medium text-muted-foreground">
                            as {f.raw}
                          </small>
                        )}
                        {f.tie && (
                          <small className="block text-xs font-medium text-muted-foreground">
                            tied
                          </small>
                        )}
                      </span>
                    </button>
                    <div className="num text-right text-lg font-semibold">
                      {f.p}
                      <small className="block text-[11px] font-medium text-muted-foreground">
                        pts
                      </small>
                    </div>
                  </div>
                ))}
              <div className="mt-2.5 text-xs text-muted-foreground">
                {p.rows.length} teams · winning margin {margin(p)} pts
                {p.k === "R" && p.s === "2020-21" ? " · 56-game season" : ""}
              </div>
            </article>
          ))}
      </div>
    </section>
  );
}

// ---------- team lockers ----------

// The Team Lockers menu: the list of teams, or one team's locker. This season's rosters come
// live from the standings; past seasons' rosters from the archive, loaded in the browser.
function Lockers({
  team,
  onTeam,
  onAll,
}: {
  team: string | undefined;
  onTeam: (team: string) => void;
  onAll: () => void;
}) {
  const { data: season } = useSuspenseQuery(seasonQuery);
  const { data: live } = useSuspenseQuery(liveQuery);
  const { data: archive = [] } = useQuery({ ...archiveQuery, enabled: !!team });
  const current = team ? season.teams.find((t) => historyName(t.name) === team) : undefined;
  const past = team ? archive.filter((r) => historyName(r.team_name) === team) : [];
  if (team && (locker(team) || current || past.length))
    return (
      <>
        <button
          onClick={onAll}
          className="mb-4 font-semibold text-muted-foreground hover:underline"
        >
          ← All teams
        </button>
        <Locker
          team={team}
          now={
            current
              ? {
                  team: current,
                  live,
                  season: season.season,
                  swapsLeft: Math.max(0, season.redraftSwaps - current.swapsUsed),
                }
              : null
          }
          past={past}
          archive={archive}
        />
      </>
    );
  const standings = season.teams.map((t) => {
    const lt = live.teams.find((x) => x.slot === t.slot);
    return { name: historyName(t.name), rank: lt?.rank ?? t.rank, pts: lt?.total ?? t.pts };
  });
  const groups = lockerGroups(standings.map((t) => t.name));
  return (
    <>
      <h1 className="mb-2 text-4xl font-extrabold uppercase sm:text-5xl">Team lockers</h1>
      <p className="mb-5 text-lg text-muted-foreground">Tap a team to open its locker.</p>
      <h2 className="mb-3 text-3xl font-extrabold uppercase">
        This season <span className="text-muted-foreground">· {season.season}</span>
      </h2>
      <TeamList
        names={groups.current}
        season={season.season}
        standings={standings}
        onTeam={onTeam}
      />
      {groups.former.length > 0 && (
        <section className="mt-10" aria-labelledby="former-h">
          <h2 id="former-h" className="text-3xl font-extrabold uppercase">
            Former teams
          </h2>
          <p className="mb-3 text-muted-foreground">
            Out of the pool, not forgotten: their banners, records and past rosters stay in their
            lockers.
          </p>
          <TeamList
            names={groups.former}
            season={season.season}
            standings={standings}
            onTeam={onTeam}
          />
        </section>
      )}
    </>
  );
}

// A grid of lockers with each team's titles and podiums, and where it stands this season or the
// last pool it played in
function TeamList({
  names,
  season,
  standings,
  onTeam,
}: {
  names: string[];
  season: string;
  standings: { name: string; rank: number; pts: number }[];
  onTeam: (team: string) => void;
}) {
  const now = new Map(standings.map((t) => [t.name, t]));
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {names.map((name) => {
        const l = locker(name);
        const c = now.get(name);
        return (
          <li key={name}>
            <button
              onClick={() => onTeam(name)}
              className="flex h-full w-full items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-left shadow-sm hover:border-foreground"
            >
              <TeamLogo name={name} size={52} />
              <span className="min-w-0 flex-1">
                <span className="block font-display text-2xl font-extrabold uppercase leading-tight">
                  {name}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {l
                    ? `${l.rows.length} pool${l.rows.length > 1 ? "s" : ""} · ${l.podiums} podium${l.podiums === 1 ? "" : "s"} · best ${place(l.best)}`
                    : "First season in the pool"}
                </span>
                {c ? (
                  <span className="block text-sm font-semibold">
                    {season}: {ord(c.rank)} · <span className="num">{c.pts}</span> pts
                  </span>
                ) : (
                  l && (
                    <span className="block text-sm font-semibold">
                      Last pool: {poolName(l.rows[0]!)}
                    </span>
                  )
                )}
              </span>
              {l && l.titles.length > 0 && (
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-bold text-black ${MEDAL[1]}`}
                  title={l.titles.map((c) => poolName(c)).join(", ")}
                >
                  {l.titles.length} title{l.titles.length > 1 ? "s" : ""}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

type LockerData = NonNullable<ReturnType<typeof locker>>;

function historyTiles(l: LockerData): [string, string | number, string][] {
  return [
    [
      "Championships",
      l.titles.length,
      l.titles.length
        ? l.titles.map((c) => (c.k === "P" ? `${c.s} playoffs` : c.s)).join(", ")
        : "Banner pending",
    ],
    [
      "Podium finishes",
      l.podiums,
      `in ${l.rows.length} pool${l.rows.length > 1 ? "s" : ""} entered`,
    ],
    [
      "Best finish",
      place(l.best),
      `${l.best.s} ${l.best.k === "P" ? "playoffs" : "season"} · ${l.best.p} pts`,
    ],
    [
      "Best season",
      l.bestSeason?.p ?? "–",
      l.bestSeason
        ? `${l.bestSeason.s} · ${place(l.bestSeason)} of ${l.bestSeason.n}`
        : "No full regular season",
    ],
    [
      "Avg season",
      l.avgSeason ?? "–",
      l.fullSeasons
        ? `${l.fullSeasons} full season${l.fullSeasons > 1 ? "s" : ""}${l.playedShort ? ", 2020-21 excluded" : ""}`
        : "No full regular season",
    ],
    [
      "Best playoff run",
      l.bestPlayoff?.p ?? "–",
      l.bestPlayoff
        ? `${l.bestPlayoff.s} · ${place(l.bestPlayoff)} of ${l.bestPlayoff.n}`
        : "No playoff pools",
    ],
    [
      "Avg playoff pts",
      l.avgPlayoff ?? "–",
      l.playoffPools
        ? `${l.playoffPools} playoff pool${l.playoffPools > 1 ? "s" : ""}`
        : "No playoff pools",
    ],
    ["Avg finish", ord(l.avgFinish), "All pools entered"],
  ];
}

type Now = { team: SeasonTeam; live: LiveData; season: string; swapsLeft: number };

// A team's locker: this season's roster, its history, and the rosters it drafted before
function Locker({
  team,
  now,
  past,
  archive,
}: {
  team: string;
  now: Now | null;
  past: ArchivedRoster[];
  archive: ArchivedRoster[];
}) {
  const l = locker(team);
  return (
    <section>
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4 bg-band px-5 py-5 text-[#F3EDE1]">
          <div className="flex items-center gap-4">
            <TeamLogo name={team} size={96} className="h-16 w-16 sm:h-24 sm:w-24" />
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-[0.14em] text-[#A89F90]">
                Team locker
              </div>
              <h2 className="font-display text-[clamp(38px,7vw,64px)] font-black uppercase leading-[0.95]">
                {team}
              </h2>
              {l && l.aka.length > 0 && (
                <div className="mt-2 text-sm text-[#CFC5B4]">Also played as {l.aka.join(", ")}</div>
              )}
            </div>
          </div>
          {l && (
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3.5">
              {l.titles.map((c) => (
                <Trophy key={poolKey(c)} f={c} />
              ))}
              {l.medals.map((m) => (
                <Trophy key={poolKey(m)} f={m} />
              ))}
            </div>
          )}
        </div>
        {now && <ThisSeason team={team} now={now} />}
        <div className="border-b bg-gold/15 px-5 pb-5 pt-4">
          {l?.story ? (
            <>
              <div className={`${eyebrow} !text-red`}>Scouting report</div>
              <div className="mt-1.5 font-display text-3xl font-extrabold uppercase leading-none">
                {l.story[0]}
              </div>
              <p className="mt-2 max-w-[70ch] text-lg">{l.story[1]}</p>
            </>
          ) : (
            <p className="max-w-[70ch] text-lg">
              {l
                ? hypeLine(l)
                : `New to the pool${now ? ` in ${now.season}` : ""}. Every dynasty starts with a draft.`}
            </p>
          )}
        </div>
        {l && (
          <>
            <div className="grid grid-cols-2 border-b md:grid-cols-4">
              {historyTiles(l).map(([label, v, ctx]) => (
                <div key={label} className="border-r border-t px-4 py-4 sm:px-5">
                  <div className={eyebrow}>{label}</div>
                  <div className="num mt-1.5 font-display text-4xl font-extrabold leading-none">
                    {v}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{ctx}</div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4">
              <h3 className="mb-2.5 text-2xl font-extrabold uppercase">Finish by season</h3>
              <div className="overflow-x-auto">
                <FinishChart rows={l.rows} />
              </div>
            </div>
            <div className="px-5 pb-5">
              <h3 className="mb-2.5 text-2xl font-extrabold uppercase">Every pool</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-xs uppercase tracking-widest text-muted-foreground">
                    <tr className="border-b-2">
                      <th className="px-2.5 py-2">Season</th>
                      <th className="px-2.5 py-2">Pool</th>
                      <th className="px-2.5 py-2 text-right">Finish</th>
                      <th className="px-2.5 py-2 text-right">Points</th>
                      <th className="px-2.5 py-2 text-right">Gap to 1st</th>
                    </tr>
                  </thead>
                  <tbody>
                    {l.rows.map((f) => {
                      const gap = l.gapToFirst(f);
                      return (
                        <tr key={poolKey(f)} className={`border-b ${f.r <= 3 ? "font-bold" : ""}`}>
                          <td className="px-2.5 py-2">{f.s}</td>
                          <td className="px-2.5 py-2">{KIND_NAME[f.k]}</td>
                          <td className="num px-2.5 py-2 text-right">
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${f.r <= 3 ? `${MEDAL[f.r]} ${f.r === 1 ? "text-black" : "text-white"}` : "border bg-muted"}`}
                            >
                              {place(f)}
                            </span>{" "}
                            <span className="font-normal text-muted-foreground">/{f.n}</span>
                          </td>
                          <td className="num px-2.5 py-2 text-right">{f.p}</td>
                          <td className="num px-2.5 py-2 text-right">
                            {gap == null ? "—" : `−${gap}`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
        {past.length > 0 && <PastRosters team={team} past={past} archive={archive} />}
      </div>
    </section>
  );
}

// This season's pool roster, live: the team page that used to be /teams/N
function ThisSeason({ team, now }: { team: string; now: Now }) {
  const { team: t, live } = now;
  const lt = live.teams.find((x) => x.slot === t.slot);
  const stats: [string, string | number][] = [
    ["Rank", ord(lt?.rank ?? t.rank)],
    ["Points", lt?.total ?? t.pts],
    ...(lt && live.anyGames ? [["Tonight", lt.tonight] as [string, number]] : []),
    ["Projected", t.projected],
    ["Swaps left", now.swapsLeft],
  ];
  return (
    <div className="border-b px-5 py-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <div className={`${eyebrow} !text-red`}>
            {now.season} pool{t.name !== team ? ` · as ${t.name}` : ""}
          </div>
          <h3 className="text-2xl font-extrabold uppercase">This season's roster</h3>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-center">
          {stats.map(([label, v]) => (
            <div key={label}>
              <div className="num text-3xl font-extrabold leading-none">{v}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 overflow-x-auto rounded-md border">
        <div className="sm:min-w-[640px]">
          <TeamRoster team={t} live={live} full />
        </div>
      </div>
      {t.dropped.length > 0 && (
        <>
          <h4 className="mb-2 mt-4 text-lg font-bold uppercase">Swapped out</h4>
          <ul className="divide-y rounded-md border">
            {t.dropped.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5 text-muted-foreground"
              >
                <span>
                  <span className="font-semibold line-through">{p.name}</span>{" "}
                  <span className="text-sm">
                    dropped {fmtDate(p.droppedOn)} for {p.replacedBy}
                  </span>
                </span>
                <span className="num line-through">
                  {p.gp} GP · {p.g}G {p.a}A · {p.pts} P
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-3 text-sm text-muted-foreground">
        Draft-day projection: {t.preseason} points. When the season ends, this roster stays in the
        locker.
      </p>
    </div>
  );
}

// The rosters the team drafted in past seasons, newest first, as they stood at season's end
function PastRosters({
  team,
  past,
  archive,
}: {
  team: string;
  past: ArchivedRoster[];
  archive: ArchivedRoster[];
}) {
  return (
    <div className="border-t px-5 py-5">
      <h3 className="text-2xl font-extrabold uppercase">Past rosters</h3>
      <p className="mb-2 text-muted-foreground">Who they picked, and what each player scored.</p>
      {past.map((r, i) => {
        const teams = archive.filter((x) => x.season_id === r.season_id).length;
        return (
          <details
            key={r.season_id}
            open={i === 0}
            className="border-t py-2 first-of-type:border-t-0"
          >
            <summary className="cursor-pointer py-1.5 text-xl font-bold">
              {r.season_id}{" "}
              <span className="text-base font-normal text-muted-foreground">
                · {ord(r.rank)} of {teams} · <span className="num">{r.points}</span> pts
                {r.team_name !== team ? ` · as ${r.team_name}` : ""}
              </span>
            </summary>
            <div className="mt-1 overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-xs uppercase tracking-widest text-muted-foreground">
                  <tr className="border-b-2">
                    <th className="px-1.5 py-2 sm:px-2.5">Player</th>
                    <th className="px-1.5 py-2 sm:px-2.5 text-right">GP</th>
                    <th className="px-1.5 py-2 sm:px-2.5 text-right">G</th>
                    <th className="px-1.5 py-2 sm:px-2.5 text-right">A</th>
                    <th className="px-1.5 py-2 sm:px-2.5 text-right">P</th>
                  </tr>
                </thead>
                <tbody>
                  {r.players.map((p) => (
                    <tr key={p.id} className="border-b">
                      <td className="px-1.5 py-2 sm:px-2.5">
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {[p.team, p.pos].filter(Boolean).join(" · ")}
                          {p.team || p.pos ? " · " : ""}
                          {p.round != null
                            ? `Rd\u00a0${p.round}`
                            : `Swap${p.added ? ` ${fmtDate(p.added)}` : ""}`}
                        </div>
                      </td>
                      <td className="num px-1.5 py-2 sm:px-2.5 text-right">{p.gp}</td>
                      <td className="num px-1.5 py-2 sm:px-2.5 text-right">{p.g}</td>
                      <td className="num px-1.5 py-2 sm:px-2.5 text-right">{p.a}</td>
                      <td className="num px-1.5 py-2 sm:px-2.5 text-right text-lg font-bold">
                        {p.pts}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {r.dropped.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                Swapped out:{" "}
                {r.dropped
                  .map((d) => `${d.name} (${d.pts} pts, dropped ${fmtDate(d.dropped)})`)
                  .join("; ")}
              </p>
            )}
          </details>
        );
      })}
    </div>
  );
}

// A cup for a title (gold for the season, silver for the playoffs) or a medal for 2nd and 3rd
function Trophy({ f }: { f: Finish }) {
  const id = useId();
  const label =
    f.r === 1
      ? `${f.s} ${f.k === "P" ? "playoff" : "regular-season"} champion`
      : `${f.s} ${f.k === "P" ? "playoffs" : "regular season"}: ${ord(f.r)} place`;
  let art;
  if (f.r === 1 && f.k === "P")
    art = (
      <svg viewBox="0 0 46 72" className="h-[72px] w-[46px]" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" x2="1">
            <stop offset="0" stopColor="#8E99A6" />
            <stop offset=".45" stopColor="#F4F7FA" />
            <stop offset="1" stopColor="#7C8794" />
          </linearGradient>
        </defs>
        <path d="M9 4h28l-3 14H12z" fill={`url(#${id})`} />
        <rect x="11" y="18" width="24" height="7" rx="2" fill={`url(#${id})`} />
        <rect x="13" y="25" width="20" height="9" fill={`url(#${id})`} />
        <rect x="10" y="34" width="26" height="9" fill={`url(#${id})`} />
        <rect x="7" y="43" width="32" height="11" fill={`url(#${id})`} />
        <rect x="4" y="54" width="38" height="14" rx="2" fill={`url(#${id})`} />
        <g stroke="#6B7684" strokeWidth="1" opacity=".6">
          <line x1="10" y1="38.5" x2="36" y2="38.5" />
          <line x1="7" y1="48.5" x2="39" y2="48.5" />
          <line x1="4" y1="61" x2="42" y2="61" />
        </g>
      </svg>
    );
  else if (f.r === 1)
    art = (
      <svg viewBox="0 0 52 64" className="h-16 w-[52px]" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" x2="1">
            <stop offset="0" stopColor="#A8771A" />
            <stop offset=".45" stopColor="#FFE08A" />
            <stop offset="1" stopColor="#9C6B12" />
          </linearGradient>
        </defs>
        <path d="M10 8C1 8 1 26 13 27" fill="none" stroke={`url(#${id})`} strokeWidth="4" />
        <path d="M42 8c9 0 9 18-3 19" fill="none" stroke={`url(#${id})`} strokeWidth="4" />
        <path d="M9 3h34v10c0 12-7 20-17 20S9 25 9 13z" fill={`url(#${id})`} />
        <rect x="22" y="32" width="8" height="12" fill={`url(#${id})`} />
        <path d="M15 44h22l3 8H12z" fill={`url(#${id})`} />
        <rect x="9" y="52" width="34" height="9" rx="1.5" fill="#3A2A0C" />
        <rect x="18" y="54.5" width="16" height="4" rx="1" fill="#C9971C" />
      </svg>
    );
  else {
    const g = f.r === 2 ? ["#8E949B", "#F4F6F8", "#7D838B"] : ["#8A4E22", "#F0B27A", "#7A421A"];
    art = (
      <svg viewBox="0 0 44 60" className="h-[50px] w-9" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={g[0]} />
            <stop offset=".45" stopColor={g[1]} />
            <stop offset="1" stopColor={g[2]} />
          </linearGradient>
        </defs>
        <path d="M8 0h11l7 22h-11z" fill="#C8102E" />
        <path d="M36 0H25l-7 22h11z" fill={GOLD} />
        <circle cx="22" cy="40" r="17" fill={`url(#${id})`} />
        <circle cx="22" cy="40" r="12.5" fill="none" stroke="rgba(0,0,0,.25)" strokeWidth="1.5" />
        <text
          x="22"
          y="46.5"
          textAnchor="middle"
          fontFamily="Big Shoulders Display,Impact,sans-serif"
          fontWeight="900"
          fontSize="19"
          fill="rgba(0,0,0,.55)"
        >
          {f.r}
        </text>
      </svg>
    );
  }
  return (
    <div className="flex w-[78px] flex-col items-center gap-1.5 text-center" title={label}>
      <span style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,.45))" }}>{art}</span>
      <span
        className={`num text-xs font-semibold leading-none ${f.r === 1 ? (f.k === "P" ? "text-[#E3E8EE]" : "text-[#FFD57A]") : "text-[#E3DED5]"}`}
      >
        {f.s}
      </span>
      <span className="text-[10px] uppercase leading-none tracking-[0.12em] text-[#A89F90]">
        {f.k === "P" ? "Playoffs" : "Season"}
      </span>
    </div>
  );
}

// Where the team finished in each pool, oldest to newest; the podium band is shaded
function FinishChart({ rows }: { rows: Finish[] }) {
  const order = pools().reverse();
  const maxN = Math.max(...order.flatMap((p) => p.rows.map((f) => f.n)));
  const W = 760;
  const H = 230;
  const L = 46;
  const R = 34;
  const T = 18;
  const B = 48;
  const x = (i: number) => L + (i * (W - L - R)) / (order.length - 1);
  const y = (rk: number) => T + ((rk - 1) * (H - T - B)) / (maxN - 1);
  const points = order.flatMap((p, i) => {
    const f = rows.find((r) => poolKey(r) === p.key);
    return f ? [{ f, i }] : [];
  });
  const dot = (r: number, k: string) =>
    r === 1
      ? "#E9A300"
      : r === 2
        ? "#8E8A84"
        : r === 3
          ? "#A8652F"
          : k === "P"
            ? "var(--color-red)"
            : "currentColor";
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full min-w-[560px] text-foreground"
      role="img"
      aria-label="Finish by season"
    >
      {[1, 3, 5, 10, 15].map((rk) => (
        <g key={rk}>
          <line x1={L} x2={W - R} y1={y(rk)} y2={y(rk)} stroke="var(--color-border)" />
          <text
            x={L - 8}
            y={y(rk) + 4}
            textAnchor="end"
            fontSize="11"
            className="fill-muted-foreground font-mono"
          >
            {ord(rk)}
          </text>
        </g>
      ))}
      <rect
        x={L}
        y={y(1) - 8}
        width={W - L - R}
        height={y(3) - y(1) + 16}
        fill="#E9A300"
        opacity=".12"
      />
      {order.map((p, i) => (
        <g key={p.key}>
          <text
            x={x(i)}
            y={H - 24}
            textAnchor="middle"
            fontSize="10.5"
            className="fill-muted-foreground font-mono"
          >
            {p.k === "P" ? p.s : p.s.slice(2)}
          </text>
          <text
            x={x(i)}
            y={H - 10}
            textAnchor="middle"
            fontSize="9.5"
            fontWeight="700"
            fill={p.k === "P" ? "var(--color-red)" : "currentColor"}
          >
            {p.k === "P" ? "PLAYOFF" : "SEASON"}
          </text>
        </g>
      ))}
      {(["R", "P"] as const).map((k) => {
        const ps = points.filter((p) => p.f.k === k);
        const col = k === "P" ? "var(--color-red)" : "currentColor";
        return (
          <g key={k}>
            {ps.length > 1 && (
              <polyline
                points={ps.map((p) => `${x(p.i)},${y(p.f.r)}`).join(" ")}
                fill="none"
                stroke={col}
                strokeWidth="2"
                strokeOpacity=".5"
              />
            )}
            {ps.map((p) => (
              <circle
                key={p.i}
                cx={x(p.i)}
                cy={y(p.f.r)}
                r={p.f.r <= 3 ? 8 : 5.5}
                fill={dot(p.f.r, k)}
                stroke="var(--color-card)"
                strokeWidth="2"
              >
                {/* one string: split text nodes in an SVG title don't hydrate */}
                <title>{`${p.f.s} ${KIND_NAME[p.f.k]}: ${place(p.f)}, ${p.f.p} pts`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </svg>
  );
}
