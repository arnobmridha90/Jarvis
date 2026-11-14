import { getVersion } from "@tauri-apps/api/app";
import { isAndroid, isDesktopApp, isTauri } from "./platform";

/**
 * Update feed published by CI to the public "releases" bucket:
 * { version, notes, pub_date, platforms: { "windows-x86_64": { url, signature } }, android: { url } }
 */
const FEED = import.meta.env.VITE_UPDATE_FEED_URL as string | undefined;

export type UpdateState =
  | { kind: "none" }
  | { kind: "available"; version: string; notes?: string; install: () => Promise<void> }
  | { kind: "error"; message: string };

export async function currentVersion(): Promise<string> {
  return isTauri ? getVersion() : "web";
}

function newer(a: string, b: string) {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  return false;
}

export async function checkForUpdate(): Promise<UpdateState> {
  try {
    if (isDesktopApp) {
      // Windows: signed update, downloaded and installed in the background, then the app restarts.
      const { check } = await import("@tauri-apps/plugin-updater");
      const { relaunch } = await import("@tauri-apps/plugin-process");
      const update = await check();
      if (!update) return { kind: "none" };
      return {
        kind: "available", version: update.version, notes: update.body ?? undefined,
        install: async () => { await update.downloadAndInstall(); await relaunch(); },
      };
    }
    if (isAndroid && FEED) {
      // Android: Tauri can't self-install on Android, so we fetch the new APK and Android asks to install it.
      const res = await fetch(`${FEED}?t=${Date.now()}`, { cache: "no-store" });
      const feed = await res.json();
      const mine = await currentVersion();
      if (!feed?.android?.url || !newer(feed.version, mine)) return { kind: "none" };
      return {
        kind: "available", version: feed.version, notes: feed.notes,
        install: async () => {
          const { openUrl } = await import("@tauri-apps/plugin-opener");
          await openUrl(feed.android.url);
        },
      };
    }
    return { kind: "none" };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

/** Desktop installs quietly on launch; Android shows a banner. */
export async function autoUpdateOnLaunch(onAvailable: (s: UpdateState) => void) {
  const s = await checkForUpdate();
  if (s.kind !== "available") return;
  if (isDesktopApp) await s.install();
  else onAvailable(s);
}
