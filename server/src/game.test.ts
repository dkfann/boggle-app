import test from 'node:test';
import assert from 'node:assert/strict';
import { MEMORIZE_MS, isValidPath, pathToWord } from '../../shared/src/rules.js';
import { rollBoard } from '../../shared/src/dice.js';
import { loadDictionary } from './dictionary.js';
import { solveBoard } from './solver.js';
import { addChatMessage, addPlayer, createRoom, type Room } from './rooms.js';
import { endRound, startRound, submitWord, type SubmitResult } from './game.js';

/** Narrow to the rejection reason, so a wrongly accepted word fails loudly. */
function rejection(result: SubmitResult): string {
  return result.ok ? `accepted (${result.score} pts)` : result.reason;
}

const trie = loadDictionary();

//   Qu I  T  S
//   A  E  R  N
//   D  L  O  P
//   C  H  M  B
const BOARD = ['Qu', 'I', 'T', 'S', 'A', 'E', 'R', 'N', 'D', 'L', 'O', 'P', 'C', 'H', 'M', 'B'];

function playingRoom(board = BOARD): Room {
  const room = createRoom({ id: 'host-player', name: 'Host' });
  room.board = board;
  room.boardWords = solveBoard(board, trie);
  room.phase = 'playing';
  room.startsAt = Date.now() - 1_000;
  room.endsAt = Date.now() + 60_000;
  return room;
}

test('dictionary matches what the official rules allow', () => {
  assert.ok(trie.has('QUIT'));
  assert.ok(trie.has('CATS'), 'plurals are allowed');
  assert.ok(trie.has('RUNNING'), 'verb forms are allowed');
  assert.ok(!trie.has('LONDON'), 'proper nouns are excluded');
  assert.ok(!trie.has('ISNT'), 'contractions are excluded');
  assert.ok(!trie.has('AT'), 'words under three letters are not in play');
  assert.ok(!trie.has('ZZZZZ'));
});

test('solver finds only real words, each on a legal path', () => {
  const words = solveBoard(BOARD, trie);
  assert.ok(words.length > 100, `expected a rich board, got ${words.length} words`);

  const seen = new Set<string>();
  for (const entry of words) {
    assert.ok(entry.word.length >= 3, `${entry.word} is too short`);
    assert.ok(trie.has(entry.word), `${entry.word} is not in the dictionary`);
    assert.ok(isValidPath(entry.path), `${entry.word} has an illegal path`);
    assert.equal(pathToWord(BOARD, entry.path), entry.word, `${entry.word} path does not spell it`);
    assert.ok(!seen.has(entry.word), `${entry.word} was reported twice`);
    seen.add(entry.word);
  }
});

test('solver walks the Qu die as two letters', () => {
  const words = solveBoard(BOARD, trie);
  const found = new Set(words.map((entry) => entry.word));
  assert.ok(found.has('QUIT'), 'QUIT is spelled Qu-I-T across three dice');
  assert.ok(!found.has('QIS'), 'the Q die cannot be used without its U');
});

test('solver results are ordered highest scoring first', () => {
  const words = solveBoard(BOARD, trie);
  for (let i = 1; i < words.length; i++) {
    assert.ok(words[i - 1].score >= words[i].score, 'scores must not increase down the list');
  }
});

test('solver keeps up with back-to-back rounds', () => {
  const started = Date.now();
  for (let i = 0; i < 100; i++) solveBoard(rollBoard(), trie);
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 2_000, `100 solves took ${elapsed}ms, which would stall a round start`);
});

test('a word must be on the board, in the dictionary, and long enough', () => {
  const room = playingRoom();
  addPlayer(room, 'p2', 'Rival');

  assert.equal(submitWord(room, 'host-player', 'QUIT', [0, 1, 2]).ok, true, 'valid word');

  assert.deepEqual(submitWord(room, 'host-player', 'QUIT', [0, 1, 2]), {
    ok: false,
    word: 'QUIT',
    reason: 'already-found',
  });

  assert.equal(rejection(submitWord(room, 'host-player', 'IT', [1, 2])), 'too-short');
  assert.equal(
    rejection(submitWord(room, 'host-player', 'TIE', [2, 1, 6])),
    'not-on-board',
    'the path spells TIR, not TIE'
  );
  assert.equal(
    rejection(submitWord(room, 'host-player', 'TIS', [2, 1, 3])),
    'not-on-board',
    'cells must adjoin'
  );
  assert.equal(rejection(submitWord(room, 'host-player', 'SRE', [3, 6, 5])), 'not-a-word');
  assert.equal(rejection(submitWord(room, 'nobody', 'QUIT', [0, 1, 2])), 'not-playing');
});

test('submissions are refused outside the running clock', () => {
  const room = playingRoom();

  room.phase = 'countdown';
  assert.equal(
    rejection(submitWord(room, 'host-player', 'QUIT', [0, 1, 2])),
    'not-playing',
    'before the board is revealed'
  );

  room.phase = 'playing';
  room.endsAt = Date.now() - 1;
  assert.equal(
    rejection(submitWord(room, 'host-player', 'QUIT', [0, 1, 2])),
    'not-playing',
    'after time is up'
  );
});

