/**
 * Fachada tipada de los comandos IPC (implementación local de
 * LocalRepository, docs/ARCHITECTURE.md). Único lugar del frontend que
 * conoce Tauri invoke.
 */
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import type {
  AttachmentInfo,
  BackupSummary,
  KnownWorkspace,
  PageDetail,
  PageSummary,
  SearchResultItem,
  WorkspaceInfo,
} from '@nodora/shared';

export interface ApiError {
  code: string;
  message: string;
}

export function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'code' in e && 'message' in e;
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    if (isApiError(e)) throw e;
    throw { code: 'INTERNAL', message: String(e) } satisfies ApiError;
  }
}

// ---- Workspace ----
export const workspaceApi = {
  listKnown: () => call<KnownWorkspace[]>('list_known_workspaces'),
  create: (name: string, icon: string | null, parentDir?: string) =>
    call<WorkspaceInfo>('create_workspace', { name, icon, parentDir: parentDir ?? null }),
  open: (path: string) => call<WorkspaceInfo>('open_workspace', { path }),
  openLast: () => call<WorkspaceInfo | null>('open_last_workspace'),
  current: () => call<WorkspaceInfo | null>('current_workspace'),
  close: () => call<void>('close_workspace'),
  forget: (path: string) => call<void>('forget_workspace', { path }),
  rename: (name: string) => call<void>('rename_workspace', { name }),
  setIcon: (icon: string | null) => call<void>('set_workspace_icon', { icon }),
  getSetting: (key: string) => call<string | null>('get_app_setting', { key }),
  setSetting: (key: string, value: string) => call<void>('set_app_setting', { key, value }),
};

// ---- Páginas ----
export const pagesApi = {
  create: (parentPageId: string | null, title = '', icon: string | null = null) =>
    call<PageDetail>('create_page', { parentPageId, title, icon }),
  get: (id: string) => call<PageDetail>('get_page', { id }),
  list: () => call<PageSummary[]>('list_pages'),
  listArchived: () => call<PageSummary[]>('list_archived_pages'),
  // Devuelven la versión nueva de la página: cualquier escritura sobre la
  // entidad incrementa `version`, y el autosave debe adoptarla como base.
  rename: (id: string, title: string) =>
    call<{ version: number; updatedAt: string }>('rename_page', { id, title }),
  setIcon: (id: string, icon: string | null) =>
    call<{ version: number; updatedAt: string }>('set_page_icon', { id, icon }),
  saveContent: (id: string, contentJson: string, baseVersion: number) =>
    call<{ version: number; updatedAt: string }>('save_page_content', {
      id,
      contentJson,
      baseVersion,
    }),
  move: (id: string, newParentId: string | null, afterId: string | null) =>
    call<void>('move_page', { id, newParentId, afterId }),
  duplicate: (id: string) => call<string>('duplicate_page', { id }),
  archive: (id: string) => call<void>('archive_page', { id }),
  restore: (id: string) => call<void>('restore_page', { id }),
  deletePermanently: (id: string) => call<number>('delete_page_permanently', { id }),
  backlinks: (id: string) =>
    call<{ sourcePageId: string; title: string; icon: string | null; blockId: string }[]>(
      'get_backlinks',
      { id },
    ),
  breadcrumbs: (id: string) =>
    call<{ id: string; title: string; icon: string | null }[]>('get_breadcrumbs', { id }),
  addFavorite: (id: string) => call<void>('add_favorite', { id }),
  removeFavorite: (id: string) => call<void>('remove_favorite', { id }),
  listFavorites: () => call<PageSummary[]>('list_favorites'),
  isFavorite: (id: string) => call<boolean>('is_favorite', { id }),
  touchRecent: (id: string) => call<void>('touch_recent', { id }),
  listRecents: (limit = 10) => call<PageSummary[]>('list_recents', { limit }),
  linkable: (query: string, limit = 20) => call<PageSummary[]>('linkable_pages', { query, limit }),
};

// ---- Búsqueda ----
export const searchApi = {
  search: (query: string, includeArchived = false, titlesOnly = false, limit = 30) =>
    call<SearchResultItem[]>('search_pages', { query, includeArchived, titlesOnly, limit }),
};

// ---- Bases de datos ----
export interface DbProperty {
  id: string;
  databaseId: string;
  name: string;
  type: string;
  configJson: string;
  position: string;
  hidden: boolean;
}

export interface DbDetail {
  id: string;
  pageId: string;
  title: string;
  properties: DbProperty[];
}

export interface DbRecordRow {
  pageId: string;
  title: string;
  icon: string | null;
  values: Record<string, string>;
  position: string;
}

export interface ConversionReport {
  convertible: number;
  lossy: number;
  applied: boolean;
}

export const dbApi = {
  create: (parentPageId: string | null, title: string) =>
    call<DbDetail>('create_database', { parentPageId, title }),
  byPage: (pageId: string) => call<DbDetail>('get_database_by_page', { pageId }),
  addProperty: (databaseId: string, name: string, propType: string) =>
    call<DbProperty>('add_property', { databaseId, name, propType }),
  renameProperty: (propertyId: string, name: string) =>
    call<void>('rename_property', { propertyId, name }),
  setPropertyHidden: (propertyId: string, hidden: boolean) =>
    call<void>('set_property_hidden', { propertyId, hidden }),
  setPropertyConfig: (propertyId: string, configJson: string) =>
    call<void>('set_property_config', { propertyId, configJson }),
  deleteProperty: (propertyId: string) => call<void>('delete_property', { propertyId }),
  changePropertyType: (propertyId: string, newType: string, dryRun: boolean) =>
    call<ConversionReport>('change_property_type', { propertyId, newType, dryRun }),
  createRecord: (databaseId: string) => call<string>('create_record', { databaseId }),
  listRecords: (
    databaseId: string,
    sort: { propertyId: string | null; direction: 'asc' | 'desc' } | null,
    filters: { propertyId: string; operator: string; valueJson: string | null }[],
  ) => call<DbRecordRow[]>('list_records', { databaseId, sort, filters }),
  setRecordValue: (recordPageId: string, propertyId: string, valueJson: string | null) =>
    call<void>('set_record_value', { recordPageId, propertyId, valueJson }),
};

// ---- Adjuntos ----
export const attachmentsApi = {
  importFromPath: (path: string) => call<AttachmentInfo>('import_attachment_from_path', { path }),
  importBase64: (name: string, dataBase64: string) =>
    call<AttachmentInfo>('import_attachment_base64', { name, dataBase64 }),
  /** URL renderizable en el webview, o null si el archivo falta. */
  resolveUrl: async (id: string): Promise<string | null> => {
    try {
      const path = await call<string>('resolve_attachment', { id });
      return convertFileSrc(path);
    } catch {
      return null;
    }
  },
  verify: (id: string) => call<boolean>('verify_attachment', { id }),
};

// ---- Export / respaldos ----
export const exportApi = {
  pageMarkdown: (pageId: string, destDir: string, includeSubpages: boolean) =>
    call<string[]>('export_page_markdown', { pageId, destDir, includeSubpages }),
  workspaceJson: (destFile: string) => call<void>('export_workspace_json', { destFile }),
  createBackup: (destDir: string | null) => call<string>('create_backup', { destDir }),
  validateBackup: (zipPath: string) => call<BackupSummary>('validate_backup', { zipPath }),
  restoreBackup: (zipPath: string, destParent: string | null) =>
    call<string>('restore_backup', { zipPath, destParent }),
};
