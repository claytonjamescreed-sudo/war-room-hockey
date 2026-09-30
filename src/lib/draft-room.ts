// Draft room state that isn't draft math: the commissioner's saved War Room preferences, which
// slot is theirs, the draft-order shuffle, and setting up a mock draft. Pure functions (no DOM,
// no network), ported from the 2026-27 draft helper's app.js.
import {
  STACK_SHARE,
  type CpuTeam,
  type DraftPick,
  type Entry,
  type Lean,
  type Market,
  type Weights,
} from "./engine";

// Stars, avoids, big-contract flags and the War Room knobs. Kept per draft in warroom_prefs
// (commissioner only), and shared by the real draft and every mock.
export type Prefs = {
  settings: {
    market?: string;
    redraftDrops?: number;
    weights?: Partial<Weights>;
    myTeam?: string; // your team's name ("" if you weren't in last season's pool)
    mySlot?: number | null; // your slot when your team isn't in the draft order
  };
  starred: number[];
  avoid: number[];
  contract: Record<string, boolean>;
};

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const ids = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is number => Number.isInteger(x)) : [];

// Whatever is stored, as a Prefs with only the fields we understand
export function readPrefs(raw: unknown): Prefs {
  const r = isObj(raw) ? raw : {};
  const s = isObj(r["settings"]) ? r["settings"] : {};
  const settings: Prefs["settings"] = {};
  if (typeof s["market"] === "string") settings.market = s["market"];
  if (typeof s["redraftDrops"] === "number") settings.redraftDrops = s["redraftDrops"];
  if (typeof s["myTeam"] === "string") settings.myTeam = s["myTeam"];
  if (typeof s["mySlot"] === "number" || s["mySlot"] === null)
    settings.mySlot = s["mySlot"] as number | null;
  if (isObj(s["weights"]))
    settings.weights = Object.fromEntries(
      Object.entries(s["weights"]).filter((e): e is [string, number] => typeof e[1] === "number"),
    );
  const contract = isObj(r["contract"])
    ? Object.fromEntries(
        Object.entries(r["contract"]).filter(
          (e): e is [string, boolean] => typeof e[1] === "boolean",
        ),
      )
    : {};
  return { settings, starred: ids(r["starred"]), avoid: ids(r["avoid"]), contract };
}

// Your slot: where your team is in the order. Without your team in it, a slot you tapped stays
// yours unless another team was put there.
export function mySlotFor(
  teamNames: Record<number, string>,
  teams: number,
  myTeam: string,
  tapped: number | null | undefined,
): number | null {
  if (myTeam) for (let slot = 1; slot <= teams; slot++) if (teamNames[slot] === myTeam) return slot;
  if (tapped && tapped <= teams && !teamNames[tapped]) return tapped;
  return null;
}

// A fair shuffle (Fisher-Yates) of the teams entered. Empty slots first take last season's
// teams that aren't in the order yet, so one press randomizes the whole pool; any slots still
// empty stay at the end. Null when there are fewer than two teams to shuffle.
export function randomizeOrder(
  entries: string[],
  lastSeason: string[],
  rand: (n: number) => number = cryptoRand,
): { list: string[]; filled: number } | null {
  const count = entries.length;
  const teams = entries.filter(Boolean);
  const unused = lastSeason.filter((n) => !teams.includes(n));
  const filled = Math.min(count - teams.length, unused.length);
  teams.push(...unused.slice(0, filled));
  if (teams.length < 2) return null;
  for (let i = teams.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [teams[i], teams[j]] = [teams[j]!, teams[i]!];
  }
  return { list: [...teams, ...Array<string>(count - teams.length).fill("")], filled };
}

function cryptoRand(n: number) {
  const buf = new Uint32Array(1);
  try {
    crypto.getRandomValues(buf);
    return buf[0]! % n;
  } catch {
    return Math.floor(Math.random() * n);
  }
}

// ---------- mock drafts ----------

