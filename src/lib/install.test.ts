import { describe, expect, it } from "vitest";
import { deviceOf } from "./install";

const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/139.0.7258.76 Mobile/15E148 Safari/604.1",
  ipadDesktopSite:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15",
  android:
    "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0",
};

describe("deviceOf", () => {
  it("knows an iPhone in Safari or Chrome, and an iPad asking for the desktop site", () => {
    expect(deviceOf(UA.iphoneSafari, 5)).toBe("ios");
    expect(deviceOf(UA.iphoneChrome, 5)).toBe("ios");
    expect(deviceOf(UA.ipadDesktopSite, 5)).toBe("ios");
  });

  it("knows an Android phone", () => {
    expect(deviceOf(UA.android, 5)).toBe("android");
  });

  it("treats a Mac or PC as a computer", () => {
    expect(deviceOf(UA.mac, 0)).toBe("desktop");
    expect(deviceOf(UA.ipadDesktopSite, 0)).toBe("desktop"); // Safari on a Mac says the same
    expect(deviceOf(UA.windows)).toBe("desktop");
  });
});
