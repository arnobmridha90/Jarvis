export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
export const isAndroid = /android/i.test(navigator.userAgent);
export const isDesktopApp = isTauri && !isAndroid;
