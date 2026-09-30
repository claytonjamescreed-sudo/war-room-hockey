// What every part of the draft room reads: the draft on screen (real or mock), the engine's
// evaluation and recommendation for it, and the actions.
import { createContext, useContext } from "react";
import type {
  Ctx,
  DraftPick,
  DraftStatus,
  Evaluation,
  Recommendation,
  Settings,
} from "@/lib/engine";
import type { LiveDraft } from "@/lib/draft-live";
import type { Mock, MockOpts, PoolTeam, Prefs } from "@/lib/draft-room";

export type Room = {
  ctx: Ctx;
  poolTeams: PoolTeam[];
  mode: "real" | "mock";
  draft: LiveDraft;
  mock: Mock | null;
  settings: Settings;
  picks: DraftPick[];
  teamNames: Record<number, string>;
  prefs: Prefs;
  myTeam: string;
  ev: Evaluation;
  rec: Recommendation;
  status: DraftStatus;
  // A mock where computer teams make the other picks
  cpuMock: boolean;
  orderLocked: boolean;
  replacing: number | null;
  flash: number | null;
  teamLabel: (slot: number) => string;
  draftPlayer: (id: number | null, label?: string) => void;
  undo: () => void;
  setReplacing: (i: number | null) => void;
  toggleList: (key: "starred" | "avoid", id: number) => void;
  toggleContract: (id: number, on: boolean) => void;
  setPrefs: (fn: (p: Prefs) => Prefs) => void;
  tapSlot: (slot: number) => void;
  viewTeam: (slot: number) => void;
  openSheet: (sheet: "order" | "settings" | "mock" | null) => void;
  // null resumes the saved mock
  startMock: (opts: MockOpts | null) => void;
  exitMock: () => void;
  skipToMine: () => void;
};

export const RoomContext = createContext<Room | null>(null);

export function useRoom() {
  const r = useContext(RoomContext);
  if (!r) throw new Error("useRoom outside the draft room");
  return r;
}
