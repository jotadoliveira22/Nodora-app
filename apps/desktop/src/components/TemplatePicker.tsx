/**
 * Selector de plantillas (docs/UX_IMPROVEMENTS_PLAN.md §1.4).
 *
 * Muestra el catálogo agrupado y, cuando una plantilla promete algo que la
 * aplicación todavía no hace del todo, su advertencia. Decirlo antes de
 * aplicarla es más barato que dejar que el usuario lo descubra usándola.
 */
import { useMemo, useState } from 'react';
import { TEMPLATE_GROUPS, TEMPLATES, type NodoraTemplate } from '@nodora/shared';

import { Modal } from './ui';

export function TemplatePicker({
  onPick,
  onClose,
}: {
  onPick: (template: NodoraTemplate) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<NodoraTemplate | null>(null);

  const filtradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TEMPLATES;
    return TEMPLATES.filter(
      (t) => t.name.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <Modal
      title="Elegir una plantilla"
      onClose={onClose}
      footer={
        <>
          <button className="nd-btn nd-btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="nd-btn nd-btn--primary"
            disabled={!selected}
            onClick={() => selected && onPick(selected)}
          >
            Usar plantilla
          </button>
        </>
      }
    >
      <input
        className="nd-input"
        placeholder="Buscar plantilla…"
        aria-label="Buscar plantilla"
        value={query}
        autoFocus
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="nd-template-list">
        {TEMPLATE_GROUPS.map((grupo) => {
          const items = filtradas.filter((t) => t.group === grupo.id);
          if (!items.length) return null;
          return (
            <section key={grupo.id}>
              <div className="nd-side-label" style={{ padding: '12px 0 4px' }}>
                {grupo.label}
              </div>
              {items.map((t) => (
                <button
                  key={t.id}
                  className={`nd-template-item${selected?.id === t.id ? ' nd-template-item--active' : ''}`}
                  aria-pressed={selected?.id === t.id}
                  onClick={() => setSelected(t)}
                  onDoubleClick={() => onPick(t)}
                >
                  <span className="nd-template-icon">{t.icon}</span>
                  <span style={{ flex: 1 }}>
                    <strong>{t.name}</strong>
                    <div style={{ fontSize: 12, color: 'var(--nd-text-muted)' }}>{t.summary}</div>
                  </span>
                  {t.database && <span className="nd-template-tag">base de datos</span>}
                </button>
              ))}
            </section>
          );
        })}
        {!filtradas.length && (
          <p style={{ color: 'var(--nd-text-muted)' }}>Ninguna plantilla coincide con «{query}».</p>
        )}
      </div>

      {selected?.caveat && (
        <p className="nd-danger-note" style={{ marginTop: 12 }} role="note">
          <strong>Ten en cuenta:</strong> {selected.caveat}
        </p>
      )}
    </Modal>
  );
}
