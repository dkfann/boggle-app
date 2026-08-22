import { BOARD_DIM } from '../../../shared/src/rules';

/**
 * Fraction of each cell's edge treated as a dead zone during a drag.
 *
 * A diagonal drag's straight-line path passes almost exactly through the
 * corner shared by four cells, so ordinary hand tremor is enough to clip an
 * orthogonal neighbour's rectangle for a frame or two on the way through.
 * Shrinking each cell to an inner "core" - and requiring a drag to land
 * inside a cell's core, not just past its outer edge, before accepting it as
 * the new cell - lets that clip pass through the corner's dead zone instead
 * of registering as a real step. Without this, a diagonal swipe reads as two
 * orthogonal hops around a right angle.
 */
export const CORE_MARGIN = 0.22;

export interface GridSample {
  cell: number;
  /** True when the point is confidently inside `cell`, not just grazing its border. */
  core: boolean;
}

/**
 * Which cell a point falls in, given its position as a fraction of the grid's
 * width/height (0..1 each), plus whether it is inside that cell's core.
 * Returns null when the point is outside the grid entirely.
 */
export function sampleGridFraction(
  fracX: number,
  fracY: number,
  coreMargin: number = CORE_MARGIN
): GridSample | null {
  const relX = fracX * BOARD_DIM;
  const relY = fracY * BOARD_DIM;
  if (relX < 0 || relX >= BOARD_DIM || relY < 0 || relY >= BOARD_DIM) return null;

  const col = Math.floor(relX);
  const row = Math.floor(relY);
  const fx = relX - col; // 0..1 position within the cell
  const fy = relY - row;
  const core = fx > coreMargin && fx < 1 - coreMargin && fy > coreMargin && fy < 1 - coreMargin;

  return { cell: row * BOARD_DIM + col, core };
}

/**
 * Same as `sampleGridFraction`, but against a client-space rect, which is what
 * pointer event handlers actually have.
 */
export function sampleGridPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  coreMargin: number = CORE_MARGIN
): GridSample | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  return sampleGridFraction(
    (clientX - rect.left) / rect.width,
    (clientY - rect.top) / rect.height,
    coreMargin
  );
}
