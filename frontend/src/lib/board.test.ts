import { describe, expect, it } from 'vitest';
import { applyMove } from './board';
import { roleAtLeast } from './meta';
import type { TaskStatus } from './types';

const col = (...ids: string[]) => ids.map((id) => ({ id }));
const board = (): Record<TaskStatus, { id: string }[]> => ({
  BACKLOG: col('a', 'b', 'c'),
  TODO: col('d'),
  IN_PROGRESS: [],
  IN_REVIEW: [],
  COMPLETED: [],
});

describe('applyMove', () => {
  it('moves to the top of another column', () => {
    const r = applyMove(board(), { status: 'BACKLOG', index: 1 }, { status: 'TODO', index: 0 });
    expect(r.afterTaskId).toBeNull();
    expect(r.columns.TODO.map((t) => t.id)).toEqual(['b', 'd']);
    expect(r.columns.BACKLOG.map((t) => t.id)).toEqual(['a', 'c']);
  });
  it('drops below an existing card in another column', () => {
    const r = applyMove(board(), { status: 'BACKLOG', index: 0 }, { status: 'TODO', index: 1 });
    expect(r.afterTaskId).toBe('d');
  });
  it('reorders within a column using post-removal indices', () => {
    const r = applyMove(board(), { status: 'BACKLOG', index: 0 }, { status: 'BACKLOG', index: 2 });
    expect(r.columns.BACKLOG.map((t) => t.id)).toEqual(['b', 'c', 'a']);
    expect(r.afterTaskId).toBe('c');
  });
  it('does not mutate the input', () => {
    const input = board();
    applyMove(input, { status: 'BACKLOG', index: 0 }, { status: 'TODO', index: 0 });
    expect(input.BACKLOG).toHaveLength(3);
  });
});

describe('roleAtLeast', () => {
  it('compares roles', () => {
    expect(roleAtLeast('DEVELOPER', 'VIEWER')).toBe(true);
    expect(roleAtLeast('VIEWER', 'DEVELOPER')).toBe(false);
    expect(roleAtLeast(undefined, 'VIEWER')).toBe(false);
  });
});
