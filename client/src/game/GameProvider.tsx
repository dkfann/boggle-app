import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type {
  Board,
  BoardWord,
  ClientMessage,
  FoundWord,
  GamePhase,
  Path,
  PlayerInfo,
  PlayerResult,
  ServerMessage,
  WordRejection,
} from '../../../shared/src/protocol';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

export interface Feedback {
  /** Bumped on every result so repeated words restart the animation. */
  id: number;
  word: string;
  accepted: boolean;
  score: number;
  reason?: WordRejection;
}

export interface GameState {
  status: ConnectionStatus;
  roomId: string | null;
  hostId: string | null;
  playerId: string;
  players: PlayerInfo[];
  phase: GamePhase;
  board: Board | null;
  startsAt: number | null;
  endsAt: number | null;
  myWords: FoundWord[];
  myScore: number;
  results: PlayerResult[] | null;
  boardWords: BoardWord[] | null;
  feedback: Feedback | null;
  error: string | null;
  /** serverTime - clientTime, so the clock is honest even if the device is not. */
  clockOffset: number;
}

type Action =
  | { type: 'status'; status: ConnectionStatus }
  | { type: 'server'; message: ServerMessage }
  | { type: 'left' }
  | { type: 'dismiss_error' };

const PLAYER_ID_KEY = 'boggle.playerId';
const PLAYER_NAME_KEY = 'boggle.playerName';

/**
 * Identity lives in sessionStorage, not localStorage: it survives a reload
 * (so a refresh mid-round resumes the same seat) but gives each tab its own
 * player, which is what you want when two people share a machine.
 */
function readPlayerId(): string {
  const existing = sessionStorage.getItem(PLAYER_ID_KEY);
  if (existing) return existing;
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  sessionStorage.setItem(PLAYER_ID_KEY, id);
  return id;
}

export function readPlayerName(): string {
  return sessionStorage.getItem(PLAYER_NAME_KEY) ?? '';
}

export function writePlayerName(name: string): void {
  sessionStorage.setItem(PLAYER_NAME_KEY, name);
}

const initialState: GameState = {
  status: 'connecting',
  roomId: null,
  hostId: null,
  playerId: readPlayerId(),
  players: [],
  phase: 'lobby',
  board: null,
  startsAt: null,
  endsAt: null,
  myWords: [],
  myScore: 0,
  results: null,
  boardWords: null,
  feedback: null,
  error: null,
  clockOffset: 0,
};

let feedbackId = 0;

function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'status':
      return state.status === action.status ? state : { ...state, status: action.status };

    case 'left':
      return { ...initialState, playerId: state.playerId, status: state.status };

    case 'dismiss_error':
      return state.error === null ? state : { ...state, error: null };

    case 'server': {
      const message = action.message;
      switch (message.type) {
        case 'joined': {
          const room = message.room;
          return {
            ...state,
            error: null,
            roomId: room.id,
            hostId: room.hostId,
            players: room.players,
            phase: room.phase,
            board: room.board,
            startsAt: room.startsAt,
            endsAt: room.endsAt,
            // Newest first: the list reads as a feed while playing.
            myWords: [...room.yourWords].reverse(),
            myScore: room.yourScore,
            results: room.phase === 'ended' ? state.results : null,
            clockOffset: message.serverTime - Date.now(),
          };
        }

        case 'room_update':
          return { ...state, players: message.players, hostId: message.hostId };

        case 'game_started':
          return {
            ...state,
            phase: 'countdown',
            board: message.board,
            startsAt: message.startsAt,
            endsAt: message.endsAt,
            myWords: [],
            myScore: 0,
            results: null,
            boardWords: null,
            feedback: null,
            error: null,
            clockOffset: message.serverTime - Date.now(),
          };

        case 'word_accepted': {
          const myWords = [
            { word: message.word, score: message.score, path: message.path },
            ...state.myWords,
          ];
          return {
            ...state,
            myScore: message.total,
            myWords,
            // The server broadcasts score_update to everyone *else*, so our own
            // row on the scoreboard is ours to keep current.
            players: state.players.map((player) =>
              player.id === state.playerId
                ? { ...player, score: message.total, wordCount: myWords.length }
                : player
            ),
            feedback: {
              id: ++feedbackId,
              word: message.word,
              accepted: true,
              score: message.score,
            },
          };
        }

        case 'word_rejected':
          return {
            ...state,
            feedback: {
              id: ++feedbackId,
              word: message.word,
              accepted: false,
              score: 0,
              reason: message.reason,
            },
          };

        case 'score_update':
          return {
            ...state,
            players: state.players.map((player) =>
              player.id === message.playerId
                ? { ...player, score: message.score, wordCount: message.wordCount }
                : player
            ),
          };

        case 'game_ended':
          return {
            ...state,
            phase: 'ended',
            results: message.results,
            boardWords: message.boardWords,
            board: message.board,
            feedback: null,
          };

        case 'error':
          return { ...state, error: message.message };

        default:
          return state;
      }
    }

    default:
      return state;
  }
}