export type PoolTeam = { name: string; note?: string; lean?: Partial<Lean> };
export type MockOpts = {
  style: "teams" | "mixed" | Market;
  slot: number | null;
  speed: "watch" | "instant";
  auto: boolean;
  others: "cpu" | "manual";
};
export type Mock = {
  teams: number;
  rounds: number;
  mySlot: number;
  teamNames: Record<number, string>;
  picks: DraftPick[];
  cpu: Record<number, CpuTeam>;
  seed: number;
  auto: boolean; // the app makes my picks (off once I take one back)
  opts: MockOpts;
};

// A mock of last season's teams has exactly those teams (you plus the others); any other mock
// uses the real draft's team count
export const mockTeamCount = (
  style: MockOpts["style"],
  poolTeams: PoolTeam[],
  myTeam: string,
  realTeams: number,
) =>
  style === "teams" && poolTeams.length
    ? poolTeams.filter((t) => t.name !== myTeam).length + 1
    : realTeams;

export function newMock(
  opts: MockOpts,
  real: { teams: number; rounds: number; teamNames: Record<number, string> },
  poolTeams: PoolTeam[],
  myTeam: string,
  random: () => number = Math.random,
): Mock {
  const teams = mockTeamCount(opts.style, poolTeams, myTeam, real.teams);
  const mySlot = opts.slot && opts.slot <= teams ? opts.slot : 1 + Math.floor(random() * teams);
  const cpu: Record<number, CpuTeam> = {};
  // The real draft's names for the other slots; yours shows as You
  const teamNames: Record<number, string> = {};
  for (const [slot, name] of Object.entries(real.teamNames))
    if (name !== myTeam && Number(slot) !== mySlot && Number(slot) <= teams)
      teamNames[Number(slot)] = name;
  const noise = () => +(0.6 + random() * 0.8).toFixed(2);
  const others = Array.from({ length: teams }, (_, i) => i + 1).filter((t) => t !== mySlot);
  if (opts.style === "teams") {
    // Last season's teams in a random order, each with its own lean
    const lastYear = [...poolTeams.filter((t) => t.name !== myTeam)].sort(() => random() - 0.5);
    others.forEach((t, i) => {
      const team = lastYear[i];
      cpu[t] = team
        ? {
            style: "pool",
            noise: noise(),
            ...(team.lean && { lean: team.lean }),
            ...(team.note && { note: team.note }),
          }
        : { style: "pool", noise: noise(), note: "new team, drafts like the pool" };
      teamNames[t] = team ? team.name : `New team ${i - lastYear.length + 1}`;
    });
    teamNames[mySlot] = myTeam || "You";
  } else {
    for (const t of others)
      cpu[t] = { style: opts.style === "mixed" ? "pool" : opts.style, noise: noise() };
  }
  return {
    teams,
    rounds: real.rounds,
    mySlot,
    teamNames,
    picks: [],
    cpu,
    seed: Math.floor(random() * 2 ** 31),
    auto: opts.auto,
    opts,
  };
}

export const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]!);
};

// Lower-case without accents, so "stutzle" finds Stützle and "slafkovsky" finds Slafkovský
export const plain = (s: string | null | undefined) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Every word of the search appears in the player's name or team
export const nameMatches = (name: string, team: string | null | undefined, q: string) => {
  const hay = plain(`${name} ${team ?? ""}`);
  return plain(q)
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
};

export const lastName = (name: string) => name.split(" ").slice(-1)[0] ?? name;

// Stacks inside a roster: pairs who share at least STACK_SHARE of their ice time
export function stacks(entries: Entry[]) {
  const pairs: string[] = [];
  for (let a = 0; a < entries.length; a++)
    for (let b = a + 1; b < entries.length; b++) {
      const x = entries[a]!;
      const y = entries[b]!;
      const s = Math.max(
        x.p.mates.find(([id]) => id === y.id)?.[1] ?? 0,
        y.p.mates.find(([id]) => id === x.id)?.[1] ?? 0,
      );
      if (s >= STACK_SHARE)
        pairs.push(`${lastName(x.p.name)} + ${lastName(y.p.name)} (${Math.round(s * 100)}%)`);
    }
  return pairs;
}
