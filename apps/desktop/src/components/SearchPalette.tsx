/** Paleta de búsqueda y apertura rápida (Ctrl+K; PRD R4.6/R5, F7). */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SearchResultItem } from '@nodora/shared';

import { searchApi } from '../services/api';
import { useAppStore } from '../stores/appStore';

/** Convierte el snippet con marcadores « » del backend a nodos React seguros. */
export function renderSnippet(snippet: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = snippet;
  let key = 0;
  while (rest.length) {
    const start = rest.indexOf('«');
    if (start < 0) {
      out.push(rest);
      break;
    }
    const end = rest.indexOf('»', start);
    if (end < 0) {
      out.push(rest);
      break;
    }
    if (start > 0) out.push(rest.slice(0, start));
    out.push(<mark key={key++}>{rest.slice(start + 1, end)}</mark>);
    rest = rest.slice(end + 1);
  }
  return out;
}

export function SearchPalette() {
  const { paletteOpen, setPaletteOpen, navigate, recents, favorites, notifyError } = useAppStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [titlesOnly, setTitlesOnly] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (paletteOpen) {
      setQuery('');
      setResults([]);
      setSelected(0);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [paletteOpen]);

  useEffect(() => {
    if (!paletteOpen) return;
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const mySeq = ++seq.current;
    const t = window.setTimeout(() => {
      searchApi
        .search(query, includeArchived, titlesOnly, 30)
        .then((res) => {
          if (mySeq === seq.current) {
            setResults(res);
            setSelected(0);
          }
        })
        .catch((e) => notifyError(e, 'Error de búsqueda'));
    }, 120);
    return () => window.clearTimeout(t);
  }, [query, includeArchived, titlesOnly, paletteOpen, notifyError]);

  const fallbackItems = useMemo(() => {
    const seen = new Set<string>();
    const items: { id: string; title: string; icon: string | null; section: string }[] = [];
    for (const f of favorites) {
      if (!seen.has(f.id)) {
        items.push({ id: f.id, title: f.title, icon: f.icon, section: '⭐' });
        seen.add(f.id);
      }
    }
    for (const r of recents) {
      if (!seen.has(r.id)) {
        items.push({ id: r.id, title: r.title, icon: r.icon, section: '🕐' });
        seen.add(r.id);
      }
    }
    return items.slice(0, 12);
  }, [favorites, recents]);

  if (!paletteOpen) return null;

  const items = query.trim()
    ? results.map((r) => ({
        id: r.pageId,
        title: r.title,
        icon: r.icon,
        snippet: r.snippet,
        archived: r.archived,
      }))
    : fallbackItems.map((f) => ({
        id: f.id,
        title: `${f.section} ${f.title}`,
        icon: f.icon,
        snippet: '',
        archived: false,
      }));

  const open = (id: string) => {
    setPaletteOpen(false);
    void navigate(id);
  };

  return (
    <div
      className="nd-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && setPaletteOpen(false)}
    >
      <div className="nd-modal" role="dialog" aria-label="Buscar">
        <input
          ref={inputRef}
          className="nd-palette-input"
          placeholder="Buscar páginas y contenido…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setPaletteOpen(false);
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSelected((s) => Math.min(s + 1, items.length - 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSelected((s) => Math.max(s - 1, 0));
            }
            if (e.key === 'Enter' && items[selected]) open(items[selected].id);
          }}
        />
        <div className="nd-chips">
          <button
            className={`nd-chip${includeArchived ? ' nd-chip--on' : ''}`}
            onClick={() => setIncludeArchived(!includeArchived)}
          >
            incluir archivadas
          </button>
          <button
            className={`nd-chip${titlesOnly ? ' nd-chip--on' : ''}`}
            onClick={() => setTitlesOnly(!titlesOnly)}
          >
            solo títulos
          </button>
        </div>
        <div className="nd-palette-list" role="listbox" aria-label="Resultados de búsqueda">
          {items.map((item, i) => (
            <button
              key={item.id}
              role="option"
              aria-selected={i === selected}
              className={`nd-palette-item${i === selected ? ' nd-palette-item--active' : ''}`}
              onMouseEnter={() => setSelected(i)}
              onClick={() => open(item.id)}
            >
              <div>
                {item.icon ? `${item.icon} ` : '📄 '}
                {item.title || 'Sin título'}
                {'archived' in item && item.archived ? ' (archivada)' : ''}
              </div>
              {'snippet' in item && item.snippet && (
                <div className="nd-palette-snippet">{renderSnippet(item.snippet)}</div>
              )}
            </button>
          ))}
          {query.trim() && !results.length && (
            <div style={{ padding: 16, color: 'var(--nd-text-muted)' }}>Sin resultados.</div>
          )}
        </div>
      </div>
    </div>
  );
}
