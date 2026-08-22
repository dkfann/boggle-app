import { useCallback, useMemo, useRef, useState } from 'react';
import type { Board, Path } from '../../../shared/src/protocol';
import { MIN_WORD_LENGTH, NEIGHBORS } from '../../../shared/src/rules';
import { sampleGridPoint } from './gridMath';

/**
 * `drag` is a pointer held down and traced across the board.
 * `tap` is the touch-friendly mode you fall into after a single tap: each tap
 * extends the word, tapping the last die submits it.
 */
type Mode = 'idle' | 'drag' | 'tap';

interface Selection {
  path: Path;
  mode: Mode;
}

const EMPTY: Selection = { path: [], mode: 'idle' };

export interface SelectionApi {
  path: Path;
  word: string;
  active: boolean;
  gridRef: React.RefObject<HTMLDivElement>;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  selectCell: (cell: number) => void;
  commit: () => void;
  clear: () => void;
}

export function useSelection(
  board: Board | null,
  onSubmit: (word: string, path: Path) => void,
  enabled: boolean
): SelectionApi {
  const [selection, setSelection] = useState<Selection>(EMPTY);
  const gridRef = useRef<HTMLDivElement>(null);
  /** Grid geometry, read once per gesture instead of on every pointermove. */
  const rectRef = useRef<DOMRect | null>(null);
  const lastCellRef = useRef<number>(-1);

  /**
   * The ref, not the state, is the live selection.
   *
   * Several pointer events can land between two renders (a fast drag, or a
   * touchmove burst), and reading `selection` in a handler would still see the
   * value from the last paint - dropping every move in the batch. Writing the
   * ref at the same moment as the state keeps handlers reading what has
   * actually happened, while state drives the render.
   */
  const selectionRef = useRef<Selection>(EMPTY);
  const boardRef = useRef(board);
  boardRef.current = board;

  const apply = useCallback((next: Selection) => {
    selectionRef.current = next;
    setSelection(next);
  }, []);

  const spell = useCallback((path: Path): string => {
    const current = boardRef.current;
    if (!current) return '';
    let text = '';
    for (const cell of path) text += current[cell] ?? '';
    return text.toUpperCase();
  }, []);

  const word = useMemo(() => spell(selection.path), [spell, selection.path]);

  const clear = useCallback(() => {
    lastCellRef.current = -1;
    apply(EMPTY);
  }, [apply]);

  const commit = useCallback(() => {
    const { path } = selectionRef.current;
    const text = spell(path);
    if (text.length >= MIN_WORD_LENGTH && path.length > 0) onSubmit(text, path);
    clear();
  }, [onSubmit, clear, spell]);

  /**
   * A pointer's raw cell, plus whether it is confidently inside that cell's
   * core rather than grazing its border - see gridMath.ts for why a plain
   * floor lookup misreads diagonal drags.
   */
  const sampleGrid = useCallback((clientX: number, clientY: number) => {
    const rect = rectRef.current ?? gridRef.current?.getBoundingClientRect() ?? null;
    if (!rect) return null;
    return sampleGridPoint(clientX, clientY, rect);
  }, []);

  /** Which die is under this point, with no hysteresis - for a discrete click or tap-down. */
  const cellAt = useCallback(
    (clientX: number, clientY: number): number => sampleGrid(clientX, clientY)?.cell ?? -1,
    [sampleGrid]
  );

  /** Extend the traced word, or rub out the last letter by retracing over it. */
  const advance = useCallback(
    (cell: number) => {
      const current = selectionRef.current;
      if (current.path.length === 0) {
        apply({ path: [cell], mode: current.mode });
        return;
      }

      const index = current.path.indexOf(cell);
      if (index !== -1) {
        if (index === current.path.length - 2) {
          apply({ ...current, path: current.path.slice(0, -1) });
        }
        return;
      }

      const last = current.path[current.path.length - 1];
      if (!NEIGHBORS[last].includes(cell)) return;
      apply({ ...current, path: [...current.path, cell] });
    },
    [apply]
  );

  /** A tap: extend, cut back to an earlier die, submit, or start over. */
  const selectCell = useCallback(
    (cell: number) => {
      if (!enabled) return;
      const { path } = selectionRef.current;

      if (path.length === 0) {
        lastCellRef.current = cell;
        apply({ path: [cell], mode: 'tap' });
        return;
      }

      const index = path.indexOf(cell);
      if (index === path.length - 1) {
        commit();
        return;
      }
      if (index !== -1) {
        apply({ path: path.slice(0, index + 1), mode: 'tap' });
        return;
      }

      const last = path[path.length - 1];
      // Unreachable from here, so treat the tap as the start of a new word.
      apply({ path: NEIGHBORS[last].includes(cell) ? [...path, cell] : [cell], mode: 'tap' });
      lastCellRef.current = cell;
    },
    [enabled, commit, apply]
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled || event.button !== 0) return;
      rectRef.current = gridRef.current?.getBoundingClientRect() ?? null;
      const cell = cellAt(event.clientX, event.clientY);
      if (cell === -1) return;

      event.preventDefault();
      // Capture so a fast drag that leaves the grid keeps reporting to us.
      // Throws if the pointer has already gone, which must not break the round.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* capture is an optimisation, not a requirement */
      }

      const current = selectionRef.current;
      if (current.mode === 'tap' && current.path.length > 0) {
        selectCell(cell);
        return;
      }
      lastCellRef.current = cell;
      apply({ path: [cell], mode: 'drag' });
    },
    [enabled, cellAt, selectCell, apply]
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (selectionRef.current.mode !== 'drag') return;
      const sample = sampleGrid(event.clientX, event.clientY);
      if (!sample || sample.cell === lastCellRef.current) return;
      // Still crossing the border/corner between dice - hold the last cell
      // rather than clip an orthogonal neighbour on the way to a diagonal one.
      if (!sample.core) return;
      lastCellRef.current = sample.cell;
      advance(sample.cell);
    },
    [sampleGrid, advance]
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        /* already released */
      }
      const current = selectionRef.current;
      if (current.mode !== 'drag') return;

      if (current.path.length >= 2) {
        commit();
        return;
      }
      // A single tap arms tap-to-spell instead of submitting one letter.
      apply({ path: current.path, mode: 'tap' });
    },
    [commit, apply]
  );

  return {
    path: selection.path,
    word,
    active: selection.path.length > 0,
    gridRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    selectCell,
    commit,
    clear,
  };
}
