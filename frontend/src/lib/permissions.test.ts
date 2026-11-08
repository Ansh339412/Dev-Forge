import { describe, expect, it } from 'vitest';
import { canEditProject } from './permissions';

describe('canEditProject', () => {
  const project = { managerId: 'm1' };
  it('lets admins edit any project', () => expect(canEditProject(project, 'x', 'WORKSPACE_ADMIN')).toBe(true));
  it('lets the project manager edit their own project', () => expect(canEditProject(project, 'm1', 'PROJECT_MANAGER')).toBe(true));
  it('does not let another project manager edit it', () => expect(canEditProject(project, 'm2', 'PROJECT_MANAGER')).toBe(false));
  it('does not let developers or viewers edit, even by id', () => {
    expect(canEditProject(project, 'm1', 'DEVELOPER')).toBe(false);
    expect(canEditProject(project, 'm1', 'VIEWER')).toBe(false);
  });
});
