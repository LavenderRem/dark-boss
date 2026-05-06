import { useEffect } from 'react';

export function useKeyboardShortcuts(handlers: {
  onCreate?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onViewChange?: (view: number) => void;
  onEscape?: () => void;
  onSelectAll?: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      switch (e.key) {
        case 'n':
          handlers.onCreate?.();
          break;
        case 'e':
          handlers.onEdit?.();
          break;
        case 'Delete':
          handlers.onDelete?.();
          break;
        case 'Escape':
          handlers.onEscape?.();
          break;
        case '1':
          handlers.onViewChange?.(0);
          break;
        case '2':
          handlers.onViewChange?.(1);
          break;
        case '3':
          handlers.onViewChange?.(2);
          break;
        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handlers.onSelectAll?.();
          }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handlers]);
}
