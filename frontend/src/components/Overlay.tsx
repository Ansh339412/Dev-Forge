import { AnimatePresence, motion } from 'framer-motion';
import { ReactNode, useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

function useDialogBehaviour<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);
  // Parents pass a fresh onClose on every render. Keeping it in a ref means the effect below runs
  // only when the dialog opens or closes, so it cannot steal focus from the field being typed in.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open]);
  return ref;
}

/** Centered dialog. Opens in response to a click, so a short scale-in shows what changed. */
export function Modal({ open, onClose, title, children }: Props) {
  const ref = useDialogBehaviour<HTMLDivElement>(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-ink/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative w-full max-w-md rounded bg-white p-5 shadow-xl outline-none"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.12 }}
          >
            <h2 className="mb-4 text-base font-semibold">{title}</h2>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/** Right-hand panel used for task details. */
export function Drawer({ open, onClose, title, children }: Props) {
  const ref = useDialogBehaviour<HTMLElement>(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40">
          <motion.div
            className="absolute inset-0 bg-ink/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            ref={ref}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white shadow-xl outline-none"
            initial={{ x: 48, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 48, opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            {children}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
