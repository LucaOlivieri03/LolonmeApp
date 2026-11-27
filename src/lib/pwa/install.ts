export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export type PwaPlatform = "ios-safari" | "ios-other" | "android" | "desktop";

export type InstallAction =
  | "hidden"
  | "native-prompt"
  | "ios-guide"
  | "manual-guide";

export function detectPwaPlatform(
  userAgent: string,
  maxTouchPoints = 0
): PwaPlatform {
  const isIosDevice =
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);

  if (isIosDevice) {
    const isSafari =
      /Safari/i.test(userAgent) &&
      !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(userAgent);
    return isSafari ? "ios-safari" : "ios-other";
  }

  if (/Android/i.test(userAgent)) {
    return "android";
  }

  return "desktop";
}

export function isStandaloneDisplayMode(input: {
  matchMediaStandalone: boolean;
  navigatorStandalone?: boolean;
}): boolean {
  return Boolean(input.matchMediaStandalone || input.navigatorStandalone);
}

export function resolveInstallAction(input: {
  isStandalone: boolean;
  hasDeferredPrompt: boolean;
  platform: PwaPlatform;
}): InstallAction {
  if (input.isStandalone) {
    return "hidden";
  }

  if (input.hasDeferredPrompt) {
    return "native-prompt";
  }

  if (input.platform === "ios-safari" || input.platform === "ios-other") {
    return "ios-guide";
  }

  return "manual-guide";
}
