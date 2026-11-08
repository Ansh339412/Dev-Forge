import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { ProjectFrame } from '../components/ProjectFrame';
import { Button, EmptyState, ErrorNote, Field, Input, Select, Spinner } from '../components/ui';
import { useWorkspace } from '../components/workspace-context';
import { del, get, post } from '../lib/api';
import { canEditProject } from '../lib/permissions';
import { errMsg } from '../lib/errors';
import { fmtDateTime } from '../lib/format';
import type { Commit, GithubRepo, Project } from '../lib/types';
import { useAuth } from '../stores/auth';
import { toast } from '../stores/toast';

export default function ProjectGithubPage() {
  return <ProjectFrame>{(project) => <GithubPanel project={project} />}</ProjectFrame>;
}

function GithubPanel({ project }: { project: Project }) {
  const { workspace, role } = useWorkspace();
  const me = useAuth((s) => s.user)!;
  const qc = useQueryClient();
  const base = `/workspaces/${workspace.id}/projects/${project.id}/integrations/github`;
  const reposKey = ['ws', workspace.id, 'github', project.id];
  const canEdit = canEditProject(project, me.id, role);
  const [repository, setRepository] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);

  const repos = useQuery({ queryKey: reposKey, queryFn: () => get<GithubRepo[]>(base) });
  const selected = chosen ?? repos.data?.[0]?.id ?? null;
  const commits = useQuery({
    queryKey: ['ws', workspace.id, 'github-commits', selected],
    queryFn: () => get<{ repository: string; commits: Commit[] }>(`${base}/${selected}/commits`, { limit: 20 }),
    enabled: !!selected,
    retry: false,
  });

  const connect = useMutation({
    mutationFn: () => post<GithubRepo>(base, { repository }),
    onSuccess: (repo) => {
      setRepository('');
      setChosen(repo.id);
      void qc.invalidateQueries({ queryKey: reposKey });
      toast.success(`Connected ${repo.fullName}`);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const disconnect = useMutation({
    mutationFn: (id: string) => del(`${base}/${id}`),
    onSuccess: () => {
      setChosen(null);
      void qc.invalidateQueries({ queryKey: reposKey });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="space-y-6">
      {canEdit && (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            connect.mutate();
          }}
        >
          <div className="min-w-[16rem] flex-1">
            <Field label="Connect a repository" hint="Use owner/name or a github.com URL. Private repositories need a server-side GitHub token.">
              {(id) => <Input id={id} required placeholder="nestjs/nest" value={repository} onChange={(e) => setRepository(e.target.value)} />}
            </Field>
          </div>
          <Button type="submit" variant="primary" loading={connect.isPending}>Connect</Button>
        </form>
      )}

      {repos.isLoading && <Spinner />}
      {repos.isError && <ErrorNote>{errMsg(repos.error)}</ErrorNote>}
      {repos.data?.length === 0 && (
        <EmptyState title="No repositories connected">
          {canEdit ? 'Connect a repository to see its recent commits here.' : 'The project manager can connect a repository.'}
        </EmptyState>
      )}

      {repos.data && repos.data.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-3">
            <Select aria-label="Repository" className="w-72" value={selected ?? ''} onChange={(e) => setChosen(e.target.value)}>
              {repos.data.map((r) => <option key={r.id} value={r.id}>{r.fullName}</option>)}
            </Select>
            {selected && canEdit && (
              <Button variant="ghost" onClick={() => disconnect.mutate(selected)}>Disconnect</Button>
            )}
          </div>
          {commits.isLoading && <Spinner label="Loading commits" />}
          {commits.isError && <ErrorNote>{errMsg(commits.error)}</ErrorNote>}
          {commits.data && (
            <ul className="divide-y divide-line border-y border-line bg-white">
              {commits.data.commits.map((c) => (
                <li key={c.sha} className="px-4 py-2.5 text-sm">
                  <a href={c.url} target="_blank" rel="noreferrer noopener" className="font-medium underline">{c.message}</a>
                  <p className="text-xs text-muted">
                    {c.sha} · {c.authorLogin ?? c.author ?? 'unknown'}{c.date && ` · ${fmtDateTime(c.date)}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