export interface GameActions {
  join: (roomId: string | null, name: string) => void;
  setReady: (ready: boolean) => void;
  start: () => void;
  submit: (word: string, path: Path) => void;
  leave: () => void;
  dismissError: () => void;
}

const StateContext = createContext<GameState | null>(null);
const ActionsContext = createContext<GameActions | null>(null);

const RECONNECT_DELAYS = [500, 1000, 2000, 4000, 8000];

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reduce, initialState);

  const socketRef = useRef<WebSocket | null>(null);
  /** What to re-join with after a drop. Null until the player picks a room. */
  const sessionRef = useRef<{ roomId: string | null; name: string } | null>(null);
  const attemptRef = useRef(0);
  const retryRef = useRef<number | null>(null);
  const closingRef = useRef(false);
  const playerId = state.playerId;

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState <= WebSocket.OPEN) return;

    dispatch({ type: 'status', status: 'connecting' });
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
    socketRef.current = socket;

    socket.onopen = () => {
      attemptRef.current = 0;
      dispatch({ type: 'status', status: 'online' });
      // Resume the seat we held before the drop, keeping words already found.
      const session = sessionRef.current;
      if (session) {
        socket.send(
          JSON.stringify({
            type: 'join',
            roomId: session.roomId,
            playerId,
            playerName: session.name,
          } satisfies ClientMessage)
        );
      }
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerMessage;
      // Remember the real room code so a reconnect rejoins instead of creating one.
      if (message.type === 'joined' && sessionRef.current) {
        sessionRef.current = { ...sessionRef.current, roomId: message.room.id };
      }
      dispatch({ type: 'server', message });
    };

    socket.onclose = () => {
      // Ignore a socket we already replaced or tore down (StrictMode remounts,
      // a fast reconnect) - only the current socket may drive the retry loop.
      if (socketRef.current !== socket) return;
      socketRef.current = null;
      if (closingRef.current) return;
      dispatch({ type: 'status', status: 'offline' });

      const delay = RECONNECT_DELAYS[Math.min(attemptRef.current, RECONNECT_DELAYS.length - 1)];
      attemptRef.current += 1;
      retryRef.current = window.setTimeout(connect, delay);
    };
  }, [playerId]);

  useEffect(() => {
    closingRef.current = false;
    connect();
    return () => {
      closingRef.current = true;
      if (retryRef.current) window.clearTimeout(retryRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [connect]);

  // Reconnect promptly when the tab comes back to life rather than waiting out the backoff.
  useEffect(() => {
    const wake = () => {
      if (document.visibilityState === 'visible' && !socketRef.current) {
        if (retryRef.current) window.clearTimeout(retryRef.current);
        attemptRef.current = 0;
        connect();
      }
    };
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => {
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
    };
  }, [connect]);

  const actions = useMemo<GameActions>(
    () => ({
      join: (roomId, name) => {
        writePlayerName(name);
        sessionRef.current = { roomId, name };
        send({ type: 'join', roomId, playerId, playerName: name });
      },
      setReady: (ready) => send({ type: 'set_ready', ready }),
      start: () => send({ type: 'start_game' }),
      submit: (word, path) => send({ type: 'submit_word', word, path }),
      leave: () => {
        send({ type: 'leave' });
        sessionRef.current = null;
        dispatch({ type: 'left' });
      },
      dismissError: () => dispatch({ type: 'dismiss_error' }),
    }),
    [send, playerId]
  );

  return (
    <StateContext.Provider value={state}>
      <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>
    </StateContext.Provider>
  );
}

export function useGameState(): GameState {
  const state = useContext(StateContext);
  if (!state) throw new Error('useGameState must be used inside <GameProvider>');
  return state;
}

/** Actions are referentially stable, so components that only act never re-render. */
export function useGameActions(): GameActions {
  const actions = useContext(ActionsContext);
  if (!actions) throw new Error('useGameActions must be used inside <GameProvider>');
  return actions;
}
