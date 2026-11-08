import { useInfiniteQuery } from '@tanstack/react-query';
import { ProjectFrame } from '../components/ProjectFrame';
import { Avatar, Button, EmptyState, ErrorNote, Spinner } from '../components/ui';
import { useWorkspace } from '../components/workspace-context';
import { get } from '../lib/api';
import { errMsg } from '../lib/errors';
import { fmtDateTime } from '../lib/format';
import { describe } from '../lib/activity';
import type { Activity, Page } from '../lib/types';

export default function ProjectActivityPage() {
  const { workspace } = useWorkspace();
  return (
    <ProjectFrame>
      {(project) => <Feed base={`/workspaces/${workspace.id}/projects/${project.id}`} wid={workspace.id} pid={project.id} />}
    </ProjectFrame>
  );
}

function Feed({ base, wid, pid }: { base: string; wid: string; pid: string }) {
  const q = useInfiniteQuery({
    queryKey: ['ws', wid, 'activity', pid],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => get<Page<Activity>>(`${base}/activity`, { page: pageParam, limit: 30 }),
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
  });

  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorNote>{errMsg(q.error)}</ErrorNote>;
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  if (!items.length) return <EmptyState title="No activity yet">Changes to this project will be listed here.</EmptyState>;

  return (
    <>
      <ul className="divide-y divide-line border-y border-line bg-white">
        {items.map((a) => (
          <li key={a.id} className="flex items-start gap-3 px-4 py-3">
            <Avatar name={a.actor?.name ?? 'Deleted user'} size={26} />
            <div className="min-w-0 flex-1 text-sm">
              <p><span className="font-medium">{a.actor?.name ?? 'A deleted user'}</span> {describe(a)}</p>
              <p className="text-xs text-muted">{fmtDateTime(a.createdAt)}</p>
            </div>
          </li>
        ))}
      </ul>
      {q.hasNextPage && (
        <div className="mt-4 text-center">
          <Button loading={q.isFetchingNextPage} onClick={() => void q.fetchNextPage()}>Load older activity</Button>
        </div>
      )}
    </>
  );
}
