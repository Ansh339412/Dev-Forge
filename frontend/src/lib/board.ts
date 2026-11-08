import type { TaskStatus } from './types';

/**
 * Applies a drag-and-drop result to the board. `afterTaskId` is what the API expects:
 * the card directly above the drop position in the target column (null = top).
 */
export function applyMove<T extends { id: string }>(
  columns: Record<TaskStatus, T[]>,
  source: { status: TaskStatus; index: number },
  dest: { status: TaskStatus; index: number },
) {
  const next = { ...columns, [source.status]: [...columns[source.status]] } as Record<TaskStatus, T[]>;
  if (dest.status !== source.status) next[dest.status] = [...columns[dest.status]];

  const [moved] = next[source.status].splice(source.index, 1);
  const target = next[dest.status];
  const afterTaskId = dest.index > 0 ? (target[dest.index - 1]?.id ?? null) : null;
  target.splice(dest.index, 0, moved);
  return { columns: next, moved, afterTaskId };
}
