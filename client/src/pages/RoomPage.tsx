import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { readPlayerName, useGameActions, useGameState } from '../game/GameProvider';
import { useHasPassed } from '../game/useClock';
import Countdown from '../components/Countdown';
import FoundWords from '../components/FoundWords';
import Lobby from '../components/Lobby';
import PlayBoard from '../components/PlayBoard';
import Results from '../components/Results';
import Scoreboard from '../components/Scoreboard';
import Timer from '../components/Timer';

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const code = roomId?.toUpperCase() ?? '';
  const navigate = useNavigate();
  const state = useGameState();
  const actions = useGameActions();

  /** Guards against re-joining in a loop when the server turns us away. */
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (!code) {
      navigate('/', { replace: true });
      return;
    }
    if (state.roomId === code || attempted.current === code) return;

    const name = readPlayerName();
    if (!name) {
      // No name yet (a shared link opened cold): collect one first.
      navigate(`/?code=${code}`, { replace: true });
      return;
    }
    attempted.current = code;
    actions.join(code, name);
  }, [code, state.roomId, actions, navigate]);

  const leave = useCallback(() => {
    attempted.current = null;
    actions.leave();
    navigate('/', { replace: true });
  }, [actions, navigate]);

  const started = useHasPassed(state.startsAt, state.clockOffset);
  const isHost = state.hostId === state.playerId;
  const me = state.players.find((player) => player.id === state.playerId);
  const everyoneReady = state.players
    .filter((player) => player.connected)
    .every((player) => player.isReady || player.isHost);

  if (state.roomId !== code) {
    return (
      <main className="splash">
        {state.error ? (
          <>
            <h1>{state.error}</h1>
            <button type="button" className="button" onClick={() => navigate('/')}>
              Back to the start
            </button>
          </>
        ) : (
          <h1>Joining {code}...</h1>
        )}
      </main>
    );
  }

  if (state.phase === 'ended' && state.results && state.boardWords && state.board) {
    return (
      <main className="room">
        <Results
          results={state.results}
          boardWords={state.boardWords}
          board={state.board}
          playerId={state.playerId}
          isHost={isHost}
          canPlayAgain={everyoneReady}
          isReady={me?.isReady ?? false}
          durationMs={state.durationMs}
          onReady={actions.setReady}
          onPlayAgain={() => actions.start(state.durationMs)}
          onLeave={leave}
          chatMessages={state.chatMessages}
          onSendChat={actions.sendChat}
        />
      </main>
    );
  }

  // A player who joins between rounds sees 'ended' but has no results of their
  // own, so send them to the lobby rather than a dead, unplayable board.
  if (state.phase === 'lobby' || state.phase === 'ended' || !state.board) {
    return (
      <main className="room">
        <Lobby
          roomId={state.roomId}
          players={state.players}
          playerId={state.playerId}
          isHost={isHost}
          canStart={everyoneReady && state.status === 'online'}
          durationMs={state.durationMs}
          onReady={actions.setReady}
          onStart={actions.start}
          onLeave={leave}
        />
      </main>
    );
  }

  const playing = started && state.status === 'online';

  return (
    <main className="room room--playing">
      <header className="hud">
        <Timer endsAt={state.endsAt} clockOffset={state.clockOffset} />
        <div className="hud__meta">
          <span className="hud__code">{state.roomId}</span>
          {state.status !== 'online' && <span className="hud__warn">reconnecting</span>}
        </div>
        <div className="hud__score">
          <span className="hud__score-value">{state.myScore}</span>
          <span className="hud__score-label">points</span>
        </div>
      </header>

      <div className="stage">
        <div className="stage__board">
          <PlayBoard
            board={state.board}
            enabled={playing}
            concealed={!started}
            feedback={state.feedback}
          />
          {!started && state.startsAt !== null && (
            <Countdown startsAt={state.startsAt} clockOffset={state.clockOffset} />
          )}
        </div>

        <aside className="stage__side">
          <Scoreboard players={state.players} playerId={state.playerId} live />
          <FoundWords words={state.myWords} />
        </aside>
      </div>
    </main>
  );
}
