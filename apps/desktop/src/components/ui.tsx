/** Primitivas de UI de Nodora (accesibles, tematizadas por tokens). */
import { useEffect, useRef, type ReactNode } from 'react';

import { useAppStore } from '../stores/appStore';

export function Modal({
  title,
  children,
  footer,
  onClose,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input, button, [tabindex]')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="nd-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="nd-modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="nd-modal-header">{title}</div>
        <div className="nd-modal-body">{children}</div>
        {footer && <div className="nd-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  separator?: boolean;
  onClick?: () => void;
}

export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  const maxY = typeof window !== 'undefined' ? window.innerHeight - 10 : y;
  const maxX = typeof window !== 'undefined' ? window.innerWidth - 220 : x;
  return (
    <div
      className="nd-context-menu"
      style={{ top: Math.min(y, maxY - items.length * 34), left: Math.min(x, maxX) }}
      role="menu"
      ref={ref}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} className="nd-context-sep" />
        ) : (
          <button
            key={i}
            role="menuitem"
            className={`nd-context-item${item.danger ? ' nd-context-item--danger' : ''}`}
            onClick={() => {
              onClose();
              item.onClick?.();
            }}
          >
            {item.icon}
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}

export function Toasts() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);
  if (!toasts.length) return null;
  return (
    <div className="nd-toast-wrap" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`nd-toast${t.kind === 'error' ? ' nd-toast--error' : ''}`}
          onClick={() => dismiss(t.id)}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="nd-empty">
      <div>
        <div style={{ fontSize: 40 }}>{emoji}</div>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
