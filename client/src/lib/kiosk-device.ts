/** Maps Apple hardware identifiers (from Capacitor) to Envoy-style friendly names. */
const IPAD_MODEL_NAMES: Record<string, string> = {
  "iPad6,11": "iPad (5th gen)",
  "iPad6,12": "iPad (5th gen)",
  "iPad7,5": "iPad (6th gen)",
  "iPad7,6": "iPad (6th gen)",
  "iPad7,11": "iPad (7th gen)",
  "iPad7,12": "iPad (7th gen)",
  "iPad11,6": "iPad (8th gen)",
  "iPad11,7": "iPad (8th gen)",
  "iPad12,1": "iPad (9th gen)",
  "iPad12,2": "iPad (9th gen)",
  "iPad13,18": "iPad (10th gen)",
  "iPad13,19": "iPad (10th gen)",
  "iPad8,1": "iPad Pro 11\" (1st gen)",
  "iPad8,2": "iPad Pro 11\" (1st gen)",
  "iPad8,3": "iPad Pro 11\" (1st gen)",
  "iPad8,4": "iPad Pro 11\" (1st gen)",
  "iPad8,9": "iPad Pro 11\" (2nd gen)",
  "iPad8,10": "iPad Pro 11\" (2nd gen)",
  "iPad13,4": "iPad Pro 11\" (3rd gen)",
  "iPad13,5": "iPad Pro 11\" (3rd gen)",
  "iPad13,6": "iPad Pro 11\" (3rd gen)",
  "iPad13,7": "iPad Pro 11\" (3rd gen)",
  "iPad14,3": "iPad Pro 11\" (4th gen)",
  "iPad14,4": "iPad Pro 11\" (4th gen)",
  "iPad16,3": "iPad Pro 11\" (M4)",
  "iPad16,4": "iPad Pro 11\" (M4)",
  "iPad8,5": "iPad Pro 12.9\" (3rd gen)",
  "iPad8,6": "iPad Pro 12.9\" (3rd gen)",
  "iPad8,7": "iPad Pro 12.9\" (3rd gen)",
  "iPad8,8": "iPad Pro 12.9\" (3rd gen)",
  "iPad13,8": "iPad Pro 12.9\" (5th gen)",
  "iPad13,9": "iPad Pro 12.9\" (5th gen)",
  "iPad13,10": "iPad Pro 12.9\" (5th gen)",
  "iPad13,11": "iPad Pro 12.9\" (5th gen)",
  "iPad14,5": "iPad Pro 12.9\" (6th gen)",
  "iPad14,6": "iPad Pro 12.9\" (6th gen)",
  "iPad16,5": "iPad Pro 13\" (M4)",
  "iPad16,6": "iPad Pro 13\" (M4)",
  "iPad11,1": "iPad mini (5th gen)",
  "iPad11,2": "iPad mini (5th gen)",
  "iPad14,1": "iPad mini (6th gen)",
  "iPad14,2": "iPad mini (6th gen)",
  "iPad13,1": "iPad Air (4th gen)",
  "iPad13,2": "iPad Air (4th gen)",
  "iPad13,16": "iPad Air (5th gen)",
  "iPad13,17": "iPad Air (5th gen)",
};

const WEB_APP_VERSION = "1.0.0";

export function friendlyIpadModel(raw: string): string {
  return IPAD_MODEL_NAMES[raw] ?? raw;
}

/** iPadOS 13+ Safari reports as Macintosh — detect touch-capable "Mac" UAs. */
export function isLikelyIpad(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (ua.includes("iPad")) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function parseDeviceInfoFromUA(ua: string): { deviceType: string; osVersion: string } {
  if (isLikelyIpad()) {
    const versionMatch = ua.match(/Version\/(\d+\.\d+(?:\.\d+)?)/);
    const osMatch = ua.match(/(?:CPU OS|Mac OS X) (\d+)[_.](\d+)(?:[_.](\d+))?/);
    const ver =
      versionMatch?.[1] ??
      (osMatch ? `${osMatch[1]}.${osMatch[2]}${osMatch[3] ? `.${osMatch[3]}` : ""}` : "Unknown");
    return { deviceType: "iPad", osVersion: `iPadOS ${ver}` };
  }
  if (ua.includes("iPhone")) {
    const m = ua.match(/CPU iPhone OS (\d+)[_.](\d+)(?:[_.](\d+))?/);
    const ver = m ? `${m[1]}.${m[2]}${m[3] ? `.${m[3]}` : ""}` : "Unknown";
    return { deviceType: "iPhone", osVersion: `iOS ${ver}` };
  }
  if (ua.includes("Android")) {
    const m = ua.match(/Android (\d+\.?\d*)/);
    const ver = m ? m[1] : "Unknown";
    return { deviceType: "Android Tablet", osVersion: `Android ${ver}` };
  }
  if (ua.includes("Windows")) return { deviceType: "Windows PC", osVersion: "Windows" };
  if (ua.includes("Macintosh")) return { deviceType: "Mac", osVersion: "macOS" };
  return { deviceType: "Unknown", osVersion: "Unknown" };
}

async function getNativeAppVersion(): Promise<string | null> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return null;
    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    return info.version || null;
  } catch {
    return null;
  }
}

export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem("kioskDeviceId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("kioskDeviceId", id);
  }
  return id;
}

export interface KioskDeviceInfo {
  deviceId: string;
  deviceType: string;
  osVersion: string;
  appVersion: string;
  isNative: boolean;
  nativeDeviceName?: string;
}

/**
 * Returns accurate device info using native Capacitor APIs when running inside
 * the iOS/Android shell, with improved browser fallbacks for iPadOS Safari.
 */
export async function getKioskDeviceInfo(): Promise<KioskDeviceInfo> {
  const nativeAppVersion = await getNativeAppVersion();

  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { Device } = await import("@capacitor/device");
      const [info, idResult] = await Promise.all([Device.getInfo(), Device.getId()]);
      const hwId = idResult.identifier;
      localStorage.setItem("kioskDeviceId", hwId);
      const osLabel = info.operatingSystem === "ios" ? "iPadOS" : info.operatingSystem;
      const rawModel = info.model || "iPad";
      const deviceType =
        info.operatingSystem === "ios" ? friendlyIpadModel(rawModel) : rawModel;
      return {
        deviceId: hwId,
        deviceType,
        osVersion: `${osLabel} ${info.osVersion}`,
        appVersion: nativeAppVersion ?? WEB_APP_VERSION,
        isNative: true,
        nativeDeviceName: info.name || undefined,
      };
    }
  } catch {
    // Fall through to browser detection
  }

  const uaInfo = parseDeviceInfoFromUA(navigator.userAgent);
  return {
    deviceId: getOrCreateDeviceId(),
    ...uaInfo,
    appVersion: nativeAppVersion ?? WEB_APP_VERSION,
    isNative: false,
  };
}
