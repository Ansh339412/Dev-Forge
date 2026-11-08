import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, post } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import { useSocketEvent } from '../lib/realtime';
import type { AppNotification, Page } from '../lib/types';
import { toast } from '../stores/toast';
import { Button } from './ui';

export function NotificationsBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const count = useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: () => get<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 60_000,
  });
  const list = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => get<Page<AppNotification>>('/notifications', { limit: 15 }),
    enabled: open,
  });

  useSocketEvent<AppNotification>('notification', (n) => {
    toast.info(n.title);
    void qc.invalidateQueries({ queryKey: ['notifications'] });
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  const markRead = useMutation({ mutationFn: (id: string) => post(`/notifications/${id}/read`), onSuccess: refresh });
  const markAll = useMutation({ mutationFn: () => post('/notifications/read-all'), onSuccess: refresh });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function openItem(n: AppNotification) {
    if (!n.readAt) markRead.mutate(n.id);
    setOpen(false);
    if (n.workspaceId && n.projectId) {
      navigate(`/w/${n.workspaceId}/projects/${n.projectId}${n.taskId ? `?task=${n.taskId}` : ''}`);
    }
  }

  const unread = count.data?.count ?? 0;
  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative inline-flex h-9 items-center rounded px-3 text-sm text-muted hover:bg-surface hover:text-ink"
      >
        Notifications
        {unread > 0 && (
          <span className="ml-2 rounded-full bg-heat-ember px-1.5 text-xs font-semibold text-white">{unread > 99 ? '99+' : unread}</span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute right-0 z-30 mt-1 w-96 max-w-[90vw] rounded border border-line bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <span className="font-semibold">Notifications</span>
              <Button variant="ghost" className="h-7" disabled={!unread} onClick={() => markAll.mutate()}>
                Mark all read
              </Button>
            </div>
            <ul className="max-h-96 overflow-y-auto">
              {list.data?.items.map((n) => (
                <li key={n.id}>
                  <button onClick={() => openItem(n)} className="flex w-full gap-2 px-3 py-2.5 text-left hover:bg-surface">
                    <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-heat-ember'}`} />
                    <span>
                      <span className={n.readAt ? 'text-muted' : 'font-medium'}>{n.title}</span>
                      {n.body && <span className="block text-xs text-muted">{n.body}</span>}
                      <span className="block text-xs text-muted">{fmtDateTime(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
              {list.data && list.data.items.length === 0 && (
                <li className="px-3 py-8 text-center text-muted">Nothing yet. Assignments and comments will show up here.</li>
              )}
              {list.isLoading && <li className="px-3 py-8 text-center text-muted">Loading…</li>}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
