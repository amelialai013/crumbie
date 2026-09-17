/** Read the shared CSS motion scale for completion timers. Browser use only. */
export function motionDuration(token: "panel" | "media" | "exit", fallback: number): number {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--motion-${token}`).trim();
  const duration = Number.parseFloat(value);
  return Number.isFinite(duration) ? duration * (value.endsWith("ms") ? 1 : 1000) : fallback;
}
