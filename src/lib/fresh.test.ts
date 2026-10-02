import { afterEach, describe, expect, it, vi } from "vitest";
import { freshStartFor, freshStartOnce, isStaleChunk, leaveOpen } from "./fresh";

function browser(storage = true) {
  const store = new Map<string, string>();
  const reload = vi.fn();
  const doc = { cookie: "" };
  vi.stubGlobal(
    "sessionStorage",
    storage
      ? {
          getItem: (k: string) => store.get(k) ?? null,
          setItem: (k: string, v: string) => void store.set(k, v),
        }
      : {
          getItem: () => {
            throw new Error("blocked");
          },
        },
  );
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", { location: { reload } });
  return { reload, doc };
}

describe("getting a stale page onto the newest version", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("recognises a browser that couldn't load part of the site's code", () => {
    // Chrome, Firefox, Safari, and Vite's own preload error
    expect(
      isStaleChunk(new TypeError("Failed to fetch dynamically imported module: https://x/a.js")),
    ).toBe(true);
    expect(isStaleChunk(new TypeError("error loading dynamically imported module: /a.js"))).toBe(
      true,
    );
    expect(isStaleChunk(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isStaleChunk(new Error("Unable to preload CSS for /assets/a.css"))).toBe(true);
    // An ordinary failure isn't one
    expect(isStaleChunk(new Error("Standings didn't load"))).toBe(false);
    expect(isStaleChunk(new TypeError("Failed to fetch"))).toBe(false);
    expect(isStaleChunk("nope")).toBe(false);
  });

  it("drops the version pin and reloads, but not again within a minute", () => {
    const { reload, doc } = browser();
    expect(freshStartOnce(1_000_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(doc.cookie).toBe("__dpl=; Max-Age=0; path=/; secure; samesite=lax");
    // A page that fails again straight away is really broken: show the error
    expect(freshStartOnce(1_030_000)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(freshStartOnce(1_061_000)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("doesn't reload on its own with no storage to keep count in", () => {
    const { reload } = browser(false);
    expect(freshStartOnce(1_000_000)).toBe(false);
    expect(freshStartFor("build2", "/")).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("updates on its own once for each new build", () => {
    const { reload, doc } = browser();
    expect(freshStartFor("build2", "/")).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(doc.cookie).toBe("__dpl=; Max-Age=0; path=/; secure; samesite=lax");
    // Still on the old build after that: the reload didn't work, so it's left to the button
    expect(freshStartFor("build2", "/race")).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    // The next publish gets its own try
    expect(freshStartFor("build3", "/race")).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("leaves the commissioner's pages and the TV board to the button", () => {
    const { reload } = browser();
    for (const path of ["/admin", "/draft", "/tv", "/admin/"]) {
      expect(leaveOpen(path)).toBe(true);
      expect(freshStartFor("build2", path)).toBe(false);
    }
    expect(reload).not.toHaveBeenCalled();
    for (const path of ["/", "/race", "/history", "/whats-new", "/tvguide"])
      expect(leaveOpen(path)).toBe(false);
    // Turned down on a commissioner's page, it still gets its try on a public one
    expect(freshStartFor("build2", "/")).toBe(true);
  });
});
