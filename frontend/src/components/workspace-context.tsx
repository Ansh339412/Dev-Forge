import { createContext, useContext } from 'react';
import type { Workspace, WorkspaceRole } from '../lib/types';

export interface WorkspaceCtx {
  workspace: Workspace;
  role: WorkspaceRole;
  /** Developer or above: can create and edit tasks. */
  canEdit: boolean;
  /** Project manager or above: can create projects and labels. */
  canManage: boolean;
  isAdmin: boolean;
}

export const WorkspaceContext = createContext<WorkspaceCtx | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside the workspace layout');
  return ctx;
}
