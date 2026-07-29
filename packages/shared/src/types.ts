/**
 * Tipos de dominio compartidos entre frontend y backend (DTOs de IPC).
 * El lado Rust replica estas formas con serde; los tests de contrato en
 * apps/desktop/src-tauri verifican la serialización JSON campo a campo.
 * Convención: camelCase en la frontera IPC.
 */

export type PageKind = 'page' | 'database' | 'record';

export interface WorkspaceInfo {
  id: string;
  name: string;
  icon: string | null;
  path: string;
}

export interface KnownWorkspace {
  id: string;
  name: string;
  path: string;
  lastOpenedAt: string | null;
}

/** Qué contiene un espacio y cuánto ocupa; se muestra antes de eliminarlo. */
export interface WorkspaceStats {
  pageCount: number;
  attachmentCount: number;
  bytesOnDisk: number;
}

export interface PageSummary {
  id: string;
  parentPageId: string | null;
  title: string;
  icon: string | null;
  position: string;
  kind: PageKind;
  databaseId: string | null;
  archivedAt: string | null;
  hasChildren: boolean;
  updatedAt: string;
}

export interface PageDetail {
  id: string;
  parentPageId: string | null;
  title: string;
  icon: string | null;
  kind: PageKind;
  databaseId: string | null;
  archivedAt: string | null;
  /** Documento del editor serializado (árbol ProseMirror JSON). */
  contentJson: string;
  /** Portada: null, 'color' (preset) o 'attachment' (imagen del espacio). */
  coverKind: string | null;
  coverValue: string | null;
  version: number;
  updatedAt: string;
}

export interface SavePageContentInput {
  pageId: string;
  /** Documento del editor serializado. */
  contentJson: string;
  /** Proyección de texto plano para FTS (la calcula @nodora/editor). */
  contentText: string;
  /** Enlaces internos salientes (targetPageId + blockId de origen). */
  links: { targetPageId: string; blockId: string }[];
  /** Versión sobre la que se editó (optimistic lock). */
  baseVersion: number;
}

export interface SaveResult {
  version: number;
  updatedAt: string;
}

export interface SearchResultItem {
  pageId: string;
  title: string;
  icon: string | null;
  /** Fragmento con coincidencias marcadas con  ... . */
  snippet: string;
  archived: boolean;
  kind: PageKind;
}

export interface BacklinkItem {
  sourcePageId: string;
  title: string;
  icon: string | null;
  blockId: string;
}

export type PropertyType =
  'title' | 'text' | 'number' | 'select' | 'multi_select' | 'status' | 'date' | 'checkbox' | 'url';

export interface SelectOption {
  id: string;
  name: string;
  color: string;
}

export interface DatabaseProperty {
  id: string;
  databaseId: string;
  name: string;
  type: PropertyType;
  /** JSON de configuración (opciones de select/status, formato). */
  configJson: string;
  position: string;
  hidden: boolean;
}

export interface DatabaseDetail {
  id: string;
  pageId: string;
  title: string;
  properties: DatabaseProperty[];
}

export interface RecordRow {
  pageId: string;
  title: string;
  icon: string | null;
  /** propertyId -> value JSON string */
  values: Record<string, string>;
  position: string;
}

export type SortDirection = 'asc' | 'desc';

export interface RecordSort {
  propertyId: string | null;
  direction: SortDirection;
}

export interface RecordFilter {
  propertyId: string;
  /** Operador simple por tipo: eq, contains, is_empty, not_empty, gt, lt, is_checked, not_checked */
  operator: string;
  /** Valor JSON del operando cuando aplica. */
  valueJson: string | null;
}

export interface AttachmentInfo {
  id: string;
  originalName: string;
  mime: string;
  sizeBytes: number;
  sha256: string;
}

export interface BackupSummary {
  formatVersion: number;
  schemaVersion: number;
  workspaceName: string;
  createdAt: string;
  pageCount: number;
  attachmentCount: number;
}

export interface ApiError {
  code: string;
  message: string;
}

/** Códigos de error estables de la frontera IPC. */
export const ERROR_CODES = [
  'WORKSPACE_NOT_FOUND',
  'WORKSPACE_ALREADY_OPEN',
  'PAGE_NOT_FOUND',
  'VERSION_CONFLICT',
  'INVALID_INPUT',
  'INVALID_DOCUMENT',
  'CYCLE_DETECTED',
  'DATABASE_NOT_FOUND',
  'PROPERTY_NOT_FOUND',
  'UNSAFE_TYPE_CONVERSION',
  'ATTACHMENT_NOT_FOUND',
  'ATTACHMENT_TOO_LARGE',
  'ATTACHMENT_TYPE_FORBIDDEN',
  'BACKUP_INVALID',
  'PATH_NOT_ALLOWED',
  'MIGRATION_FAILED',
  'SCHEMA_TOO_NEW',
  'STORAGE_ERROR',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
