import clsx from 'clsx';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { STATUS_META, STATUSES } from '../lib/meta';
import { useAuth } from '../stores/auth';

// Card heights per column: work thins out toward the right as it gets done.
const SHAPES = [[3, 2, 1], [2, 2], [2, 1], [1, 1], [2]];

export function AuthLayout() {
  const bootstrap = useAuth((s) => s.bootstrap);
  useEffect(() => {
    void bootstrap(); // lets a returning user skip the sign-in form
  }, [bootstrap]);

  return (
    <div className="grid min-h-screen md:grid-cols-[5fr_6fr]">
      <aside className="hidden flex-col justify-between bg-ink p-10 text-white md:flex">
        <div>
          <p className="text-xl font-semibold">DevForge</p>
          <p className="mt-3 max-w-xs text-white/70">Keep every project, task and teammate in one place.</p>
        </div>
        <div aria-hidden className="flex gap-2">
          {STATUSES.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={clsx('h-1 rounded-full', STATUS_META[s].bar)} />
              <div className="mt-2 space-y-1.5">
                {SHAPES[i].map((h, j) => (
                  <div key={j} className="rounded bg-white/10" style={{ height: h * 20 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>
      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
