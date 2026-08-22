import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_DIM } from '../../../shared/src/rules';
import { CORE_MARGIN, sampleGridFraction } from './gridMath';

/** A cell's center, as a fraction of the grid (0..1) - what a pointer sits at when centered. */
function centerOf(cell: number): { x: number; y: number } {
  const row = Math.floor(cell / BOARD_DIM);
  const col = cell % BOARD_DIM;
  return { x: (col + 0.5) / BOARD_DIM, y: (row + 0.5) / BOARD_DIM };
}

/** A naive floor-only lookup, i.e. what the code did before this fix. */
function naiveCellAt(fracX: number, fracY: number): number | null {
  const relX = fracX * BOARD_DIM;
  const relY = fracY * BOARD_DIM;
  if (relX < 0 || relX >= BOARD_DIM || relY < 0 || relY >= BOARD_DIM) return null;
  return Math.floor(relY) * BOARD_DIM + Math.floor(relX);
}

/**
 * Sample a straight line between two cells' centers, with an optional
 * perpendicular wobble peaking at the midpoint - modelling the hand tremor a
 * real drag has right as it crosses the corner between cells.
 */
function traceLine(fromCell: number, toCell: number, wobble: number, steps = 40) {
  const from = centerOf(fromCell);
  const to = centerOf(toCell);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const nx = -dy / length; // unit perpendicular
  const ny = dx / length;

  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lateral = Math.sin(t * Math.PI) * wobble; // one gentle hump, peaking mid-path
    points.push({
      x: from.x + dx * t + nx * lateral,
      y: from.y + dy * t + ny * lateral,
    });
  }
  return points;
}

/** Replays the same accept/reject rule onPointerMove uses, against a point sequence. */
function replayDrag(points: { x: number; y: number }[], startCell: number): number[] {
  const accepted = [startCell];
  let last = startCell;
  for (const p of points) {
    const sample = sampleGridFraction(p.x, p.y);
    if (!sample || sample.cell === last || !sample.core) continue;
    accepted.push(sample.cell);
    last = sample.cell;
  }
  return accepted;
}

/** The equivalent replay against the old, margin-free floor lookup. */
function replayDragNaive(points: { x: number; y: number }[], startCell: number): number[] {
  const accepted = [startCell];
  let last = startCell;
  for (const p of points) {
    const cell = naiveCellAt(p.x, p.y);
    if (cell === null || cell === last) continue;
    accepted.push(cell);
    last = cell;
  }
  return accepted;
}

test('a cell center is confidently in its own core', () => {
  const center = centerOf(5);
  const sample = sampleGridFraction(center.x, center.y);
  assert.ok(sample);
  assert.equal(sample!.cell, 5);
  assert.equal(sample!.core, true);
});

test('the point exactly on a shared corner belongs to no cell\'s core', () => {
  // Cells 0, 1, 4 and 5 all meet at grid-fraction (1/4, 1/4) - a plain floor
  // lookup has to assign it to one of them, but it should never be a
  // confident core hit for any of the four.
  const corner = { x: 1 / BOARD_DIM, y: 1 / BOARD_DIM };
  const sample = sampleGridFraction(corner.x, corner.y);
  assert.ok(sample, 'still resolves to some cell by raw floor');
  assert.equal(sample!.core, false, 'but the corner itself is nobody\'s confident core');
});

test('a point just past a shared edge, but still near the corner, stays out of core', () => {
  // Nudge from the corner slightly into cell 1's rectangle (same row, next
  // column) - close enough to the corner that it should still land in 1's
  // dead zone, not confidently register as cell 1.
  const corner = { x: 1 / BOARD_DIM, y: 1 / BOARD_DIM };
  const nudge = (CORE_MARGIN / 2) / BOARD_DIM;
  const sample = sampleGridFraction(corner.x + nudge, corner.y - 0.01 / BOARD_DIM);
  assert.ok(sample);
  assert.equal(sample!.cell, 1);
  assert.equal(sample!.core, false);
});

test('a diagonal drag with realistic tremor lands on exactly the diagonal cell, never an orthogonal neighbour', () => {
  // Every adjacent diagonal pair on the board, both directions.
  const diagonalPairs: [number, number][] = [];
  for (let row = 0; row < BOARD_DIM - 1; row++) {
    for (let col = 0; col < BOARD_DIM - 1; col++) {
      const a = row * BOARD_DIM + col;
      const d = (row + 1) * BOARD_DIM + (col + 1);
      diagonalPairs.push([a, d]);
      const b = row * BOARD_DIM + (col + 1);
      const c = (row + 1) * BOARD_DIM + col;
      diagonalPairs.push([b, c]);
    }
  }

  // Realistic tremor: a gentle single-hump wobble, peaking well under half a
  // cell width - nothing like the exaggerated noise that would defeat any
  // hit-testing scheme.
  const wobble = 0.6 / BOARD_DIM / 4; // ~15% of a cell width at the peak

  for (const [from, to] of diagonalPairs) {
    const points = traceLine(from, to, wobble);
    const path = replayDrag(points, from);
    assert.deepEqual(
      path,
      [from, to],
      `drag from ${from} to ${to} should register as a clean diagonal step, got [${path}]`
    );
  }
});

test('without the core margin, the same realistic tremor can clip an orthogonal neighbour', () => {
  // This is the bug report: demonstrate that the naive floor-only lookup is
  // genuinely susceptible to the same wobble the fixed version shrugs off,
  // so the fix is proven to address a real failure mode and not a strawman.
  const wobble = 0.6 / BOARD_DIM / 4;
  const points = traceLine(5, 10, wobble); // T -> H style diagonal, center of board
  const naive = replayDragNaive(points, 5);
  assert.ok(
    naive.length > 2,
    `expected the naive lookup to clip an extra cell, got a clean path [${naive}]`
  );
});

test('an orthogonal drag still resolves correctly, just with a short dead zone at the shared edge', () => {
  const points = traceLine(5, 6, 0); // straight line, no wobble needed
  const path = replayDrag(points, 5);
  assert.deepEqual(path, [5, 6]);
});
