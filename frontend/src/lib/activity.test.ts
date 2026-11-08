import { describe as suite, expect, it } from 'vitest';
import { describe } from './activity';

suite('describe (activity sentences)', () => {
  it('reads a move as a sentence with readable column names', () => {
    expect(describe({ action: 'task.moved', metadata: { title: 'Ship it', from: 'IN_PROGRESS', to: 'IN_REVIEW' } })).toBe(
      'moved "Ship it" from In progress to In review',
    );
  });
  it('lists what changed on an update', () => {
    expect(describe({ action: 'project.updated', metadata: { changes: ['name', 'deadline'] } })).toBe(
      'updated the project (name, deadline)',
    );
  });
  it('survives missing metadata and unknown actions', () => {
    expect(describe({ action: 'project.created', metadata: null })).toBe('created the project');
    expect(describe({ action: 'something.new', metadata: null })).toBe('something.new');
  });
});
