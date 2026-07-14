/** Editor de celda por tipo de propiedad (PRD R6). */
import { useEffect, useRef, useState } from 'react';

import { dbApi, type DbProperty } from '../services/api';
import { useAppStore } from '../stores/appStore';

interface SelectOption {
  id: string;
  name: string;
  color: string;
}

export function parseOptions(configJson: string): SelectOption[] {
  try {
    const cfg = JSON.parse(configJson) as { options?: SelectOption[] };
    return cfg.options ?? [];
  } catch {
    return [];
  }
}

function parseValue(valueJson: string | undefined): Record<string, unknown> {
  if (!valueJson) return {};
  try {
    return JSON.parse(valueJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function displayValue(prop: DbProperty, valueJson: string | undefined): string {
  const v = parseValue(valueJson);
  switch (prop.type) {
    case 'text':
      return (v['text'] as string) ?? '';
    case 'url':
      return (v['url'] as string) ?? '';
    case 'number': {
      const n = v['number'];
      return typeof n === 'number' ? String(n) : '';
    }
    case 'date': {
      const d = v['date'] as { start?: string } | undefined;
      return d?.start?.slice(0, 10) ?? '';
    }
    case 'checkbox':
      return v['checkbox'] ? '✓' : '';
    default:
      return '';
  }
}

export function CellEditor({
  prop,
  valueJson,
  onSave,
}: {
  prop: DbProperty;
  valueJson: string | undefined;
  onSave: (valueJson: string | null) => Promise<void>;
}) {
  const { notifyError } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const v = parseValue(valueJson);
  const options = parseOptions(prop.configJson);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const save = async (value: string | null) => {
    try {
      await onSave(value);
    } catch (e) {
      notifyError(e, 'No se pudo guardar el valor');
    }
  };

  const addOption = async (name: string): Promise<string | null> => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = options.find((o) => o.name === trimmed);
    if (existing) return existing.id;
    const colors = ['gray', 'green', 'blue', 'amber', 'purple', 'red', 'teal', 'pink'];
    const opt: SelectOption = {
      id: crypto.randomUUID(),
      name: trimmed,
      color: colors[options.length % colors.length] ?? 'gray',
    };
    try {
      await dbApi.setPropertyConfig(prop.id, JSON.stringify({ options: [...options, opt] }));
      return opt.id;
    } catch (e) {
      notifyError(e, 'No se pudo crear la opción');
      return null;
    }
  };

  // ---- checkbox: edición directa ----
  if (prop.type === 'checkbox') {
    const checked = Boolean(v['checkbox']);
    return (
      <button
        className="nd-db-cell"
        role="checkbox"
        aria-checked={checked}
        onClick={() => void save(JSON.stringify({ checkbox: !checked }))}
      >
        {checked ? '☑' : '☐'}
      </button>
    );
  }

  // ---- select / status ----
  if (prop.type === 'select' || prop.type === 'status') {
    const currentId = v[prop.type] as string | undefined;
    const current = options.find((o) => o.id === currentId);
    if (!editing) {
      return (
        <button className="nd-db-cell" onClick={() => setEditing(true)}>
          {current ? (
            <span className="nd-tag" style={tagStyle(current.color)}>
              {current.name}
            </span>
          ) : (
            <span style={{ color: 'var(--nd-text-muted)' }}>—</span>
          )}
        </button>
      );
    }
    return (
      <select
        className="nd-db-cell-input"
        autoFocus
        value={currentId ?? ''}
        onBlur={() => setEditing(false)}
        onChange={(e) => {
          const val = e.target.value;
          if (val === '__new__') {
            const name = window.prompt('Nueva opción:');
            if (name)
              void addOption(name).then((id) => {
                if (id) void save(JSON.stringify({ [prop.type]: id }));
              });
          } else if (val === '') {
            void save(null);
          } else {
            void save(JSON.stringify({ [prop.type]: val }));
          }
          setEditing(false);
        }}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
        <option value="__new__">+ Nueva opción…</option>
      </select>
    );
  }

  // ---- multi_select ----
  if (prop.type === 'multi_select') {
    const ids = (v['multi_select'] as string[] | undefined) ?? [];
    const selected = options.filter((o) => ids.includes(o.id));
    if (!editing) {
      return (
        <button className="nd-db-cell" onClick={() => setEditing(true)}>
          {selected.length ? (
            selected.map((o) => (
              <span key={o.id} className="nd-tag" style={tagStyle(o.color)}>
                {o.name}
              </span>
            ))
          ) : (
            <span style={{ color: 'var(--nd-text-muted)' }}>—</span>
          )}
        </button>
      );
    }
    return (
      <div
        style={{ padding: 6 }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setEditing(false);
        }}
      >
        {options.map((o) => (
          <label key={o.id} style={{ display: 'flex', gap: 6, padding: '2px 4px' }}>
            <input
              type="checkbox"
              checked={ids.includes(o.id)}
              onChange={(e) => {
                const next = e.target.checked ? [...ids, o.id] : ids.filter((i) => i !== o.id);
                void save(next.length ? JSON.stringify({ multi_select: next }) : null);
              }}
            />
            <span className="nd-tag" style={tagStyle(o.color)}>
              {o.name}
            </span>
          </label>
        ))}
        <button
          className="nd-btn nd-btn--ghost"
          style={{ marginTop: 4, fontSize: 12 }}
          onClick={() => {
            const name = window.prompt('Nueva opción:');
            if (name)
              void addOption(name).then((id) => {
                if (id) void save(JSON.stringify({ multi_select: [...ids, id] }));
              });
          }}
        >
          + Opción
        </button>
        <button
          className="nd-btn nd-btn--ghost"
          style={{ marginLeft: 6, fontSize: 12 }}
          onClick={() => setEditing(false)}
        >
          Cerrar
        </button>
      </div>
    );
  }

  // ---- date ----
  if (prop.type === 'date') {
    if (!editing) {
      return (
        <button className="nd-db-cell" onClick={() => setEditing(true)}>
          {displayValue(prop, valueJson) || (
            <span style={{ color: 'var(--nd-text-muted)' }}>—</span>
          )}
        </button>
      );
    }
    return (
      <input
        ref={inputRef}
        type="date"
        className="nd-db-cell-input"
        defaultValue={displayValue(prop, valueJson)}
        onBlur={(e) => {
          const val = e.target.value;
          void save(val ? JSON.stringify({ date: { start: val, end: null } }) : null);
          setEditing(false);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    );
  }

  // ---- text / number / url ----
  if (!editing) {
    const text = displayValue(prop, valueJson);
    return (
      <button
        className="nd-db-cell"
        onClick={() => {
          setDraft(text);
          setEditing(true);
        }}
      >
        {prop.type === 'url' && text ? (
          <span style={{ color: 'var(--nd-accent)', textDecoration: 'underline' }}>{text}</span>
        ) : (
          text || <span style={{ color: 'var(--nd-text-muted)' }}>—</span>
        )}
      </button>
    );
  }
  return (
    <input
      ref={inputRef}
      className="nd-db-cell-input"
      type={prop.type === 'number' ? 'number' : 'text'}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const t = draft.trim();
        if (!t) void save(null);
        else if (prop.type === 'number') {
          const n = Number(t.replace(',', '.'));
          void save(Number.isFinite(n) ? JSON.stringify({ number: n }) : null);
        } else if (prop.type === 'url') {
          void save(JSON.stringify({ url: t }));
        } else {
          void save(JSON.stringify({ text: t }));
        }
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setEditing(false);
      }}
    />
  );
}

function tagStyle(color: string): React.CSSProperties {
  return {
    background: `var(--nd-tag-${color}, var(--nd-tag-gray))`,
    color: `var(--nd-tag-${color}-text, var(--nd-tag-gray-text))`,
  };
}
