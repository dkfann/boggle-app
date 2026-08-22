import { memo, useMemo } from 'react';
import type { PlayerInfo } from '../../../shared/src/protocol';

interface ScoreboardProps {
  players: PlayerInfo[];
  playerId: string;
  /** During play the totals are provisional: duplicates are struck at the end. */
  live: boolean;
}

function Scoreboard({ players, playerId, live }: ScoreboardProps) {
  const ranked = useMemo(
    () => [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
    [players]
  );

  return (
    <section className="panel">
      <header className="panel__header">
        <h2>Scores</h2>
        {live && <span className="panel__note">before duplicates</span>}
      </header>
      <ul className="scores">
        {ranked.map((player) => (
          <li
            key={player.id}
            className={`scores__row${player.id === playerId ? ' scores__row--you' : ''}${
              player.connected ? '' : ' scores__row--away'
            }`}
          >
            <span className="scores__name">
              {player.name}
              {player.id === playerId && <span className="tag">you</span>}
              {!player.connected && <span className="tag tag--muted">offline</span>}
            </span>
            <span className="scores__words">{player.wordCount}w</span>
            <span className="scores__points">{player.score}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default memo(Scoreboard);
