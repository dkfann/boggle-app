import { memo, useState } from 'react';
import type { PlayerInfo } from '../../../shared/src/protocol';
import { GAME_DURATION_MS } from '../../../shared/src/rules';

/** "90 seconds" or "2 minutes" - whichever reads naturally for the configured duration. */
function describeDuration(ms: number): string {
  if (ms % 60_000 === 0) {
    const minutes = ms / 60_000;
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return `${ms / 1000} seconds`;
}

interface LobbyProps {
  roomId: string;
  players: PlayerInfo[];
  playerId: string;
  isHost: boolean;
  canStart: boolean;
  onReady: (ready: boolean) => void;
  onStart: () => void;
  onLeave: () => void;
}

function Lobby({
  roomId,
  players,
  playerId,
  isHost,
  canStart,
  onReady,
  onStart,
  onLeave,
}: LobbyProps) {
  const [copied, setCopied] = useState(false);
  const me = players.find((player) => player.id === playerId);

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="lobby">
      <section className="panel lobby__invite">
        <header className="panel__header">
          <h2>Room code</h2>
        </header>
        <p className="lobby__code">{roomId}</p>
        <button type="button" className="button button--ghost button--block" onClick={copyInvite}>
          {copied ? 'Link copied' : 'Copy invite link'}
        </button>
      </section>

      <section className="panel">
        <header className="panel__header">
          <h2>Players</h2>
          <span className="panel__note">{players.length}</span>
        </header>
        <ul className="scores">
          {players.map((player) => (
            <li key={player.id} className="scores__row">
              <span className="scores__name">
                {player.name}
                {player.id === playerId && <span className="tag">you</span>}
                {player.isHost && <span className="tag tag--muted">host</span>}
              </span>
              <span className={`ready${player.isHost || player.isReady ? ' ready--on' : ''}`}>
                {player.isHost ? 'hosting' : player.isReady ? 'ready' : 'waiting'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <header className="panel__header">
          <h2>How it works</h2>
        </header>
        <ul className="rules">
          <li>{describeDuration(GAME_DURATION_MS)} on the clock.</li>
          <li>Trace words through dice that touch - sideways, down or diagonally.</li>
          <li>No die twice in one word. Three letters minimum. Qu counts as two.</li>
          <li>3-4 letters score 1, 5 score 2, 6 score 3, 7 score 5, 8+ score 11.</li>
          <li>Any word two players both find is struck from both lists.</li>
        </ul>
      </section>

      <div className="lobby__actions">
        {isHost ? (
          <button type="button" className="button" onClick={onStart} disabled={!canStart}>
            Start round
          </button>
        ) : (
          <button
            type="button"
            className={me?.isReady ? 'button button--ghost' : 'button'}
            onClick={() => onReady(!me?.isReady)}
          >
            {me?.isReady ? "I'm not ready" : "I'm ready"}
          </button>
        )}
        <button type="button" className="button button--ghost" onClick={onLeave}>
          Leave
        </button>
      </div>
    </div>
  );
}

export default memo(Lobby);
