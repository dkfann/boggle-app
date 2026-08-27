import { memo } from 'react';
import { useSecondsUntil } from '../game/useClock';

interface CountdownProps {
  startsAt: number;
  clockOffset: number;
  label?: string;
  /**
   * 'overlay' blurs and covers the board - right for default mode, whose
   * board is concealed anyway. 'bar' sits in normal flow below the board
   * with no backdrop, for hidden mode, whose board is left fully visible on
   * purpose during this countdown so there is something to memorize.
   */
  variant?: 'overlay' | 'bar';
}

/**
 * The lead-in before play starts, so nobody gets a head start - either the
 * plain 3-2-1 "Get ready", or hidden mode's longer "Memorize the board".
 */
function Countdown({ startsAt, clockOffset, label = 'Get ready', variant = 'overlay' }: CountdownProps) {
  const seconds = useSecondsUntil(startsAt, clockOffset);

  return (
    <div
      className={`countdown${variant === 'bar' ? ' countdown--bar' : ''}`}
      role="status"
      aria-live="assertive"
    >
      <span className="countdown__number">{seconds > 0 ? seconds : 'Go'}</span>
      <span className="countdown__label">{label}</span>
    </div>
  );
}

export default memo(Countdown);
