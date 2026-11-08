import { useQuery } from '@tanstack/react-query';
import { get } from './api';
import type { Workspace } from './types';

export const useWorkspaces = () =>
  useQuery({ queryKey: ['workspaces'], queryFn: () => get<Workspace[]>('/workspaces') });
