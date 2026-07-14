/**
 * Estado de aplicación (Zustand, ADR-007). Separación:
 *  - Este store: estado visual + navegación + caché de listas.
 *  - El documento en edición vive en el editor.
 *  - La verdad persistida vive en SQLite (vía services/api).
 */
import { create } from 'zustand';
import type { KnownWorkspace, PageSummary, WorkspaceInfo } from '@nodora/shared';

import { isApiError, pagesApi, workspaceApi } from '../services/api';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type Theme = 'light' | 'dark' | 'system';

export interface Toast {
  id: number;
  kind: 'info' | 'error';
  text: string;
}

interface AppState {
  booted: boolean;
  workspace: WorkspaceInfo | null;
  knownWorkspaces: KnownWorkspace[];
  pages: PageSummary[];
  favorites: PageSummary[];
  recents: PageSummary[];
  currentPageId: string | null;
  history: string[];
  historyIndex: number;
  saveStatus: SaveStatus;
  theme: Theme;
  paletteOpen: boolean;
  toasts: Toast[];

  boot: () => Promise<void>;
  setWorkspace: (ws: WorkspaceInfo | null) => Promise<void>;
  refreshTree: () => Promise<void>;
  navigate: (pageId: string, opts?: { push?: boolean }) => Promise<void>;
  goBack: () => void;
  goForward: () => void;
  closeCurrentPage: () => void;
  setSaveStatus: (s: SaveStatus) => void;
  setTheme: (t: Theme) => Promise<void>;
  setPaletteOpen: (open: boolean) => void;
  toast: (text: string, kind?: 'info' | 'error') => void;
  dismissToast: (id: number) => void;
  notifyError: (e: unknown, fallback: string) => void;
}

let toastSeq = 1;

function applyTheme(theme: Theme) {
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;
  document.documentElement.dataset['theme'] = resolved;
}

export const useAppStore = create<AppState>((set, get) => ({
  booted: false,
  workspace: null,
  knownWorkspaces: [],
  pages: [],
  favorites: [],
  recents: [],
  currentPageId: null,
  history: [],
  historyIndex: -1,
  saveStatus: 'idle',
  theme: 'system',
  paletteOpen: false,
  toasts: [],

  boot: async () => {
    try {
      const themeSetting = (await workspaceApi.getSetting('theme')) as Theme | null;
      const theme = themeSetting ?? 'system';
      applyTheme(theme);
      const ws = await workspaceApi.openLast();
      const known = await workspaceApi.listKnown();
      set({ theme, knownWorkspaces: known });
      if (ws) {
        await get().setWorkspace(ws);
        const lastPage = await workspaceApi.getSetting(`last_page:${ws.id}`);
        const pages = get().pages;
        const target =
          (lastPage && pages.some((p) => p.id === lastPage) && lastPage) || pages[0]?.id || null;
        if (target) await get().navigate(target);
      }
    } catch (e) {
      get().notifyError(e, 'No se pudo iniciar Nodora');
    } finally {
      set({ booted: true });
    }
  },

  setWorkspace: async (ws) => {
    set({
      workspace: ws,
      currentPageId: null,
      history: [],
      historyIndex: -1,
      pages: [],
      favorites: [],
      recents: [],
    });
    if (ws) {
      await get().refreshTree();
      const known = await workspaceApi.listKnown();
      set({ knownWorkspaces: known });
    }
  },

  refreshTree: async () => {
    try {
      const [pages, favorites, recents] = await Promise.all([
        pagesApi.list(),
        pagesApi.listFavorites(),
        pagesApi.listRecents(10),
      ]);
      set({ pages, favorites, recents });
    } catch (e) {
      get().notifyError(e, 'No se pudo cargar el árbol de páginas');
    }
  },

  navigate: async (pageId, opts) => {
    const { currentPageId, history, historyIndex, workspace } = get();
    if (currentPageId === pageId) return;
    const push = opts?.push ?? true;
    let newHistory = history;
    let newIndex = historyIndex;
    if (push) {
      newHistory = [...history.slice(0, historyIndex + 1), pageId].slice(-100);
      newIndex = newHistory.length - 1;
    }
    set({ currentPageId: pageId, history: newHistory, historyIndex: newIndex });
    void pagesApi.touchRecent(pageId).then(() => {
      void pagesApi.listRecents(10).then((recents) => set({ recents }));
    });
    if (workspace) void workspaceApi.setSetting(`last_page:${workspace.id}`, pageId);
  },

  goBack: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const idx = historyIndex - 1;
      const target = history[idx];
      if (target !== undefined) {
        set({ historyIndex: idx });
        void get().navigate(target, { push: false });
        set({ historyIndex: idx });
      }
    }
  },

  goForward: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const idx = historyIndex + 1;
      const target = history[idx];
      if (target !== undefined) {
        set({ historyIndex: idx });
        void get().navigate(target, { push: false });
        set({ historyIndex: idx });
      }
    }
  },

  closeCurrentPage: () => set({ currentPageId: null }),

  setSaveStatus: (saveStatus) => set({ saveStatus }),

  setTheme: async (theme) => {
    applyTheme(theme);
    set({ theme });
    await workspaceApi.setSetting('theme', theme);
  },

  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),

  toast: (text, kind = 'info') => {
    const id = toastSeq++;
    set((s) => ({ toasts: [...s.toasts, { id, kind, text }] }));
    window.setTimeout(() => get().dismissToast(id), 5000);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  notifyError: (e, fallback) => {
    const msg = isApiError(e) ? e.message : fallback;
    console.error(fallback, e);
    get().toast(msg, 'error');
  },
}));
