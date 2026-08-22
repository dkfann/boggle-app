import { memo } from 'react';
import { formatClock, useSecondsUntil } from '../game/useClock';

interface TimerProps {
  endsAt: number | null;
  clockOffset: number;
}

/**
 * Isolated so the once-a-second tick re-renders four characters, not the board.
 */
function Timer({ endsAt, clockOffset }: TimerProps) {
  const seconds = useSecondsUntil(endsAt, clockOffset);
  const urgent = seconds <= 30;

  return (
    <div className={`timer${urgent ? ' timer--urgent' : ''}`} role="timer" aria-live="off">
      <span className="timer__value">{formatClock(seconds)}</span>
      <span className="timer__label">left</span>
    </div>
  );
}

export default memo(Timer);
