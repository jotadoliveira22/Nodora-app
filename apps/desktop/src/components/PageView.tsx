/** Vista de página: título, editor con autosave, breadcrumbs y backlinks. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { ArrowLeft, ArrowRight, Check, Download, MoreHorizontal, Star } from 'lucide-react';
import type { PageDetail } from '@nodora/shared';
import {
  NodoraEditor,
  type EditorDocJson,
  type EditorHostCallbacks,
  type NodoraEditorInstance,
} from '@nodora/editor';

import { attachmentsApi, exportApi, isApiError, pagesApi } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { ContextMenu, type MenuItem } from './ui';
import { DatabaseView } from './DatabaseView';
import { RecordProperties } from './RecordProperties';

const SAVE_DEBOUNCE_MS = 800;

interface Backlink {
  sourcePageId: string;
  title: string;
  icon: string | null;
  blockId: string;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function PageView({ pageId }: { pageId: string }) {
  const {
    navigate,
    goBack,
    goForward,
    refreshTree,
    setSaveStatus,
    saveStatus,
    notifyError,
    toast,
    favorites,
  } = useAppStore();
  const pages = useAppStore((s) => s.pages);
  const [page, setPage] = useState<PageDetail | null>(null);
  const [crumbs, setCrumbs] = useState<{ id: string; title: string; icon: string | null }[]>([]);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [titleDraft, setTitleDraft] = useState('');

  // Estado de guardado (refs para evitar renders en cada tecla).
  const baseVersion = useRef(0);
  const dirty = useRef<null | (() => EditorDocJson)>(null);
  const saving = useRef(false);
  const timer = useRef<number | null>(null);
  const editorRef = useRef<NodoraEditorInstance | null>(null);

  const titleMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of pages) m.set(p.id, p.title || 'Sin título');
    return m;
  }, [pages]);

  const load = useCallback(async () => {
    try {
      const detail = await pagesApi.get(pageId);
      baseVersion.current = detail.version;
      dirty.current = null;
      setPage(detail);
      setTitleDraft(detail.title);
      setSaveStatus('idle');
      const [bc, bl] = await Promise.all([
        pagesApi.breadcrumbs(pageId),
        pagesApi.backlinks(pageId),
      ]);
      setCrumbs(bc);
      setBacklinks(bl);
    } catch (e) {
      notifyError(e, 'No se pudo abrir la página');
      setPage(null);
    }
  }, [pageId, notifyError, setSaveStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(async () => {
    const getDoc = dirty.current;
    if (!getDoc || saving.current || !page) return;
    saving.current = true;
    dirty.current = null;
    setSaveStatus('saving');
    try {
      const json = JSON.stringify(getDoc());
      const res = await pagesApi.saveContent(page.id, json, baseVersion.current);
      baseVersion.current = res.version;
      setSaveStatus('saved');
      void pagesApi
        .backlinks(page.id)
        .then(setBacklinks)
        .catch(() => undefined);
    } catch (e) {
      if (isApiError(e) && e.code === 'VERSION_CONFLICT') {
        toast('El contenido cambió fuera de esta vista; recargando…', 'error');
        await load();
      } else {
        // El trabajo local no se pierde: se reintenta en el próximo cambio.
        dirty.current = getDoc;
        setSaveStatus('error');
        notifyError(e, 'No se pudo guardar');
      }
    } finally {
      saving.current = false;
      if (dirty.current) {
        // Cambios acumulados durante el guardado: persistir de nuevo.
        window.setTimeout(() => void persist(), 0);
      }
    }
  }, [page, setSaveStatus, notifyError, toast, load]);

  const onDocChanged = useCallback(
    (getDoc: () => EditorDocJson) => {
      dirty.current = getDoc;
      setSaveStatus('saving');
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void persist(), SAVE_DEBOUNCE_MS);
    },
    [persist, setSaveStatus],
  );

  // Flush al salir de la página o cerrar la ventana (PRD R3.7/R3.8).
  useEffect(() => {
    const flush = () => {
      if (timer.current) window.clearTimeout(timer.current);
      void persist();
    };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('blur', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('blur', flush);
      flush();
    };
  }, [persist]);

  const saveTitle = useCallback(async () => {
    if (!page || titleDraft === page.title) return;
    try {
      const res = await pagesApi.rename(page.id, titleDraft);
      // Renombrar incrementa la versión de la página: adoptarla evita que el
      // siguiente autosave choque con un conflicto espurio y pierda lo escrito.
      baseVersion.current = res.version;
      setPage({ ...page, title: titleDraft, version: res.version });
      // Los breadcrumbs muestran el título: hay que reflejar el cambio aquí
      // también, o seguirían mostrando el nombre anterior hasta recargar.
      setCrumbs((cs) => cs.map((c) => (c.id === page.id ? { ...c, title: titleDraft } : c)));
      await refreshTree();
    } catch (e) {
      notifyError(e, 'No se pudo renombrar');
    }
  }, [page, titleDraft, refreshTree, notifyError]);

  const host: EditorHostCallbacks = useMemo(
    () => ({
      searchLinkablePages: async (query) => {
        const res = await pagesApi.linkable(query, 15);
        return res.map((p) => ({ id: p.id, title: p.title, icon: p.icon }));
      },
      onRequestImage: async () => {
        const file = await openDialog({
          title: 'Insertar imagen',
          filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
        });
        if (typeof file !== 'string') return null;
        try {
          const info = await attachmentsApi.importFromPath(file);
          return { id: info.id, alt: info.originalName };
        } catch (e) {
          notifyError(e, 'No se pudo importar la imagen');
          return null;
        }
      },
      onCreateSubpage: async () => {
        try {
          const p = await pagesApi.create(pageId, '');
          await refreshTree();
          return p.id;
        } catch (e) {
          notifyError(e, 'No se pudo crear la subpágina');
          return null;
        }
      },
      resolvePageTitle: (id) => titleMap.get(id) ?? 'página',
      onNavigate: (id) => void navigate(id),
      resolveAttachmentUrl: (id) => attachmentsApi.resolveUrl(id),
      onPasteImage: async (file) => {
        try {
          const b64 = await fileToBase64(file);
          const info = await attachmentsApi.importBase64(file.name || 'imagen.png', b64);
          return { id: info.id, alt: info.originalName };
        } catch (e) {
          notifyError(e, 'No se pudo pegar la imagen');
          return null;
        }
      },
    }),
    [pageId, titleMap, navigate, refreshTree, notifyError],
  );

  const exportMd = async (includeSubpages: boolean) => {
    const dir = await openDialog({ directory: true, title: 'Carpeta de destino' });
    if (typeof dir !== 'string') return;
    try {
      const files = await exportApi.pageMarkdown(pageId, dir, includeSubpages);
      toast(`Exportado: ${files.length} archivo(s) Markdown`);
    } catch (e) {
      notifyError(e, 'No se pudo exportar');
    }
  };

  const isFav = favorites.some((f) => f.id === pageId);
  const pageMenu: MenuItem[] = [
    {
      label: 'Exportar a Markdown…',
      icon: <Download size={15} />,
      onClick: () => void exportMd(false),
    },
    {
      label: 'Exportar con subpáginas…',
      icon: <Download size={15} />,
      onClick: () => void exportMd(true),
    },
    { label: '', separator: true },
    {
      label: 'Cambiar icono…',
      onClick: () => {
        const icon = window.prompt('Emoji para la página (vacío para quitar):', page?.icon ?? '');
        if (icon === null || !page) return;
        void pagesApi
          .setIcon(page.id, icon.trim() || null)
          .then(async (res) => {
            const next = icon.trim() || null;
            baseVersion.current = res.version;
            setPage({ ...page, icon: next, version: res.version });
            setCrumbs((cs) => cs.map((c) => (c.id === page.id ? { ...c, icon: next } : c)));
            await refreshTree();
          })
          .catch((e) => notifyError(e, 'No se pudo cambiar el icono'));
      },
    },
  ];

  if (!page) {
    return (
      <div className="nd-empty">
        <div className="nd-spinner" aria-label="Cargando" />
      </div>
    );
  }

  const initialDoc = JSON.parse(page.contentJson) as EditorDocJson;

  return (
    <div className="nd-main">
      <div className="nd-topbar">
        <button className="nd-icon-btn" aria-label="Atrás (Alt+←)" onClick={goBack}>
          <ArrowLeft size={16} />
        </button>
        <button className="nd-icon-btn" aria-label="Adelante (Alt+→)" onClick={goForward}>
          <ArrowRight size={16} />
        </button>
        <div className="nd-breadcrumbs" aria-label="Ruta">
          {crumbs.map((c, i) => (
            <span key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {i > 0 && <span>/</span>}
              <button onClick={() => void navigate(c.id)}>
                {c.icon ? `${c.icon} ` : ''}
                {c.title || 'Sin título'}
              </button>
            </span>
          ))}
        </div>
        <span
          className={`nd-save-status${saveStatus === 'error' ? ' nd-save-status--error' : ''}`}
          aria-live="polite"
        >
          {saveStatus === 'saving' && (
            <>
              <span className="nd-spinner" style={{ width: 12, height: 12 }} /> Guardando…
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <Check size={13} /> Guardado
            </>
          )}
          {saveStatus === 'error' && '⚠ Error al guardar (se reintentará)'}
        </span>
        <button
          className="nd-icon-btn"
          aria-label={isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
          onClick={() =>
            void (isFav ? pagesApi.removeFavorite(pageId) : pagesApi.addFavorite(pageId))
              .then(refreshTree)
              .catch((e) => notifyError(e, 'No se pudo actualizar favoritos'))
          }
        >
          <Star size={16} fill={isFav ? 'var(--nd-warning)' : 'none'} />
        </button>
        <button
          className="nd-icon-btn"
          aria-label="Opciones de página"
          onClick={(e) => setMenu({ x: e.clientX, y: e.clientY })}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      <div className="nd-content">
        <div className="nd-page-body">
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {page.icon && (
              <button
                className="nd-page-icon-btn"
                aria-label="Icono de página"
                onClick={() => pageMenu[3]?.onClick?.()}
              >
                {page.icon}
              </button>
            )}
            <input
              className="nd-page-title"
              placeholder="Sin título"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => void saveTitle()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void saveTitle();
                  editorRef.current?.commands.focus('start');
                }
              }}
              aria-label="Título de la página"
            />
          </div>

          {page.kind === 'record' && page.parentPageId && (
            <RecordProperties recordPageId={page.id} databasePageId={page.parentPageId} />
          )}

          {page.kind === 'database' ? (
            <DatabaseView pageId={page.id} />
          ) : (
            <NodoraEditor
              docKey={page.id}
              initialDoc={initialDoc}
              host={host}
              onDocChanged={onDocChanged}
              onReady={(ed) => {
                editorRef.current = ed;
              }}
            />
          )}

          {backlinks.length > 0 && (
            <div className="nd-backlinks">
              <div className="nd-backlinks-title">{backlinks.length} página(s) enlazan aquí</div>
              {backlinks.map((b) => (
                <button
                  key={`${b.sourcePageId}-${b.blockId}`}
                  className="nd-backlink-item"
                  onClick={() => void navigate(b.sourcePageId)}
                >
                  {b.icon ? `${b.icon} ` : '📄 '}
                  {b.title || 'Sin título'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={pageMenu} onClose={() => setMenu(null)} />}
    </div>
  );
}
