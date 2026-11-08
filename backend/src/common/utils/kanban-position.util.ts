export const STEP = 1024;
const MIN_GAP = 1e-6;

export interface Positioned {
  id: string;
  position: number;
}

export interface Placement {
  position: number;
  /** Set when neighbours got too close; the caller must persist these new positions first. */
  rebalanced?: Positioned[];
}

/**
 * Computes where a card dropped directly after `afterId` should sit in a column
 * (sorted ascending, moving card excluded). `afterId` null/undefined = top of column.
 * Returns null if `afterId` is not in the column.
 */
export function placeAfter(column: Positioned[], afterId?: string | null): Placement | null {
  if (!afterId) {
    return { position: column.length ? column[0].position - STEP : STEP };
  }
  const idx = column.findIndex((t) => t.id === afterId);
  if (idx === -1) return null;

  let col = column;
  let rebalanced: Positioned[] | undefined;
  if (col[idx + 1] && col[idx + 1].position - col[idx].position < MIN_GAP) {
    col = col.map((t, i) => ({ id: t.id, position: (i + 1) * STEP }));
    rebalanced = col;
  }
  const prev = col[idx];
  const next = col[idx + 1];
  return { position: next ? (prev.position + next.position) / 2 : prev.position + STEP, rebalanced };
}
