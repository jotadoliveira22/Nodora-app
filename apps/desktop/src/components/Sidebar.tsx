/** Barra lateral: workspace, favoritos, árbol de páginas, recientes (PRD R4). */
import { useMemo, useState } from 'react';
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Copy,
  FileText,
  FolderInput,
  MoreHorizontal,
  Plus,
  Search,
  Star,
  StarOff,
  Table,
} from 'lucide-react';
import type { PageSummary } from '@nodora/shared';

import { dbApi, pagesApi } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { ContextMenu, type MenuItem } from './ui';
import { MovePageModal } from './MovePageModal';
import { WorkspaceMenu } from './WorkspaceMenu';

interface TreeNode {
  page: PageSummary;
  children: TreeNode[];
}

function buildTree(pages: PageSummary[]): TreeNode[] {
  const byParent = new Map<string | null, PageSummary[]>();
  for (const p of pages) {
    const key = p.parentPageId;
    const arr = byParent.get(key) ?? [];
    arr.push(p);
    byParent.set(key, arr);
  }
  const make = (parent: string | null): TreeNode[] =>
    (byParent.get(parent) ?? []).map((page) => ({ page, children: make(page.id) }));
  return make(null);
}

export function Sidebar() {
  const {
    pages,
    favorites,
    recents,
    currentPageId,
    navigate,
    refreshTree,
    notifyError,
    setPaletteOpen,
    toast,
  } = useAppStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ x: number; y: number; page: PageSummary } | null>(null);
  const [movePage, setMovePage] = useState<PageSummary | null>(null);
  const tree = useMemo(() => buildTree(pages), [pages]);

  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const createPage = async (parent: string | null) => {
    try {
      const p = await pagesApi.create(parent, '');
      await refreshTree();
      if (parent) setExpanded((s) => new Set(s).add(parent));
      await navigate(p.id);
    } catch (e) {
      notifyError(e, 'No se pudo crear la página');
    }
  };

  const createDatabase = async () => {
    try {
      const d = await dbApi.create(null, 'Nueva base de datos');
      await refreshTree();
      await navigate(d.pageId);
    } catch (e) {
      notifyError(e, 'No se pudo crear la base de datos');
    }
  };

  const menuItems = (page: PageSummary): MenuItem[] => {
    const isFav = favorites.some((f) => f.id === page.id);
    return [
      {
        label: 'Nueva subpágina',
        icon: <Plus size={15} />,
        onClick: () => void createPage(page.id),
      },
      {
        label: isFav ? 'Quitar de favoritos' : 'Añadir a favoritos',
        icon: isFav ? <StarOff size={15} /> : <Star size={15} />,
        onClick: () =>
          void (isFav ? pagesApi.removeFavorite(page.id) : pagesApi.addFavorite(page.id))
            .then(refreshTree)
            .catch((e) => notifyError(e, 'No se pudo actualizar favoritos')),
      },
      {
        label: 'Duplicar',
        icon: <Copy size={15} />,
        onClick: () =>
          void pagesApi
            .duplicate(page.id)
            .then(async (id) => {
              await refreshTree();
              await navigate(id);
            })
            .catch((e) => notifyError(e, 'No se pudo duplicar')),
      },
      {
        label: 'Mover a…',
        icon: <FolderInput size={15} />,
        onClick: () => setMovePage(page),
      },
      { label: '', separator: true },
      {
        label: 'Archivar',
        icon: <Archive size={15} />,
        danger: true,
        onClick: () =>
          void pagesApi
            .archive(page.id)
            .then(async () => {
              toast('Página archivada. Puedes restaurarla desde el Archivo.');
              if (useAppStore.getState().currentPageId === page.id)
                useAppStore.getState().closeCurrentPage();
              await refreshTree();
            })
            .catch((e) => notifyError(e, 'No se pudo archivar')),
      },
    ];
  };

  const renderNode = (node: TreeNode, depth: number) => {
    const { page, children } = node;
    const isOpen = expanded.has(page.id);
    const active = currentPageId === page.id;
    return (
      <div
        key={page.id}
        role="treeitem"
        aria-selected={active}
        aria-expanded={page.hasChildren ? isOpen : undefined}
        aria-label={page.title || 'Sin título'}
      >
        <div
          className={`nd-tree-item${active ? ' nd-tree-item--active' : ''}`}
          style={{ paddingLeft: 6 + depth * 14 }}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu({ x: e.clientX, y: e.clientY, page });
          }}
        >
          <button
            className="nd-tree-toggle"
            aria-label={isOpen ? 'Contraer' : 'Expandir'}
            onClick={() => toggle(page.id)}
            tabIndex={-1}
          >
            {page.hasChildren ? (
              isOpen ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )
            ) : page.kind === 'database' ? (
              <Table size={13} />
            ) : (
              <FileText size={13} />
            )}
          </button>
          <button
            className="nd-tree-title"
            style={{ textAlign: 'left', color: 'inherit' }}
            onClick={() => void navigate(page.id)}
          >
            {page.icon ? `${page.icon} ` : ''}
            {page.title || 'Sin título'}
          </button>
          <span className="nd-tree-actions">
            <button
              className="nd-icon-btn"
              aria-label="Opciones de página"
              onClick={(e) => setMenu({ x: e.clientX, y: e.clientY, page })}
            >
              <MoreHorizontal size={14} />
            </button>
            <button
              className="nd-icon-btn"
              aria-label="Nueva subpágina"
              onClick={() => void createPage(page.id)}
            >
              <Plus size={14} />
            </button>
          </span>
        </div>
        {isOpen && children.length > 0 && (
          <div role="group">{children.map((c) => renderNode(c, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <nav className="nd-sidebar" aria-label="Navegación">
      <WorkspaceMenu />
      <button
        className="nd-tree-item"
        style={{ margin: '8px 8px 0', width: 'calc(100% - 16px)' }}
        onClick={() => setPaletteOpen(true)}
      >
        <Search size={14} style={{ color: 'var(--nd-text-muted)' }} />
        <span style={{ color: 'var(--nd-text-muted)', flex: 1, textAlign: 'left' }}>Buscar…</span>
        <span className="nd-kbd">Ctrl K</span>
      </button>

      <div className="nd-side-section" style={{ flex: 1 }}>
        {favorites.length > 0 && (
          <>
            <div className="nd-side-label" id="nd-favoritos">
              Favoritos
            </div>
            {favorites.map((p) => (
              <div
                key={p.id}
                className={`nd-tree-item${currentPageId === p.id ? ' nd-tree-item--active' : ''}`}
              >
                <Star size={13} style={{ color: 'var(--nd-warning)', flexShrink: 0 }} />
                <button
                  className="nd-tree-title"
                  style={{ textAlign: 'left', color: 'inherit' }}
                  onClick={() => void navigate(p.id)}
                >
                  {p.icon ? `${p.icon} ` : ''}
                  {p.title || 'Sin título'}
                </button>
              </div>
            ))}
          </>
        )}

        <div className="nd-side-label">
          Páginas
          <span>
            <button
              className="nd-icon-btn"
              aria-label="Nueva base de datos"
              title="Nueva base de datos"
              onClick={() => void createDatabase()}
            >
              <Table size={14} />
            </button>
            <button
              className="nd-icon-btn"
              aria-label="Nueva página"
              title="Nueva página (Ctrl+N)"
              onClick={() => void createPage(null)}
            >
              <Plus size={14} />
            </button>
          </span>
        </div>
        {tree.length > 0 && (
          <div role="tree" aria-label="Árbol de páginas">
            {tree.map((n) => renderNode(n, 0))}
          </div>
        )}
        {!tree.length && (
          <div style={{ padding: 12, color: 'var(--nd-text-muted)', fontSize: 13 }}>
            No hay páginas todavía. Crea la primera con +.
          </div>
        )}

        {recents.length > 0 && (
          <>
            <div className="nd-side-label" style={{ marginTop: 12 }}>
              Recientes
            </div>
            {recents.slice(0, 6).map((p) => (
              <div key={p.id} className="nd-tree-item">
                <FileText size={13} style={{ color: 'var(--nd-text-muted)', flexShrink: 0 }} />
                <button
                  className="nd-tree-title"
                  style={{ textAlign: 'left', color: 'inherit' }}
                  onClick={() => void navigate(p.id)}
                >
                  {p.icon ? `${p.icon} ` : ''}
                  {p.title || 'Sin título'}
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.page)}
          onClose={() => setMenu(null)}
        />
      )}
      {movePage && <MovePageModal page={movePage} onClose={() => setMovePage(null)} />}
    </nav>
  );
}
