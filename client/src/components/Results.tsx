import { memo, useMemo, useState } from 'react';
import type { Board, BoardWord, PlayerResult } from '../../../shared/src/protocol';
import BoardGrid from './BoardGrid';

interface ResultsProps {
  results: PlayerResult[];
  boardWords: BoardWord[];
  board: Board;
  playerId: string;
  isHost: boolean;
  canPlayAgain: boolean;
  isReady: boolean;
  onReady: (ready: boolean) => void;
  onPlayAgain: () => void;
  onLeave: () => void;
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
  onReady,
  onPlayAgain,
  onLeave,
}: ResultsProps) {
  const [selectedId, setSelectedId] = useState(
    () => results.find((r) => r.playerId === playerId)?.playerId ?? results[0]?.playerId ?? ''
  );
  const [highlight, setHighlight] = useState<BoardWord | null>(null);
  const [showAllMissed, setShowAllMissed] = useState(false);

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
        <p className="results__sub">
          The board held {boardWords.length} words worth {boardTotal} points.
        </p>
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
                setHighlight(null);
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
                    className={`chip${entry.duplicate ? ' chip--struck' : ' chip--good'}`}
                    onMouseEnter={() => setHighlight(pathByWord.get(entry.word) ?? null)}
                    onFocus={() => setHighlight(pathByWord.get(entry.word) ?? null)}
                    onClick={() => setHighlight(pathByWord.get(entry.word) ?? null)}
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
                  className="chip chip--missed"
                  onMouseEnter={() => setHighlight(entry)}
                  onFocus={() => setHighlight(entry)}
                  onClick={() => setHighlight(entry)}
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
      </div>

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
