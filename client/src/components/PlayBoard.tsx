import { memo, useEffect } from 'react';
import type { Board } from '../../../shared/src/protocol';
import { REJECTION_TEXT } from '../../../shared/src/protocol';
import { MIN_WORD_LENGTH } from '../../../shared/src/rules';
import { useGameActions, type Feedback } from '../game/GameProvider';
import { useSelection } from '../game/useSelection';
import BoardGrid from './BoardGrid';

interface PlayBoardProps {
  board: Board;
  enabled: boolean;
  /** Hidden during the countdown so nobody can start early. */
  concealed: boolean;
  feedback: Feedback | null;
  /** Hidden mode: mask the word readout so it can't be read back instead of memorized. */
  maskTrace?: boolean;
}

/**
 * Owns the drag/tap selection so tracing a word re-renders the board only -
 * the scoreboard, timer and word list are untouched by every pointermove.
 */
function PlayBoard({ board, enabled, concealed, feedback, maskTrace = false }: PlayBoardProps) {
  const { submit } = useGameActions();
  const selection = useSelection(board, submit, enabled);
  const { clear, commit } = selection;

  // Enter submits and Escape clears, for tap-to-spell and keyboard play.
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clear();
      else if (event.key === 'Enter') commit();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, clear, commit]);

  // Abandon a half-traced word the moment the round closes.
  useEffect(() => {
    if (!enabled) clear();
  }, [enabled, clear]);

  const tooShort = selection.word.length > 0 && selection.word.length < MIN_WORD_LENGTH;
  // Masked to dots rather than hidden outright, so there's still feedback
  // that the drag registered - just not which letters it touched.
  const displayWord = maskTrace ? '•'.repeat(selection.word.length) : selection.word;

  return (
    <div className="play">
      <BoardGrid
        board={board}
        path={selection.path}
        hidden={concealed}
        interactive={enabled}
        gridRef={selection.gridRef}
        onCellSelect={selection.selectCell}
        onPointerDown={selection.onPointerDown}
        onPointerMove={selection.onPointerMove}
        onPointerUp={selection.onPointerUp}
      />

      <div className="play__bar">
        <div
          className={`play__word${tooShort ? ' play__word--short' : ''}`}
          aria-live="polite"
          aria-label="Current word"
        >
          {displayWord || <span className="play__hint">Drag or tap the dice to spell a word</span>}
        </div>

        {selection.active && (
          <div className="play__controls">
            <button type="button" className="button button--ghost" onClick={selection.clear}>
              Clear
            </button>
            <button
              type="button"
              className="button"
              onClick={selection.commit}
              disabled={selection.word.length < MIN_WORD_LENGTH}
            >
              Submit
            </button>
          </div>
        )}
      </div>

      {feedback && (
        <div
          key={feedback.id}
          className={`toast toast--${feedback.accepted ? 'good' : 'bad'}`}
          role="status"
        >
          <strong>{feedback.word}</strong>
          <span>
            {feedback.accepted
              ? `+${feedback.score}`
              : feedback.reason
                ? REJECTION_TEXT[feedback.reason]
                : 'Rejected'}
          </span>
        </div>
      )}
    </div>
  );
}

export default memo(PlayBoard);
