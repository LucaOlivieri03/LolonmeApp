import { describe, expect, it } from "vitest";
import {
  detectPwaPlatform,
  isStandaloneDisplayMode,
  resolveInstallAction,
} from "./install";

describe("detectPwaPlatform", () => {
  it("detects iOS Safari on iPhone", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
    expect(detectPwaPlatform(ua, 5)).toBe("ios-safari");
  });

  it("detects iPadOS desktop-mode Safari via maxTouchPoints", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
    expect(detectPwaPlatform(ua, 5)).toBe("ios-safari");
  });

  it("does not misclassify macOS desktop Safari as iOS", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
    expect(detectPwaPlatform(ua, 0)).toBe("desktop");
  });

  it("detects Chrome on iOS as ios-other", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.80 Mobile/15E148 Safari/604.1";
    expect(detectPwaPlatform(ua, 5)).toBe("ios-other");
  });

  it("detects Android Chrome", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";
    expect(detectPwaPlatform(ua, 5)).toBe("android");
  });

  it("detects desktop Chrome", () => {
    const ua =
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
    expect(detectPwaPlatform(ua, 0)).toBe("desktop");
  });
});

describe("isStandaloneDisplayMode", () => {
  it("returns true when display-mode media query matches standalone", () => {
    expect(
      isStandaloneDisplayMode({
        matchMediaStandalone: true,
        navigatorStandalone: false,
      })
    ).toBe(true);
  });

  it("returns true when iOS navigator.standalone is true", () => {
    expect(
      isStandaloneDisplayMode({
        matchMediaStandalone: false,
        navigatorStandalone: true,
      })
    ).toBe(true);
  });

  it("returns false when running in a regular browser tab", () => {
    expect(
      isStandaloneDisplayMode({
        matchMediaStandalone: false,
        navigatorStandalone: false,
      })
    ).toBe(false);
  });
});

describe("resolveInstallAction", () => {
  it("hides install affordances when already standalone", () => {
    expect(
      resolveInstallAction({
        isStandalone: true,
        hasDeferredPrompt: true,
        platform: "android",
      })
    ).toBe("hidden");
  });

  it("uses native-prompt whenever beforeinstallprompt was captured", () => {
    expect(
      resolveInstallAction({
        isStandalone: false,
        hasDeferredPrompt: true,
        platform: "android",
      })
    ).toBe("native-prompt");

    expect(
      resolveInstallAction({
        isStandalone: false,
        hasDeferredPrompt: true,
        platform: "desktop",
      })
    ).toBe("native-prompt");
  });

  it("uses ios-guide on iOS when no native prompt exists", () => {
    expect(
      resolveInstallAction({
        isStandalone: false,
        hasDeferredPrompt: false,
        platform: "ios-safari",
      })
    ).toBe("ios-guide");

    expect(
      resolveInstallAction({
        isStandalone: false,
        hasDeferredPrompt: false,
        platform: "ios-other",
      })
    ).toBe("ios-guide");
  });

  it("falls back to manual-guide on non-iOS browsers without beforeinstallprompt", () => {
    expect(
      resolveInstallAction({
        isStandalone: false,
        hasDeferredPrompt: false,
        platform: "android",
      })
    ).toBe("manual-guide");

    expect(
      resolveInstallAction({
        isStandalone: false,
        hasDeferredPrompt: false,
        platform: "desktop",
      })
    ).toBe("manual-guide");
  });
});
