// The Settings and Mock draft sheets
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmButton, Err } from "@/components/commissioner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { field, primary, quiet, useAction } from "@/hooks/use-commissioner";
import { clearPicks, saveDraftSetup, startDraft } from "@/lib/draft-live";
import { mockTeamCount, type MockOpts } from "@/lib/draft-room";
import { DEFAULT_WEIGHTS, type Market, type Weights } from "@/lib/engine";
import { useRoom } from "./room-context";

const WEIGHT_UI: [keyof Weights, string, number, number, number, (v: number) => string, string][] =
  [
    [
      "espnBlend",
      "ESPN vs. our model",
      0,
      1,
      0.05,
      (v) => `${Math.round(v * 100)}% ESPN`,
      "How much of each projection comes from ESPN's numbers versus our own three-season model.",
    ],
    [
      "injuryCaution",
      "Injury caution",
      0,
      1.5,
      0.05,
      (v) => `${v.toFixed(2)}×`,
      "How much a history of missed games (last five seasons) lowers a player's expected games played. 0 ignores it.",
    ],
    [
      "injuryProne",
      "Injury-prone penalty",
      0,
      0.2,
      0.01,
      (v) => `−${Math.round(v * 100)}%`,
      "Extra cut for players with a pattern of missed games (20+ missed in two of five seasons, or 14+ in a typical season), on top of the games they're expected to miss.",
    ],
    [
      "trend",
      "Five-year scoring trend",
      0,
      1.5,
      0.05,
      (v) => `${v.toFixed(2)}×`,
      "How much a steady multi-year rise or decline in points per game moves a player. At 0.5, a player rising 12% a season gets +6%.",
    ],
    [
      "teamOffense",
      "High-scoring teams",
      0,
      1,
      0.05,
      (v) => `${Math.round(v * 100)}%`,
      "Boost for players on teams that score a lot (and a cut for low-scoring teams).",
    ],
    [
      "bigContract",
      "Big new contract penalty",
      0,
      0.2,
      0.01,
      (v) => `−${Math.round(v * 100)}%`,
      "Cut for players starting a big new deal this season.",
    ],
    [
      "bounceBack",
      "Bounce-back bonus",
      0,
      0.2,
      0.01,
      (v) => `+${Math.round(v * 100)}%`,
      "Boost for players whose last season was cut short or below their norm.",
    ],
    [
      "rookie",
      "Rookie bonus",
      0,
      0.2,
      0.01,
      (v) => `+${Math.round(v * 100)}%`,
      "Boost for rookies who haven't played an NHL game yet.",
    ],
    [
      "stack",
      "Line stacking bonus",
      0,
      0.2,
      0.01,
      (v) => `+${Math.round(v * 100)}%`,
      "Boost for a linemate or power-play mate of someone already on your team.",
    ],
  ];

