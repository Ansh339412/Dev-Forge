import { create } from 'zustand';

export interface ToastItem {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}

let nextId = 1;
export const useToasts = create<{ items: ToastItem[]; dismiss: (id: number) => void }>()((set) => ({
  items: [],
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

const push = (kind: ToastItem['kind'], text: string) => {
  const id = nextId++;
  useToasts.setState((s) => ({ items: [...s.items, { id, kind, text }].slice(-4) }));
  setTimeout(() => useToasts.getState().dismiss(id), kind === 'error' ? 7000 : 4000);
};

export const toast = {
  success: (text: string) => push('success', text),
  error: (text: string) => push('error', text),
  info: (text: string) => push('info', text),
};
