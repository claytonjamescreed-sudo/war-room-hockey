import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHANGELOG } from "../data/changelog";
import { builtAt, compareVersions, CURRENT, fmtBuilt } from "./release";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  version?: string;
};

describe("releases", () => {
  it("package.json's version is the newest release in the changelog", () => {
    expect(pkg.version).toBe(CURRENT.version);
    expect(CURRENT).toBe(CHANGELOG[0]);
  });

  it("every release has a version, a date and its changes, newest first", () => {
    expect(CHANGELOG.length).toBeGreaterThan(0);
    for (const r of CHANGELOG) {
      expect(r.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(r.date))).toBe(false);
      expect(r.title.trim()).not.toBe("");
      expect(r.changes.length).toBeGreaterThan(0);
      for (const c of r.changes) expect(c.text.trim()).toMatch(/[.!]$/);
    }
    for (let i = 1; i < CHANGELOG.length; i++) {
      expect(compareVersions(CHANGELOG[i - 1]!.version, CHANGELOG[i]!.version)).toBeGreaterThan(0);
      expect(CHANGELOG[i - 1]!.date >= CHANGELOG[i]!.date).toBe(true);
    }
  });

  it("compares versions as numbers", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareVersions("2.0.0", "1.99.99")).toBeGreaterThan(0);
    expect(compareVersions("1.0.1", "1.0.1")).toBe(0);
    expect(compareVersions("1.0.0", "1.0.1")).toBeLessThan(0);
  });

  it("reads the build's time from its stamp", () => {
    const at = Date.UTC(2026, 8, 30, 22, 41);
    expect(builtAt(at.toString(36))?.getTime()).toBe(at);
    expect(fmtBuilt(builtAt(at.toString(36))!)).toBe("Sep 30, 2026, 3:41 PM PT");
    expect(builtAt("")).toBeNull();
  });
});