// "2026-27" → "2027-28"
const nextSeason = (id: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(id);
  return m ? `${Number(m[1]) + 1}-${String((Number(m[2]) + 1) % 100).padStart(2, "0")}` : "";
};

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const room = useRoom();
  const qc = useQueryClient();
  const s = room.settings;
  const mock = room.mode === "mock";
  const locked = room.orderLocked;
  const started = room.draft.picks.length > 0;
  const [teams, setTeams] = useState(room.draft.teams);
  const [rounds, setRounds] = useState(room.draft.rounds);
  const [slot, setSlot] = useState<number | null>(room.prefs.settings.mySlot ?? null);
  const [market, setMarket] = useState<Market>(s.market);
  const [drops, setDrops] = useState(s.redraftDrops ?? 2);
  const [myTeam, setMyTeam] = useState(room.myTeam);
  const [weights, setWeights] = useState<Weights>({ ...s.weights });
  const [newId, setNewId] = useState(nextSeason(room.draft.id));
  // Your slot comes from the order once your team is in it; before that you pick it here
  const fromOrder = !!room.myTeam && Object.values(room.draft.teamNames).includes(room.myTeam);
  const { busy, error, run } = useAction();
  const refresh = () => qc.invalidateQueries({ queryKey: ["draft"] });

  const done = () =>
    run(async () => {
      room.setPrefs((p) => ({
        ...p,
        settings: {
          ...p.settings,
          market,
          redraftDrops: Math.max(0, Math.min(5, Math.round(drops) || 0)),
          weights,
          ...(!locked && { myTeam }),
          ...(!mock && !locked && { mySlot: slot }),
        },
      }));
      if (!mock) {
        const change = {
          ...(rounds !== room.draft.rounds && { rounds: Math.max(1, Math.min(30, rounds)) }),
          ...(!locked &&
            !started &&
            teams !== room.draft.teams && { teams: Math.max(2, Math.min(30, teams)) }),
        };
        if (Object.keys(change).length) {
          await saveDraftSetup(room.draft.id, change);
          await refresh();
        }
      }
      onClose();
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogTitle className="text-3xl font-extrabold uppercase">Settings</DialogTitle>
        <DialogDescription className="text-base">
          {mock
            ? "You're in a mock draft: start a new mock to change teams, rounds or your slot. Changes here also apply to your real draft."
            : locked
              ? "The draft order is locked in, so the teams, your slot and your team are fixed. Unlock it under Draft order to change them."
              : "The War Room's knobs. Stars, avoids and these settings are private to you."}
        </DialogDescription>
        {!mock && (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block font-semibold">Teams</span>
              <input
                type="number"
                min={2}
                max={30}
                value={teams}
                disabled={locked || started}
                onChange={(e) => setTeams(Number(e.target.value))}
                className={`${field} w-full`}
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-semibold">Rounds (players each)</span>
              <input
                type="number"
                min={1}
                max={30}
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
                className={`${field} w-full`}
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-semibold">Your slot</span>
              <select
                value={(fromOrder ? s.mySlot : slot) ?? ""}
                disabled={locked || fromOrder}
                onChange={(e) => setSlot(e.target.value ? Number(e.target.value) : null)}
                className={`${field} w-full`}
              >
                <option value="">Not set</option>
                {Array.from({ length: teams }, (_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>
            {fromOrder && !locked && (
              <p className="text-sm text-muted-foreground sm:col-span-3">
                Your slot comes from where {room.myTeam || "your team"} is in the draft order.
              </p>
            )}
          </div>
        )}
        <label className="block">
          <span className="mb-1 block font-semibold">How does the rest of your pool draft?</span>
          <select
            value={market}
            onChange={(e) => setMarket(e.target.value as Market)}
            className={`${field} w-full`}
          >
            <option value="pool">Off last season's points, or ESPN's projection when higher</option>
            <option value="points">Off last season's points only</option>
            <option value="proj">Off ESPN's projected points</option>
            <option value="espn">Off ESPN's rankings (average draft position)</option>
          </select>
          <span className="mt-1 block text-sm text-muted-foreground">
            Used to estimate who will still be there at your next pick. The first option fits your
            pool's last four drafts best.
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block font-semibold">
            All-Star redraft: players you can swap out
          </span>
          <input
            type="number"
            min={0}
            max={5}
            value={drops}
            onChange={(e) => setDrops(Number(e.target.value))}
            className={`${field} w-24`}
          />
          <span className="mt-1 block text-sm text-muted-foreground">
            In your last this-many rounds the pick card adds a “take a chance” pick with upside. 0
            turns it off.
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block font-semibold">Your team last season</span>
          <select
            value={myTeam}
            disabled={locked}
            onChange={(e) => setMyTeam(e.target.value)}
            className={`${field} w-full`}
          >
            {room.poolTeams.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
            <option value="">Not in last season's pool</option>
          </select>
          <span className="mt-1 block text-sm text-muted-foreground">
            Sets your slot from the draft order. Mocks of last season's teams leave yours out and
            put you in its place.
          </span>
        </label>
        {WEIGHT_UI.map(([k, label, min, max, step, fmt, help]) => (
          <label key={k} className="block">
            <span className="flex justify-between font-semibold">
              {label}
              <output className="num">{fmt(weights[k])}</output>
            </span>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={weights[k]}
              onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })}
              className="w-full accent-[var(--color-red)]"
            />
            <span className="block text-sm text-muted-foreground">{help}</span>
          </label>
        ))}
        <div>
          <button className={quiet} onClick={() => setWeights({ ...DEFAULT_WEIGHTS })}>
            Default weights
          </button>
        </div>
        {!mock && (
          <div className="space-y-3 rounded border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <ConfirmButton
                label="Clear all picks"
                confirmLabel="Tap again to clear every pick"
                disabled={busy || !started}
                onConfirm={() =>
                  run(async () => {
                    await clearPicks(room.draft.id);
                    await refresh();
                    toast("All picks cleared");
                    onClose();
                  })
                }
              />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="block">
                <span className="mb-1 block font-semibold">Start a new draft</span>
                <input
                  value={newId}
                  onChange={(e) => setNewId(e.target.value.trim())}
                  placeholder="2027-28"
                  className={`${field} w-32`}
                />
              </label>
              <ConfirmButton
                label="Start it"
                confirmLabel="Tap again to start"
                disabled={busy || !/^\d{4}-\d{2}$/.test(newId) || newId === room.draft.id}
                onConfirm={() =>
                  run(async () => {
                    await startDraft(newId);
                    await refresh();
                    toast(`The ${newId} draft is set up. Set the order when it's announced.`);
                    onClose();
                  })
                }
              />
            </div>
            <p className="text-sm text-muted-foreground">
              A new draft keeps the teams and names, with no picks and the order unlocked. This
              draft stays saved. Projections stay on this season's player data until it's refreshed.
            </p>
          </div>
        )}
        <Err error={error} />
        <div className="flex justify-end">
          <button className={primary} disabled={busy} onClick={done}>
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MockSheet({ onClose }: { onClose: () => void }) {
  const room = useRoom();
  const last = room.mock?.opts;
  const [style, setStyle] = useState<MockOpts["style"]>(last?.style ?? "teams");
  const [slot, setSlot] = useState<number | null>(last?.slot ?? null);
  const [speed, setSpeed] = useState<MockOpts["speed"]>(last?.speed ?? "watch");
  const [others, setOthers] = useState<MockOpts["others"]>(last?.others ?? "cpu");
  const [auto, setAuto] = useState(last?.auto ?? false);
  const n = mockTeamCount(style, room.poolTeams, room.myTeam, room.draft.teams);
  const m = room.mock;
  const mockTotal = m ? m.teams * m.rounds : 0;
  const inProgress = m && m.picks.length < mockTotal;
  const finished = m && m.picks.length >= mockTotal;
  const resume = () => {
    room.startMock(null);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogTitle className="text-3xl font-extrabold uppercase">Mock draft</DialogTitle>
        <DialogDescription className="text-base">
          Practice against {n - 1} computer teams. You make your own picks with the recommendations
          on screen; the others draft like people in a pool do. Your real draft isn't touched.
        </DialogDescription>
        {(inProgress || finished) && room.mode !== "mock" && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded bg-muted px-3 py-2">
            <span>
              {inProgress
                ? `You have a mock in progress (pick ${m!.picks.length + 1} of ${mockTotal}).`
                : "Your last mock is finished."}
            </span>
            <button className={quiet} onClick={resume}>
              {inProgress ? "Resume it" : "See its results and teams"}
            </button>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block font-semibold">Your slot</span>
            <select
              value={slot != null && slot <= n ? slot : ""}
              onChange={(e) => setSlot(e.target.value ? Number(e.target.value) : null)}
              className={`${field} w-full`}
            >
              <option value="">Random</option>
              {Array.from({ length: n }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-semibold">Pace</span>
            <select
              value={speed}
              onChange={(e) => setSpeed(e.target.value as MockOpts["speed"])}
              className={`${field} w-full`}
            >
              <option value="watch">Watch the picks go by</option>
              <option value="instant">Jump straight to my turn</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block font-semibold">Who makes the other teams' picks?</span>
          <select
            value={others}
            onChange={(e) => setOthers(e.target.value as MockOpts["others"])}
            className={`${field} w-full`}
          >
            <option value="cpu">Computer teams (practice on your own)</option>
            <option value="manual">
              We'll enter every pick ourselves (practice with your pool)
            </option>
          </select>
          <span className="mt-1 block text-sm text-muted-foreground">
            With “ourselves”, tap Pick next to each player as he's taken, just like the real draft.
            Pace, style and auto-pick only apply to computer teams.
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block font-semibold">How the computer teams draft</span>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as MockOpts["style"])}
            className={`${field} w-full`}
          >
            <option value="teams">
              Last season's {mockTeamCount("teams", room.poolTeams, room.myTeam, room.draft.teams)}{" "}
              teams by name, each with its own habits
            </option>
            <option value="mixed">Like your pool, unnamed</option>
            <option value="points">All off last season's points</option>
            <option value="proj">All off ESPN's projected points</option>
            <option value="espn">All off ESPN's rankings (average draft position)</option>
          </select>
          <span className="mt-1 block text-sm text-muted-foreground">
            Computer teams stray from the list about as much as your pool has, and last season's
            teams also get their own lean from their past drafts. No two mocks go the same way.
          </span>
        </label>
        <label className="flex items-center gap-3 font-semibold">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => setAuto(e.target.checked)}
            className="h-5 w-5"
          />
          Let the app make my picks
        </label>
        <p className="text-sm text-muted-foreground">
          {style === "teams"
            ? `${n} teams, the ones in last season's pool (your real draft is set to ${room.draft.teams}), ${room.draft.rounds} rounds and your weights.`
            : `Uses your settings: ${room.draft.teams} teams, ${room.draft.rounds} rounds, and your weights.`}
        </p>
        <div className="flex flex-wrap justify-between gap-2">
          <button className={quiet} onClick={onClose}>
            Cancel
          </button>
          <button
            className={primary}
            onClick={() => {
              room.startMock({ style, slot, speed, auto, others });
              onClose();
            }}
          >
            Start mock draft
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
