import clsx from 'clsx';
import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, useId } from 'react';
import { initials } from '../lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-white hover:bg-ink-soft disabled:opacity-50',
  secondary: 'bg-white text-ink border border-line hover:bg-surface disabled:opacity-50',
  ghost: 'text-muted hover:bg-surface hover:text-ink disabled:opacity-50',
  danger: 'bg-danger text-white hover:opacity-90 disabled:opacity-50',
};

export function Button({
  variant = 'secondary',
  loading,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded px-3 h-9 text-sm font-medium transition-colors disabled:cursor-not-allowed',
        VARIANTS[variant],
        className,
      )}
    >
      {loading ? 'Working…' : children}
    </button>
  );
}

const control =
  'w-full rounded border border-line bg-white px-3 text-sm text-ink placeholder:text-muted/70 disabled:bg-surface disabled:text-muted';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export const Input = ({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...rest} className={clsx(control, 'h-9', className)} />
);
export const Textarea = ({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...rest} className={clsx(control, 'py-2 min-h-[88px] resize-y', className)} />
);
export const Select = ({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...rest} className={clsx(control, 'h-9', className)} />
);

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      title={name}
      aria-label={name}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-ink/10 font-semibold text-ink"
    >
      {initials(name)}
    </span>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center p-10 text-sm text-muted">
      {label}…
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 w-full overflow-hidden rounded-full bg-line"
    >
      <div className="h-full bg-heat-temper" style={{ width: `${percent}%` }} />
    </div>
  );
}
