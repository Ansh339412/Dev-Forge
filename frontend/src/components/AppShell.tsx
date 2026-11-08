import clsx from 'clsx';
import { useEffect } from 'react';
import { Navigate, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { roleAtLeast } from '../lib/meta';
import { useWorkspaces } from '../lib/queries';
import { useAuth } from '../stores/auth';
import { NotificationsBell } from './NotificationsBell';
import { Avatar, Button, Select, Spinner } from './ui';
import { WorkspaceContext } from './workspace-context';

const NAV = [
  { to: 'dashboard', label: 'Dashboard' },
  { to: 'projects', label: 'Projects' },
  { to: 'members', label: 'Members' },
  { to: 'account', label: 'Account' },
];

export default function AppShell() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const q = useWorkspaces();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  useEffect(() => {
    if (workspaceId) localStorage.setItem('devforge.ws', workspaceId);
  }, [workspaceId]);

  if (q.isLoading) return <Spinner />;
  const workspace = q.data?.find((w) => w.id === workspaceId);
  if (!workspace) return <Navigate to="/workspaces" replace />;

  const role = workspace.role;
  const ctx = {
    workspace,
    role,
    canEdit: roleAtLeast(role, 'DEVELOPER'),
    canManage: roleAtLeast(role, 'PROJECT_MANAGER'),
    isAdmin: role === 'WORKSPACE_ADMIN',
  };
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'block border-l-2 px-4 py-2 text-sm',
      isActive ? 'border-ink font-semibold text-ink' : 'border-transparent text-muted hover:text-ink',
    );

  return (
    <WorkspaceContext.Provider value={ctx}>
      <div className="flex h-screen">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-white md:flex">
          <div className="p-4">
            <p className="mb-3 text-lg font-semibold">DevForge</p>
            <Select
              aria-label="Switch workspace"
              value={workspace.id}
              onChange={(e) => navigate(e.target.value === '__new' ? '/workspaces' : `/w/${e.target.value}/dashboard`)}
            >
              {q.data!.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
              <option value="__new">Manage workspaces…</option>
            </Select>
          </div>
          <nav aria-label="Workspace" className="flex-1">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={linkClass}>{n.label}</NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2 border-t border-line p-3">
            <Avatar name={user?.name ?? '?'} />
            <span className="min-w-0 flex-1 truncate text-sm">{user?.name}</span>
            <Button variant="ghost" className="h-8 px-2" onClick={() => void logout()}>Sign out</Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-white px-3">
            <nav aria-label="Workspace" className="flex md:hidden">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} className={({ isActive }) => clsx('px-2 py-1 text-sm', isActive ? 'font-semibold' : 'text-muted')}>
                  {n.label}
                </NavLink>
              ))}
            </nav>
            <p className="hidden truncate font-medium md:block">{workspace.name}</p>
            <NotificationsBell />
          </header>
          <main className="min-h-0 flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}
