import { memo, useMemo } from 'react';
import type { Board, Path } from '../../../shared/src/protocol';
import { BOARD_DIM } from '../../../shared/src/rules';

interface BoardGridProps {
  board: Board;
  /** Dice to highlight: the word being traced, or a word being reviewed. */
  path: Path;
  interactive?: boolean;
  hidden?: boolean;
  gridRef?: React.RefObject<HTMLDivElement>;
  onCellSelect?: (cell: number) => void;
  onPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: React.PointerEvent<HTMLDivElement>) => void;
}

/**
 * The trace overlay is drawn in a 0-100 space stretched over the grid box, so
 * these must mirror `.board__grid { gap: 2% }` for the line to land on the
 * exact centre of each die.
 */
const GAP = 2;
const CELL = (100 - GAP * (BOARD_DIM - 1)) / BOARD_DIM;

function center(cell: number): { x: number; y: number } {
  const row = Math.floor(cell / BOARD_DIM);
  const col = cell % BOARD_DIM;
  return { x: col * (CELL + GAP) + CELL / 2, y: row * (CELL + GAP) + CELL / 2 };
}

/**
 * Where a cell's order badge sits, in grid-relative percentages (as CSS
 * `top`/`right`). The badges live in their own overlay layer painted after
 * the trace line - rather than inside each die - so the number stays
 * readable in front of the line instead of the line drawing over it. That
 * overlay has no per-cell frame to anchor against, so this reproduces the
 * die-local "near the top-right corner" position in the grid's own space.
 */
function orderBadgeAnchor(cell: number): { top: number; right: number } {
  const row = Math.floor(cell / BOARD_DIM);
  const col = cell % BOARD_DIM;
  const cellTop = row * (CELL + GAP);
  const cellLeft = col * (CELL + GAP);
  return {
    top: cellTop + CELL * 0.06,
    right: 100 - (cellLeft + CELL * 0.92),
  };
}

function BoardGrid({
  board,
  path,
  interactive = false,
  hidden = false,
  gridRef,
  onCellSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: BoardGridProps) {
  // Order in the path drives both the trace line and each die's badge number.
  const order = useMemo(() => {
    const map = new Map<number, number>();
    path.forEach((cell, index) => map.set(cell, index));
    return map;
  }, [path]);

  const points = useMemo(
    () => path.map((cell) => { const p = center(cell); return `${p.x},${p.y}`; }).join(' '),
    [path]
  );

  return (
    <div className={`board${hidden ? ' board--hidden' : ''}`}>
      <div
        className="board__grid"
        ref={gridRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {board.map((letter, cell) => {
          const index = order.get(cell);
          const selected = index !== undefined;
          const head = selected && index === path.length - 1;
          return (
            <button
              key={cell}
              type="button"
              className={`die${selected ? ' die--selected' : ''}${head ? ' die--head' : ''}`}
              // Keyboard activation still fires click; pointer gestures are handled
              // by the grid itself and suppress the synthetic click.
              onClick={interactive && onCellSelect ? () => onCellSelect(cell) : undefined}
              disabled={!interactive}
              tabIndex={interactive ? 0 : -1}
              aria-label={letter === 'Qu' ? 'Q U' : letter}
              aria-pressed={interactive ? selected : undefined}
            >
              <span className="die__letter">{hidden ? '?' : letter}</span>
            </button>
          );
        })}

        {path.length > 1 && (
          <>
            <svg
              className="board__trace"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polyline points={points} />
            </svg>

            {/* Painted after the line, so the sequence numbers stay legible
                in front of it rather than being drawn over. */}
            <div className="board__order-layer" aria-hidden="true">
              {path.map((cell, index) => {
                const anchor = orderBadgeAnchor(cell);
                return (
                  <span
                    key={cell}
                    className="die__order"
                    style={{ top: `${anchor.top}%`, right: `${anchor.right}%` }}
                  >
                    {index + 1}
                  </span>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default memo(BoardGrid);
