import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { readPlayerName, useGameActions, useGameState } from '../game/GameProvider';

export default function Home() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const state = useGameState();
  const actions = useGameActions();

  const [name, setName] = useState(readPlayerName);
  const [code, setCode] = useState(() => params.get('code')?.toUpperCase() ?? '');
  const [pending, setPending] = useState<'host' | 'join' | null>(null);

  // The server assigns the code; follow it once we are actually in a room.
  useEffect(() => {
    if (state.roomId) navigate(`/room/${state.roomId}`, { replace: true });
  }, [state.roomId, navigate]);

  // A rejected join (bad code, room full, round underway) frees the buttons again.
  useEffect(() => {
    if (state.error) setPending(null);
  }, [state.error]);

  const host = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setPending('host');
    actions.join(null, name.trim());
  };

  const join = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || code.trim().length < 4) return;
    setPending('join');
    actions.join(code.trim().toUpperCase(), name.trim());
  };

  const offline = state.status !== 'online';

  return (
    <main className="home">
      <header className="home__hero">
        <h1 className="home__title">Boggle</h1>
        <p className="home__tagline">90 seconds. One board. Duplicate words cancel out.</p>
      </header>

      {state.error && (
        <div className="alert" role="alert">
          <span>{state.error}</span>
          <button type="button" className="alert__close" onClick={actions.dismissError}>
            Dismiss
          </button>
        </div>
      )}

      <form className="card" onSubmit={host}>
        <label className="field">
          <span className="field__label">Your name</span>
          <input
            className="field__input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={16}
            placeholder="Alex"
            autoFocus
            autoComplete="nickname"
          />
        </label>

        <button type="submit" className="button button--block" disabled={!name.trim() || offline}>
          {pending === 'host' ? 'Creating room...' : 'Host a room'}
        </button>
      </form>

      <form className="card" onSubmit={join}>
        <label className="field">
          <span className="field__label">Join with a code</span>
          <input
            className="field__input field__input--code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 6))}
            placeholder="ABCDE"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button
          type="submit"
          className="button button--ghost button--block"
          disabled={!name.trim() || code.trim().length < 4 || offline}
        >
          {pending === 'join' ? 'Joining...' : 'Join room'}
        </button>
      </form>

      <p className="home__status">
        {state.status === 'online'
          ? 'Connected'
          : state.status === 'connecting'
            ? 'Connecting to the server...'
            : 'Offline - reconnecting...'}
      </p>
    </main>
  );
}
