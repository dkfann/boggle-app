import { memo, useState } from 'react';
import type { GameMode, PlayerInfo } from '../../../shared/src/protocol';
import { DURATION_OPTIONS, GAME_MODE_OPTIONS } from '../../../shared/src/rules';
import { describeDuration } from '../game/formatDuration';

interface LobbyProps {
  roomId: string;
  players: PlayerInfo[];
  playerId: string;
  isHost: boolean;
  canStart: boolean;
  /** The room's current round length - the default, or whatever it was last started with. */
  durationMs: number;
  /** The room's current game mode - same lifecycle as durationMs. */
  mode: GameMode;
  onReady: (ready: boolean) => void;
  onStart: (durationMs: number, mode: GameMode) => void;
  onLeave: () => void;
}

function Lobby({
  roomId,
  players,
  playerId,
  isHost,
  canStart,
  durationMs,
  mode,
  onReady,
  onStart,
  onLeave,
}: LobbyProps) {
  const [copied, setCopied] = useState(false);
  // Only the host's pick matters - non-hosts just display the room's current
  // settings below, since there's nothing for them to choose.
  const [selectedDuration, setSelectedDuration] = useState(durationMs);
  const [selectedMode, setSelectedMode] = useState(mode);
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
          <h2>Round length</h2>
        </header>
        {isHost ? (
          <div className="tabs" role="radiogroup" aria-label="Round length">
            {DURATION_OPTIONS.map((option) => (
              <button
                key={option.ms}
                type="button"
                role="radio"
                aria-checked={selectedDuration === option.ms}
                className={`tabs__tab${selectedDuration === option.ms ? ' tabs__tab--on' : ''}`}
                onClick={() => setSelectedDuration(option.ms)}
              >
                {option.label} ({describeDuration(option.ms)})
              </button>
            ))}
          </div>
        ) : (
          <p className="empty">{describeDuration(durationMs)}, set by the host.</p>
        )}
      </section>

      <section className="panel">
        <header className="panel__header">
          <h2>Mode</h2>
        </header>
        {isHost ? (
          <div className="tabs" role="radiogroup" aria-label="Mode">
            {GAME_MODE_OPTIONS.map((option) => (
              <button
                key={option.mode}
                type="button"
                role="radio"
                aria-checked={selectedMode === option.mode}
                className={`tabs__tab${selectedMode === option.mode ? ' tabs__tab--on' : ''}`}
                onClick={() => setSelectedMode(option.mode)}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="empty">
            {GAME_MODE_OPTIONS.find((option) => option.mode === mode)?.label}, set by the host.
          </p>
        )}
      </section>

      <section className="panel">
        <header className="panel__header">
          <h2>How it works</h2>
        </header>
        <ul className="rules">
          <li>{describeDuration(isHost ? selectedDuration : durationMs)} on the clock.</li>
          {(isHost ? selectedMode : mode) === 'hidden' && (
            <li>{GAME_MODE_OPTIONS.find((option) => option.mode === 'hidden')?.description}</li>
          )}
          <li>Trace words through dice that touch - sideways, down or diagonally.</li>
          <li>No die twice in one word. Three letters minimum. Qu counts as two.</li>
          <li>3-4 letters score 1, 5 score 2, 6 score 3, 7 score 5, 8+ score 11.</li>
          <li>Any word two players both find is struck from both lists.</li>
        </ul>
      </section>

      <div className="lobby__actions">
        {isHost ? (
          <button
            type="button"
            className="button"
            onClick={() => onStart(selectedDuration, selectedMode)}
            disabled={!canStart}
          >
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
