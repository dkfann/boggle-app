import { useEffect, useState } from 'react';

/**
 * Whole seconds left until a server timestamp, corrected for the difference
 * between the server's clock and this device's.
 *
 * Ticking is decoupled from the value: the interval runs four times a second so
 * the display flips promptly on the boundary, but state only changes when the
 * second actually changes, so React re-renders once per second, not four times.
 */
export function useSecondsUntil(target: number | null, clockOffset: number): number {
  const [seconds, setSeconds] = useState(() => secondsLeft(target, clockOffset));

  useEffect(() => {
    if (target === null) {
      setSeconds(0);
      return;
    }
    const tick = () => setSeconds(secondsLeft(target, clockOffset));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [target, clockOffset]);

  return seconds;
}

function secondsLeft(target: number | null, clockOffset: number): number {
  if (target === null) return 0;
  return Math.max(0, Math.ceil((target - (Date.now() + clockOffset)) / 1000));
}

export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * True once a server timestamp has passed. Flips with a single timeout rather
 * than a tick, so gating the board on the countdown costs one re-render.
 */
export function useHasPassed(target: number | null, clockOffset: number): boolean {
  const [passed, setPassed] = useState(() => target === null || Date.now() + clockOffset >= target);

  useEffect(() => {
    if (target === null) {
      setPassed(true);
      return;
    }
    const delay = target - (Date.now() + clockOffset);
    if (delay <= 0) {
      setPassed(true);
      return;
    }
    setPassed(false);
    const id = window.setTimeout(() => setPassed(true), delay);
    return () => window.clearTimeout(id);
  }, [target, clockOffset]);

  return passed;
}
