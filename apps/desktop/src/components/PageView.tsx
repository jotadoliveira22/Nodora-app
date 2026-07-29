/** Vista de página: título, editor con autosave, breadcrumbs y backlinks. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  FileText,
  Image as ImageIcon,
  LayoutTemplate,
  MoreHorizontal,
  Smile,
  Star,
  Table,
} from 'lucide-react';
import { templateById, type PageDetail } from '@nodora/shared';
import {
  NodoraEditor,
  type EditorDocJson,
  type EditorHostCallbacks,
  type NodoraEditorInstance,
} from '@nodora/editor';

import { attachmentsApi, exportApi, isApiError, pagesApi } from '../services/api';
import { applyTemplate } from '../services/templates';
import { useAppStore } from '../stores/appStore';
import { ContextMenu, type MenuItem } from './ui';
import { DatabaseView } from './DatabaseView';
import { EmojiPicker } from './EmojiPicker';
import { CoverPicker, PageCover } from './PageCover';
import { RecordProperties } from './RecordProperties';
import { TemplatePicker } from './TemplatePicker';

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
  const [iconPicker, setIconPicker] = useState(false);
  const [coverPicker, setCoverPicker] = useState(false);
  const [templatePicker, setTemplatePicker] = useState(false);
  /** Cambia solo cuando el documento se reemplaza desde fuera del editor. */
  const [docEpoch, setDocEpoch] = useState(0);

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

  /**
   * Recarga la página. `replaceEditor` fuerza a recrear el editor porque el
   * contenido cambió por debajo (plantilla aplicada, recarga tras conflicto):
   * sin eso el editor seguiría mostrando el documento anterior, ya obsoleto.
   * No se hace siempre porque recrearlo pierde el cursor y el historial.
   */
  const load = useCallback(
    async (replaceEditor = false) => {
      try {
        const detail = await pagesApi.get(pageId);
        baseVersion.current = detail.version;
        dirty.current = null;
        setPage(detail);
        // El contador sube junto al contenido nuevo, no antes: hacerlo antes
        // recreaba el editor con el documento anterior, que era justo el que
        // se quería descartar.
        if (replaceEditor) setDocEpoch((n) => n + 1);
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
    },
    [pageId, notifyError, setSaveStatus],
  );

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
        // Se recrea el editor: el documento en pantalla ya no es el guardado.
        await load(true);
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

  /** Aplica el resultado de una escritura sobre la página sin recargarla. */
  const adoptar = useCallback(
    (cambios: Partial<PageDetail> & { version: number }) => {
      baseVersion.current = cambios.version;
      setPage((p) => (p ? { ...p, ...cambios } : p));
      if (cambios.icon !== undefined || cambios.title !== undefined) {
        setCrumbs((cs) =>
          cs.map((c) =>
            c.id === pageId
              ? {
                  ...c,
                  ...(cambios.icon !== undefined ? { icon: cambios.icon } : {}),
                  ...(cambios.title !== undefined ? { title: cambios.title } : {}),
                }
              : c,
          ),
        );
      }
    },
    [pageId],
  );

  const cambiarIcono = useCallback(
    async (icon: string | null) => {
      setIconPicker(false);
      try {
        const res = await pagesApi.setIcon(pageId, icon);
        adoptar({ icon, version: res.version });
        await refreshTree();
      } catch (e) {
        notifyError(e, 'No se pudo cambiar el icono');
      }
    },
    [pageId, adoptar, refreshTree, notifyError],
  );

  const cambiarPortada = useCallback(
    async (kind: string | null, value: string | null) => {
      setCoverPicker(false);
      try {
        const res = await pagesApi.setCover(pageId, kind, value);
        adoptar({ coverKind: kind, coverValue: value, version: res.version });
      } catch (e) {
        notifyError(e, 'No se pudo cambiar la portada');
      }
    },
    [pageId, adoptar, notifyError],
  );

  const usarPlantilla = useCallback(
    async (template: Parameters<typeof applyTemplate>[1]) => {
      setTemplatePicker(false);
      // Cualquier cambio pendiente se guarda antes: la plantilla escribe sobre
      // la misma página y un autosave posterior chocaría con su versión.
      if (timer.current) window.clearTimeout(timer.current);
      await persist();
      try {
        const res = await applyTemplate(pageId, template, baseVersion.current);
        if (res.isDatabase) {
          // La plantilla creó una base de datos como página hija: se abre.
          await refreshTree();
          const creada = useAppStore.getState().pages.find((p) => p.title === res.title);
          if (creada) await navigate(creada.id);
          toast(`Plantilla «${template.name}» aplicada`);
          return;
        }
        await load(true);
        await refreshTree();
        setTitleDraft(res.title);
        toast(`Plantilla «${template.name}» aplicada`);
      } catch (e) {
        notifyError(e, 'No se pudo aplicar la plantilla');
      }
    },
    [pageId, persist, load, refreshTree, navigate, toast, notifyError],
  );

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
    { label: '', separator: true },
    {
      label: 'Cambiar icono…',
      icon: <Smile size={15} />,
      onClick: () => setIconPicker(true),
    },
    {
      label: page?.coverKind ? 'Cambiar portada…' : 'Añadir portada…',
      icon: <ImageIcon size={15} />,
      onClick: () => setCoverPicker(true),
    },
    {
      label: 'Aplicar una plantilla…',
      icon: <LayoutTemplate size={15} />,
      onClick: () => setTemplatePicker(true),
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
  // Una página está «vacía» cuando no tiene ni título ni bloques con texto.
  // Es el momento en que ofrecer un punto de partida ayuda; después estorba.
  const vacia =
    page.kind === 'page' && !titleDraft.trim() && !JSON.stringify(initialDoc).includes('"text"');

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
        <PageCover
          kind={page.coverKind}
          value={page.coverValue}
          onEdit={() => setCoverPicker(true)}
        />
        <div className="nd-page-body">
          {/* Acciones de cabecera: siempre visibles mientras la página está
              vacía, y al pasar el cursor cuando ya tiene contenido. */}
          <div className={`nd-page-actions${vacia ? ' nd-page-actions--always' : ''}`}>
            {!page.icon && (
              <button className="nd-page-action" onClick={() => setIconPicker(true)}>
                <Smile size={14} /> Añadir icono
              </button>
            )}
            {!page.coverKind && (
              <button className="nd-page-action" onClick={() => setCoverPicker(true)}>
                <ImageIcon size={14} /> Añadir portada
              </button>
            )}
            <button className="nd-page-action" onClick={() => setTemplatePicker(true)}>
              <LayoutTemplate size={14} /> Usar plantilla
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {page.icon && (
              <button
                className="nd-page-icon-btn"
                aria-label="Icono de página"
                onClick={() => setIconPicker(true)}
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
              docKey={`${page.id}:${docEpoch}`}
              initialDoc={initialDoc}
              host={host}
              onDocChanged={onDocChanged}
              onReady={(ed) => {
                editorRef.current = ed;
              }}
            />
          )}

          {vacia && (
            <div className="nd-starter" aria-label="Punto de partida">
              <span className="nd-starter-label">Empieza por aquí</span>
              <button className="nd-starter-btn" onClick={() => setTemplatePicker(true)}>
                <LayoutTemplate size={14} /> Elegir plantilla
              </button>
              <button
                className="nd-starter-btn"
                onClick={() => void usarPlantilla(templateById('tareas-proyecto')!)}
              >
                <Table size={14} /> Base de datos de tareas
              </button>
              <button
                className="nd-starter-btn"
                onClick={() => void usarPlantilla(templateById('acta-reunion')!)}
              >
                <FileText size={14} /> Acta de reunión
              </button>
              <button
                className="nd-starter-btn"
                onClick={() => editorRef.current?.commands.focus('start')}
              >
                Página en blanco
              </button>
            </div>
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
      {iconPicker && (
        <EmojiPicker
          current={page.icon}
          onPick={(emoji) => void cambiarIcono(emoji)}
          onClose={() => setIconPicker(false)}
        />
      )}
      {coverPicker && (
        <CoverPicker
          onPick={(kind, value) => void cambiarPortada(kind, value)}
          onRemove={() => void cambiarPortada(null, null)}
          onClose={() => setCoverPicker(false)}
        />
      )}
      {templatePicker && (
        <TemplatePicker
          onPick={(t) => void usarPlantilla(t)}
          onClose={() => setTemplatePicker(false)}
        />
      )}
    </div>
  );
}
