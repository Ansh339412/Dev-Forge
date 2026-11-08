import { useQuery } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get } from '../lib/api';
import { errMsg } from '../lib/errors';
import type { Project } from '../lib/types';
import { ProjectTabs } from './ProjectTabs';
import { ErrorNote, Spinner } from './ui';
import { useWorkspace } from './workspace-context';

/** Shared header for the project sub-pages (everything except the board, which has its own toolbar). */
export function ProjectFrame({ children }: { children: (project: Project) => ReactNode }) {
  const { workspace } = useWorkspace();
  const { projectId = '' } = useParams();
  const project = useQuery({
    queryKey: ['ws', workspace.id, 'project', projectId],
    queryFn: () => get<Project>(`/workspaces/${workspace.id}/projects/${projectId}`),
  });

  if (project.isLoading) return <Spinner label="Loading project" />;
  if (project.isError || !project.data) return <div className="p-6"><ErrorNote>{errMsg(project.error)}</ErrorNote></div>;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <p className="text-sm text-muted"><Link to={`/w/${workspace.id}/projects`} className="underline">Projects</Link></p>
      <h1 className="mb-3 mt-1 text-xl font-semibold">{project.data.name}</h1>
      <ProjectTabs />
      <div className="pt-6">{children(project.data)}</div>
    </div>
  );
}
