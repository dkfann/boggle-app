# Boggle

Real-time multiplayer Boggle. Host a room, share the code, and race the same
board for 90 seconds. Scoring follows the
[official rules](https://officialgamerules.org/game-rules/boggle/), including
the rule that trips people up most: any word two players both find is struck
from both lists.

When the round ends you get the full scoreboard **and** the answer key - every
word the board contained, split into what each player found and what they
missed, with a click-to-trace view showing where each word was hiding.

## Running it

```bash
npm run setup
```

```bash
npm run dev
```

The client runs on http://localhost:5173 and proxies `/ws` to the server on
3001. Open a second **tab** to play against yourself - identity is per-tab, so
two tabs are two players.

For a production build, `npm run build` then `npm start`, which serves the built
client and the WebSocket from a single origin on port 3001. `npm run build` is
self-sufficient - it installs `client/` and `server/` dependencies itself
(devDependencies included, regardless of `NODE_ENV`), so it works as a
platform's Build Command straight from a fresh clone with no separate install
step to configure.

```bash
npm test
```

## The rules, as implemented

| Rule | Where |
| --- | --- |
| 16 classic dice, shaken into a 4x4 tray | `shared/src/dice.ts` |
| Letters must adjoin sideways, down or diagonally | `NEIGHBORS` in `shared/src/rules.ts` |
| No die reused within one word | `isValidPath`, a 16-bit visited mask |
| Three letter minimum | `MIN_WORD_LENGTH` |
| `Qu` is one die but two letters | one face is the string `"Qu"` throughout |
| 3-4 = 1, 5 = 2, 6 = 3, 7 = 5, 8+ = 11 | `scoreWord` |
| Duplicate words struck from every list | `endRound` in `server/src/game.ts` |
| 90 second round | `GAME_DURATION_MS` |

Every rule lives in `shared/`, imported by both sides, so the client's instant
feedback and the server's authoritative ruling can never disagree.

### The dictionary

[ENABLE1](https://en.wikipedia.org/wiki/Moby_Project), 172,727 words of three
letters or more. It is the right list for these rules because it already
excludes what the rules exclude - proper nouns, abbreviations, contractions and
hyphenated forms - while keeping the plurals and verb forms the rules allow.

## How it is put together

```
shared/    protocol types + pure rules, the single source of truth
server/    ws + express; rooms, round clock, validation, board solver
client/    React 18 + Vite; one socket, one reducer
```

### Server

The dictionary is a prefix trie in flat `Int32Array`s (~388k nodes) rather than
a `Set` or a node-per-object tree. It answers both jobs the game has: an O(len)
check when a word is submitted, and the exhaustive board solve, which walks
prefixes millions of times and wants its children contiguous in memory.

Solving is depth-first from all 16 dice, descending the trie in lockstep with
the path so a dead prefix prunes the whole subtree. Visited dice are a bitmask,
the path and letter stacks are reused, and each word is claimed once by
generation-stamping its terminal node. A full solve is about 2ms, so it runs at
the *start* of the round, during the countdown - the answer key is already in
hand when the clock stops.

The server is the only authority on a word: it re-checks the clock, the path,
the adjacency, the reuse rule and the dictionary for every submission.
Connections are rate limited, payload capped, and heartbeated so dead sockets
do not linger in a room.

### Client

One WebSocket for the whole app, held by `GameProvider` above the router, so
moving between the lobby and a round never tears down the connection. It
reconnects with backoff, wakes immediately when the tab regains focus, and
re-joins with the same identity - a mid-round reload keeps your seat and every
word you had found.

State and actions are separate contexts, and actions are referentially stable,
so a component that only *does* things never re-renders when state changes.

Rendering is kept deliberately narrow:

- **Selection lives in the board subtree.** Tracing a word re-renders the dice
  and nothing else - not the scoreboard, not the timer, not the word list.
- **The clock is its own leaf.** It ticks four times a second but only changes
  state when the displayed second changes, so it re-renders once a second and
  drags nothing with it.
- **The countdown gate is one timeout, not a tick**, so revealing the board
  costs a single re-render.
- **Pointer handling reads geometry once per gesture** and ignores moves that
  stay inside the current die, so a drag does no layout work.
- Panels are `memo`ed with stable props; derived lists (missed words, traces)
  are memoized.

Opponents' scores update live, but never their words - that would hand over the
board.

Hit-testing gives each die a shrunk inner "core" ([`gridMath.ts`](client/src/game/gridMath.ts))
rather than a plain rectangular lookup. A diagonal drag's straight-line path
passes almost exactly through the corner shared by four dice, so ordinary hand
tremor is enough to clip an orthogonal neighbour's rectangle on the way
through; a cell only counts as selected once the pointer is confidently past
its border, not just across it. `npm test` includes a deterministic replay of
that geometry against every diagonal pair on the board under a simulated
tremor.

### Playing

Drag across the dice, or tap them one at a time and tap the last die again to
submit. `Enter` submits, `Escape` clears. Every die is a real focusable button,
so the board is playable from the keyboard.
