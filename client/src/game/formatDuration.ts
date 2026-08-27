/** "90 seconds" or "3 minutes" - whichever reads naturally for the given duration. */
export function describeDuration(ms: number): string {
  if (ms % 60_000 === 0) {
    const minutes = ms / 60_000;
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return `${ms / 1000} seconds`;
}
