import { Board, Path } from './rules.js';

export type { Board, Path };

export type GamePhase = 'lobby' | 'countdown' | 'playing' | 'ended';

export interface PlayerInfo {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
  connected: boolean;
  /** Live running score, before end-of-game duplicate cancellation. */
  score: number;
  wordCount: number;
}

/** A word the player successfully claimed during the round. */
export interface FoundWord {
  word: string;
  score: number;
  path: Path;
}

/** One word that exists on the board, with a path proving it. */
export interface BoardWord {
  word: string;
  score: number;
  path: Path;
}

export interface ScoredWord {
  word: string;
  score: number;
  /** True when another player also found this word, which strikes it per official rules. */
  duplicate: boolean;
}

export interface PlayerResult {
  playerId: string;
  playerName: string;
  words: ScoredWord[];
  /** Sum of every word found, before duplicates are struck. */
  rawScore: number;
  /** Official score: duplicates struck from every list. */
  totalScore: number;
}

/**
 * A chat message, only exchangeable once a round has ended - see
 * rooms.ts#addChatMessage. Letting it run during play would let players
 * trade real-time hints and undermine the duplicate-word scoring rule.
 */
export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  sentAt: number;
}

export interface RoomState {
  id: string;
  hostId: string;
  players: PlayerInfo[];
  phase: GamePhase;
  board: Board | null;
  /** Server clock timestamps; the client corrects for its own clock offset. */
  startsAt: number | null;
  endsAt: number | null;
  yourPlayerId: string;
  yourWords: FoundWord[];
  yourScore: number;
  chatMessages: ChatMessage[];
}

export type WordRejection =
  | 'too-short'
  | 'already-found'
  | 'not-on-board'
  | 'not-a-word'
  | 'not-playing';

export type ClientMessage =
  | { type: 'join'; roomId: string | null; playerId: string; playerName: string }
  | { type: 'set_ready'; ready: boolean }
  | { type: 'start_game' }
  | { type: 'submit_word'; word: string; path: Path }
  | { type: 'send_chat'; text: string }
  | { type: 'leave' }
  | { type: 'pong' };

export type ServerMessage =
  | { type: 'joined'; room: RoomState; serverTime: number }
  | { type: 'room_update'; players: PlayerInfo[]; hostId: string }
  | {
      type: 'game_started';
      board: Board;
      startsAt: number;
      endsAt: number;
      serverTime: number;
    }
  | { type: 'word_accepted'; word: string; score: number; path: Path; total: number }
  | { type: 'word_rejected'; word: string; reason: WordRejection }
  | { type: 'score_update'; playerId: string; score: number; wordCount: number }
  | {
      type: 'game_ended';
      results: PlayerResult[];
      /** Every word the board contained, sent once; clients derive each player's misses. */
      boardWords: BoardWord[];
      board: Board;
    }
  | { type: 'chat_message'; message: ChatMessage }
  | { type: 'error'; message: string }
  | { type: 'ping' };

export const REJECTION_TEXT: Record<WordRejection, string> = {
  'too-short': 'Too short',
  'already-found': 'Already found',
  'not-on-board': 'Not on the board',
  'not-a-word': 'Not in dictionary',
  'not-playing': 'Round is not running',
};
