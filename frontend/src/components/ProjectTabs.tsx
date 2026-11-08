import clsx from 'clsx';
import { NavLink, useParams } from 'react-router-dom';
import { useWorkspace } from './workspace-context';

export function ProjectTabs() {
  const { workspace } = useWorkspace();
  const { projectId = '' } = useParams();
  const base = `/w/${workspace.id}/projects/${projectId}`;
  const tabs = [
    { to: base, label: 'Board', end: true },
    { to: `${base}/activity`, label: 'Activity' },
    { to: `${base}/github`, label: 'GitHub' },
    { to: `${base}/settings`, label: 'Settings' },
  ];
  return (
    <nav aria-label="Project" className="flex gap-1 border-b border-line">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            clsx(
              '-mb-px border-b-2 px-3 py-1.5 text-sm',
              isActive ? 'border-ink font-semibold' : 'border-transparent text-muted hover:text-ink',
            )
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
