import clsx from 'clsx';
import { useToasts } from '../stores/toast';

export function Toasts() {
  const { items, dismiss } = useToasts();
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
      {items.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={clsx(
            'pointer-events-auto rounded border bg-white px-3 py-2 text-left text-sm shadow-lg',
            t.kind === 'error' ? 'border-danger/40 text-danger' : 'border-line text-ink',
          )}
        >
          {t.text}
        </button>
      ))}
    </div>
  );
}
