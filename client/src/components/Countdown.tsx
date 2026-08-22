import { memo } from 'react';
import { useSecondsUntil } from '../game/useClock';

interface CountdownProps {
  startsAt: number;
  clockOffset: number;
}

/** The shared 3-2-1 before the dice are revealed, so nobody gets a head start. */
function Countdown({ startsAt, clockOffset }: CountdownProps) {
  const seconds = useSecondsUntil(startsAt, clockOffset);

  return (
    <div className="countdown" role="status" aria-live="assertive">
      <span className="countdown__number">{seconds > 0 ? seconds : 'Go'}</span>
      <span className="countdown__label">Get ready</span>
    </div>
  );
}

export default memo(Countdown);
