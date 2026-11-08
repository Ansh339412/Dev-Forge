import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Avatar, EmptyState, ErrorNote, ProgressBar, Select, Spinner } from '../components/ui';
import { useWorkspace } from '../components/workspace-context';
import { get } from '../lib/api';
import { errMsg } from '../lib/errors';
import { fmtDay } from '../lib/format';
import type { Dashboard } from '../lib/types';

const AXIS = { fontSize: 12, fill: '#5B6577' };

export default function DashboardPage() {
  const { workspace } = useWorkspace();
  const [days, setDays] = useState(14);
  const q = useQuery({
    queryKey: ['ws', workspace.id, 'dashboard', days],
    queryFn: () => get<Dashboard>(`/workspaces/${workspace.id}/analytics/dashboard`, { days }),
  });

  if (q.isLoading) return <Spinner label="Loading dashboard" />;
  if (q.isError || !q.data) return <div className="p-6"><ErrorNote>{errMsg(q.error)}</ErrorNote></div>;
  const d = q.data;
  const t = d.totals;
  const metrics: { label: string; value: number; alert?: boolean }[] = [
    { label: 'Projects', value: t.totalProjects },
    { label: 'Active projects', value: t.activeProjects },
    { label: 'Pending tasks', value: t.pendingTasks },
    { label: 'Completed tasks', value: t.completedTasks },
    { label: 'Overdue tasks', value: t.overdueTasks, alert: t.overdueTasks > 0 },
  ];
  const people = d.productivity.members.map((m) => ({ name: m.user.name, completed: m.completedInWindow, open: m.openTasks }));
  const totalCreated = d.activity.reduce((s, x) => s + x.created, 0);
  const totalCompleted = d.activity.reduce((s, x) => s + x.completed, 0);

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <Select aria-label="Time window" className="w-40" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </Select>
      </header>

      <dl className="grid grid-cols-2 divide-x divide-line border border-line bg-white md:grid-cols-5">
        {metrics.map((m) => (
          <div key={m.label} className="px-4 py-3">
            <dt className="text-sm text-muted">{m.label}</dt>
            <dd className={`text-2xl font-semibold ${m.alert ? 'text-danger' : ''}`}>{m.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <figure className="border border-line bg-white p-4">
          <h2 className="mb-3 text-base font-semibold">Tasks created and completed</h2>
          <figcaption className="sr-only">
            {totalCreated} tasks created and {totalCompleted} completed in the last {days} days.
          </figcaption>
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={d.activity} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#DDE2E9" vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtDay} tick={AXIS} minTickGap={24} />
                <YAxis allowDecimals={false} tick={AXIS} />
                <Tooltip labelFormatter={(v) => fmtDay(String(v))} />
                <Legend />
                <Line type="monotone" dataKey="created" name="Created" stroke="#2F6FDB" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="completed" name="Completed" stroke="#1E8E7E" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </figure>

        <figure className="border border-line bg-white p-4">
          <h2 className="mb-3 text-base font-semibold">Team productivity</h2>
          <figcaption className="sr-only">Tasks completed in the last {days} days and open tasks, per team member.</figcaption>
          {people.length === 0 ? (
            <EmptyState title="No assigned work yet">Assign tasks to teammates to see who is shipping.</EmptyState>
          ) : (
            <div style={{ height: Math.max(200, people.length * 44 + 40) }}>
              <ResponsiveContainer>
                <BarChart data={people} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="#DDE2E9" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={AXIS} />
                  <YAxis type="category" dataKey="name" width={110} tick={AXIS} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed" name={`Completed (${days}d)`} fill="#1E8E7E" />
                  <Bar dataKey="open" name="Open now" fill="#8A94A6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </figure>
      </div>

      <section className="border border-line bg-white p-4">
        <h2 className="mb-3 text-base font-semibold">Project completion</h2>
        {d.projectCompletion.length === 0 ? (
          <EmptyState title="No projects yet">Create a project to track its progress here.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {d.projectCompletion.map((p) => (
              <li key={p.id} className="grid items-center gap-3 md:grid-cols-[14rem_1fr_9rem]">
                <span className="truncate font-medium">{p.name}</span>
                <ProgressBar percent={p.completionPercent} label={`${p.name} completion`} />
                <span className="text-sm text-muted">{p.completedTasks} of {p.totalTasks} done ({p.completionPercent}%)</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {d.productivity.members.length > 0 && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Avatar name={d.productivity.members[0].user.name} size={20} />
          {d.productivity.members[0].user.name} completed the most tasks in this window ({d.productivity.members[0].completedInWindow}).
        </p>
      )}
    </div>
  );
}
