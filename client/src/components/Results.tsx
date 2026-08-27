import { memo, useMemo, useState } from 'react';
import type { Board, BoardWord, ChatMessage, GameMode, PlayerResult } from '../../../shared/src/protocol';
import { GAME_MODE_OPTIONS } from '../../../shared/src/rules';
import BoardGrid from './BoardGrid';
import Chat from './Chat';
import { useWordDefinition } from '../game/useWordDefinition';
import { DEFINITIONS_ENABLED } from '../game/featureFlags';
import { describeDuration } from '../game/formatDuration';

interface ResultsProps {
  results: PlayerResult[];
  boardWords: BoardWord[];
  board: Board;
  playerId: string;
  isHost: boolean;
  canPlayAgain: boolean;
  isReady: boolean;
  durationMs: number;
  mode: GameMode;
  onReady: (ready: boolean) => void;
  onPlayAgain: () => void;
  onLeave: () => void;
  chatMessages: ChatMessage[];
  onSendChat: (text: string) => void;
}

const MISSED_PREVIEW = 60;

function Results({
  results,
  boardWords,
  board,
  playerId,
  isHost,
  canPlayAgain,
  isReady,
  durationMs,
  mode,
  onReady,
  onPlayAgain,
  onLeave,
  chatMessages,
  onSendChat,
}: ResultsProps) {
  const [selectedId, setSelectedId] = useState(
    () => results.find((r) => r.playerId === playerId)?.playerId ?? results[0]?.playerId ?? ''
  );
  /**
   * Hovering (or focusing) a word previews its trace; moving away with
   * nothing selected clears the board entirely. Clicking a word selects it,
   * which wins over hover from then on - it keeps showing no matter what
   * else you hover - until you click it again to deselect. Both are tracked
   * by word string, not the word object, so a click toggles correctly even
   * though "found" and "missed" chips carry different object shapes.
   */
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [hoveredWord, setHoveredWord] = useState<string | null>(null);
  const [showAllMissed, setShowAllMissed] = useState(false);
  const [showDefinition, setShowDefinition] = useState(true);

  const selected = results.find((r) => r.playerId === selectedId) ?? results[0];

  const boardTotal = useMemo(
    () => boardWords.reduce((sum, entry) => sum + entry.score, 0),
    [boardWords]
  );

  /** Everything on the board this player did not claim, richest first. */
  const missed = useMemo(() => {
    if (!selected) return [];
    const found = new Set(selected.words.map((entry) => entry.word));
    return boardWords.filter((entry) => !found.has(entry.word));
  }, [boardWords, selected]);

  const missedPoints = useMemo(
    () => missed.reduce((sum, entry) => sum + entry.score, 0),
    [missed]
  );

  const pathByWord = useMemo(() => {
    const map = new Map<string, BoardWord>();
    for (const entry of boardWords) map.set(entry.word, entry);
    return map;
  }, [boardWords]);

  const highlightWord = selectedWord ?? hoveredWord;
  const highlight = highlightWord ? pathByWord.get(highlightWord) ?? null : null;
  // Skip the lookup entirely while the section is hidden, or the feature is
  // off via VITE_ENABLE_DEFINITIONS - no point spending a network request on
  // a definition nobody can see.
  const definition = useWordDefinition(DEFINITIONS_ENABLED && showDefinition ? highlightWord : null);

  /** A click on an already-selected word deselects it; any other click selects it. */
  const toggleSelected = (word: string) => {
    setSelectedWord((current) => (current === word ? null : word));
  };

  const top = results[0];
  const tied = results.filter((r) => r.totalScore === top?.totalScore);
  const visibleMissed = showAllMissed ? missed : missed.slice(0, MISSED_PREVIEW);

  return (
    <div className="results">
      <header className="results__banner">
        <p className="results__eyebrow">Time!</p>
        <h1>
          {tied.length > 1
            ? `Tied at ${top.totalScore}`
            : `${top?.playerName ?? 'Nobody'} wins with ${top?.totalScore ?? 0}`}
        </h1>
        <div className="results__stats">
          <span className="results__stat">
            <span className="results__stat-label">Total words</span>
            <span className="results__stat-value">{boardWords.length}</span>
          </span>
          <span className="results__stat">
            <span className="results__stat-label">Total board value</span>
            <span className="results__stat-value">{boardTotal}</span>
          </span>
          <span className="results__stat">
            <span className="results__stat-label">Duration</span>
            <span className="results__stat-value">{describeDuration(durationMs)}</span>
          </span>
          <span className="results__stat">
            <span className="results__stat-label">Mode</span>
            <span className="results__stat-value">
              {GAME_MODE_OPTIONS.find((option) => option.mode === mode)?.label}
            </span>
          </span>
        </div>
      </header>

      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th className="table__num">Found</th>
            <th className="table__num">Struck</th>
            <th className="table__num">Raw</th>
            <th className="table__num">Score</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result, index) => {
            const struck = result.words.filter((word) => word.duplicate).length;
            return (
              <tr
                key={result.playerId}
                className={result.playerId === playerId ? 'table__row--you' : undefined}
              >
                <td>{index + 1}</td>
                <td>
                  {result.playerName}
                  {result.playerId === playerId && <span className="tag">you</span>}
                </td>
                <td className="table__num">{result.words.length}</td>
                <td className="table__num">{struck || '-'}</td>
                <td className="table__num table__num--muted">{result.rawScore}</td>
                <td className="table__num table__num--strong">{result.totalScore}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="results__rule">
        Words found by more than one player are struck from every list, per the official rules.
      </p>

      {results.length > 1 && (
        <div className="tabs" role="tablist">
          {results.map((result) => (
            <button
              key={result.playerId}
              type="button"
              role="tab"
              aria-selected={result.playerId === selected?.playerId}
              className={`tabs__tab${result.playerId === selected?.playerId ? ' tabs__tab--on' : ''}`}
              onClick={() => {
                setSelectedId(result.playerId);
                setShowAllMissed(false);
                setSelectedWord(null);
                setHoveredWord(null);
              }}
            >
              {result.playerId === playerId ? 'You' : result.playerName}
            </button>
          ))}
        </div>
      )}

      <div className="results__grid">
        <section className="panel">
          <header className="panel__header">
            <h2>{selected?.playerId === playerId ? 'You found' : `${selected?.playerName} found`}</h2>
            <span className="panel__note">{selected?.words.length ?? 0}</span>
          </header>
          {selected && selected.words.length > 0 ? (
            <ul className="chips">
              {selected.words.map((entry) => (
                <li key={entry.word}>
                  <button
                    type="button"
                    className={`chip${entry.duplicate ? ' chip--struck' : ' chip--good'}${selectedWord === entry.word ? ' chip--on' : ''}`}
                    onMouseEnter={() => setHoveredWord(entry.word)}
                    onMouseLeave={() => setHoveredWord(null)}
                    onFocus={() => setHoveredWord(entry.word)}
                    onBlur={() => setHoveredWord(null)}
                    onClick={() => toggleSelected(entry.word)}
                    aria-pressed={selectedWord === entry.word}
                    title={entry.duplicate ? 'Also found by another player, so it scores nothing' : undefined}
                  >
                    {entry.word}
                    <span className="chip__score">{entry.duplicate ? '0' : `+${entry.score}`}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No words this round.</p>
          )}
        </section>

        <section className="panel">
          <header className="panel__header">
            <h2>{selected?.playerId === playerId ? 'You missed' : `${selected?.playerName} missed`}</h2>
            <span className="panel__note">
              {missed.length} words, {missedPoints} points
            </span>
          </header>
          <ul className="chips">
            {visibleMissed.map((entry) => (
              <li key={entry.word}>
                <button
                  type="button"
                  className={`chip chip--missed${selectedWord === entry.word ? ' chip--on' : ''}`}
                  onMouseEnter={() => setHoveredWord(entry.word)}
                  onMouseLeave={() => setHoveredWord(null)}
                  onFocus={() => setHoveredWord(entry.word)}
                  onBlur={() => setHoveredWord(null)}
                  onClick={() => toggleSelected(entry.word)}
                  aria-pressed={selectedWord === entry.word}
                >
                  {entry.word}
                  <span className="chip__score">{entry.score}</span>
                </button>
              </li>
            ))}
          </ul>
          {missed.length > visibleMissed.length && (
            <button
              type="button"
              className="button button--ghost button--block"
              onClick={() => setShowAllMissed(true)}
            >
              Show all {missed.length}
            </button>
          )}
        </section>

        <section className="panel results__board">
          <header className="panel__header">
            <h2>{highlight ? highlight.word : 'The board'}</h2>
            {highlight && <span className="panel__note">{highlight.score} pts</span>}
          </header>
          <BoardGrid board={board} path={highlight?.path ?? []} />
          <p className="empty">Pick any word to trace it on the board.</p>
        </section>

        {DEFINITIONS_ENABLED && (
          <section className="panel">
            <header className="panel__header">
              <h2>Definition</h2>
              <button
                type="button"
                className="link-toggle"
                onClick={() => setShowDefinition((visible) => !visible)}
                aria-expanded={showDefinition}
              >
                {showDefinition ? 'Hide' : 'Show'}
              </button>
            </header>
            {showDefinition && (
              // Fixed height regardless of which state below renders, so
              // sweeping across words with short/long/missing definitions
              // never reflows the page - only the content inside changes.
              <div className="definition-slot">
                {!highlightWord ? (
                  <p className="empty">Hover or select a word to see its definition.</p>
                ) : definition.status === 'loading' ? (
                  <p className="empty">Looking up {highlightWord.toLowerCase()}...</p>
                ) : definition.status === 'success' ? (
                  <div className="definition">
                    <p className="definition__head">
                      <span className="definition__word">{highlightWord.toLowerCase()}</span>
                      {definition.partOfSpeech && (
                        <span className="definition__pos">{definition.partOfSpeech}</span>
                      )}
                    </p>
                    <p className="definition__text">{definition.definition}</p>
                  </div>
                ) : (
                  <p className="empty">No definition found for {highlightWord.toLowerCase()}.</p>
                )}
              </div>
            )}
          </section>
        )}
      </div>

      <Chat messages={chatMessages} playerId={playerId} onSend={onSendChat} />

      <div className="results__actions">
        {isHost ? (
          <button type="button" className="button" onClick={onPlayAgain} disabled={!canPlayAgain}>
            {canPlayAgain ? 'Play again' : 'Waiting for players'}
          </button>
        ) : (
          <button
            type="button"
            className={isReady ? 'button button--ghost' : 'button'}
            onClick={() => onReady(!isReady)}
          >
            {isReady ? 'Ready - waiting for the host' : 'Ready for another round'}
          </button>
        )}
        <button type="button" className="button button--ghost" onClick={onLeave}>
          Leave room
        </button>
      </div>
    </div>
  );
}

export default memo(Results);
