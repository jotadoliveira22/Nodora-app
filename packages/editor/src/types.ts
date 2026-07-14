/** Contratos entre el editor y la aplicación host (ADR-004). */

export interface LinkablePage {
  id: string;
  title: string;
  icon: string | null;
}

export interface EditorHostCallbacks {
  /** Búsqueda de páginas para el menú @ y /enlace. */
  searchLinkablePages: (query: string) => Promise<LinkablePage[]>;
  /** Pide al host una imagen (diálogo nativo / import). null si cancela. */
  onRequestImage: () => Promise<{ id: string; alt?: string } | null>;
  /** Crea una subpágina de la página actual y devuelve su id. */
  onCreateSubpage: () => Promise<string | null>;
  /** Resuelve el título actual de una página (para pageLink/subpage). */
  resolvePageTitle: (pageId: string) => string | null;
  /** Navega a una página. */
  onNavigate: (pageId: string) => void;
  /** URL renderizable de un adjunto, o null si falta. */
  resolveAttachmentUrl: (attachmentId: string) => Promise<string | null>;
  /** Imagen pegada/arrastrada: el host la importa y devuelve su id. */
  onPasteImage: (file: File) => Promise<{ id: string; alt?: string } | null>;
}

/** Documento serializado del editor (árbol ProseMirror JSON). */
export type EditorDocJson = Record<string, unknown>;

export const EMPTY_DOC: EditorDocJson = { type: 'doc', content: [] };
