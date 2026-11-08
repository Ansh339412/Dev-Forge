const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const fmtDate = (iso: string) => dateFmt.format(new Date(iso));
export const fmtDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));
/** Value for <input type="date"> from an ISO string (UTC date part). */
export const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
export const isOverdue = (due: string | null, completed: boolean) =>
  !!due && !completed && new Date(due).getTime() < Date.now();
export const fmtBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
const dayFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
/** Formats a YYYY-MM-DD string (a UTC day from the API) without shifting it to the local day. */
export const fmtDay = (day: string) => dayFmt.format(new Date(`${day}T00:00:00Z`));