test('words found by more than one player are struck from every list', () => {
  const room = playingRoom();
  addPlayer(room, 'p2', 'Rival');

  // Both players find TIRE (4 letters, 1 point); only the host finds QUIT.
  assert.ok(submitWord(room, 'host-player', 'QUIT', [0, 1, 2]).ok);
  assert.ok(submitWord(room, 'host-player', 'TIRE', [2, 1, 6, 5]).ok);
  assert.ok(submitWord(room, 'p2', 'TIRE', [2, 1, 6, 5]).ok);

  const results = endRound(room);
  const host = results.find((r) => r.playerId === 'host-player')!;
  const rival = results.find((r) => r.playerId === 'p2')!;

  assert.equal(host.rawScore, 2, 'both words counted before cancellation');
  assert.equal(host.totalScore, 1, 'TIRE is struck, QUIT survives');
  assert.equal(rival.rawScore, 1);
  assert.equal(rival.totalScore, 0, 'the rival is left with nothing');

  assert.equal(host.words.find((w) => w.word === 'TIRE')!.duplicate, true);
  assert.equal(host.words.find((w) => w.word === 'QUIT')!.duplicate, false);
  assert.equal(results[0].playerId, 'host-player', 'results are ranked by final score');
});

test('starting a round clears the previous one and hands out a fresh board', () => {
  const room = playingRoom();
  assert.ok(submitWord(room, 'host-player', 'QUIT', [0, 1, 2]).ok);
  endRound(room);

  startRound(room);
  const host = room.players.get('host-player')!;

  assert.equal(host.score, 0, 'scores reset');
  assert.equal(host.words.size, 0, 'word lists reset');
  assert.equal(room.phase, 'countdown');
  assert.equal(room.board!.length, 16);
  assert.ok(room.boardWords!.length > 0, 'the answer key is ready before play begins');
  assert.equal(
    room.endsAt! - room.startsAt!,
    room.durationMs,
    'the round runs for exactly the room-configured duration'
  );

  if (room.timer) clearTimeout(room.timer);
});

test('hidden mode swaps the lead-in for a longer memorize window, without eating into the round', () => {
  const room = playingRoom();
  room.mode = 'hidden';
  const before = Date.now();

  startRound(room);

  // Two separate Date.now() calls, so allow a little slack rather than
  // asserting exact equality against a value computed a moment earlier.
  const leadIn = room.startsAt! - before;
  assert.ok(
    leadIn >= MEMORIZE_MS && leadIn <= MEMORIZE_MS + 50,
    `lead-in should be ~${MEMORIZE_MS}ms, got ${leadIn}ms`
  );
  assert.equal(
    room.endsAt! - room.startsAt!,
    room.durationMs,
    'the memorize window is not deducted from the round duration'
  );

  if (room.timer) clearTimeout(room.timer);
});

test('chat only works once a round has ended, to keep hints out of live play', () => {
  const room = playingRoom(); // phase: 'playing'
  assert.equal(addChatMessage(room, 'host-player', 'nice board'), null, 'refused mid-round');

  room.phase = 'lobby';
  assert.equal(addChatMessage(room, 'host-player', 'gg'), null, 'refused before a round starts');

  room.phase = 'ended';
  const message = addChatMessage(room, 'host-player', 'gg all');
  assert.ok(message, 'accepted once the round has ended');
  assert.equal(message!.text, 'gg all');
  assert.equal(message!.playerId, 'host-player');
  assert.equal(message!.playerName, 'Host', 'name is resolved server-side, not trusted from the client');
  assert.equal(room.chatMessages.length, 1);
});

test('chat refuses empty text and unknown players', () => {
  const room = playingRoom();
  room.phase = 'ended';

  assert.equal(addChatMessage(room, 'host-player', ''), null, 'empty text refused');
  assert.equal(addChatMessage(room, 'nobody', 'hi'), null, 'unknown player refused');
  assert.equal(room.chatMessages.length, 0);
});

test('a fresh round clears the previous one\'s chat', () => {
  const room = playingRoom();
  room.phase = 'ended';
  addChatMessage(room, 'host-player', 'well played');
  assert.equal(room.chatMessages.length, 1);

  startRound(room);
  assert.equal(room.chatMessages.length, 0, 'chat resets alongside scores and words');

  if (room.timer) clearTimeout(room.timer);
});

test('chat history is capped rather than growing without bound', () => {
  const room = playingRoom();
  room.phase = 'ended';

  for (let i = 0; i < 205; i++) {
    addChatMessage(room, 'host-player', `message ${i}`);
  }

  assert.equal(room.chatMessages.length, 200, 'oldest messages fall off past the cap');
  assert.equal(room.chatMessages[0].text, 'message 5', 'the earliest 5 were dropped');
  assert.equal(room.chatMessages.at(-1)!.text, 'message 204', 'the newest is kept');
});
