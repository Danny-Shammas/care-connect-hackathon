/**
 * Haptic feedback shim.
 * - Web: uses navigator.vibrate where available (Android Chrome).
 * - Native (future): swap this file for `@capacitor/haptics` calls. The
 *   function names below mirror Capacitor's API so the swap is mechanical.
 */

type Style = "light" | "medium" | "heavy" | "success" | "warning" | "error";

const PATTERNS: Record<Style, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 35,
  success: [12, 40, 12],
  warning: [20, 60, 20],
  error: [30, 80, 30, 80, 30],
};

export function impact(style: Style = "light") {
  if (typeof navigator === "undefined") return;
  // TODO(capacitor): replace with `Haptics.impact({ style: ImpactStyle.Light })`
  try {
    navigator.vibrate?.(PATTERNS[style]);
  } catch {
    /* ignore — non-fatal */
  }
}

export function selection() {
  // TODO(capacitor): replace with `Haptics.selectionStart()` / `selectionChanged()`
  impact("light");
}
