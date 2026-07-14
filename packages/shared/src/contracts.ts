/**
 * Contratos arquitectónicos preparados para la nube (spec §6).
 *
 * Durante el MVP solo existen implementaciones locales reales:
 *  - LocalRepository  -> comandos Tauri sobre SQLite (backend Rust).
 *  - FileStorage      -> carpeta attachments/ del workspace (backend Rust).
 *  - AuthenticationProvider -> LocalSingleUserAuth (usuario propietario).
 *  - PermissionService      -> AllowAllPermissions (monousuario explícito).
 *  - RemoteRepository y SyncEngine NO tienen implementación en el MVP: son
 *    el contrato que la sincronización futura debe cumplir
 *    (docs/SYNC_ARCHITECTURE.md).
 */

export interface AuthenticatedUser {
  id: string;
  name: string;
}

export interface AuthenticationProvider {
  currentUser(): Promise<AuthenticatedUser>;
}

export type Capability =
  'page.read' | 'page.write' | 'page.delete' | 'database.write' | 'workspace.admin';

export interface PermissionService {
  can(userId: string, capability: Capability, entityId: string): Promise<boolean>;
}

/** Estado que expondrá el motor de sincronización futuro. */
export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncEngine {
  status(): SyncStatus;
  /** Drena operaciones locales pendientes y aplica las remotas. */
  synchronize(): Promise<void>;
}

/**
 * Acceso a archivos binarios. La implementación local resuelve
 * attachment://<id> dentro de la carpeta del workspace; la futura remota,
 * contra un bucket S3-compatible direccionado por hash.
 */
export interface FileStorage {
  store(bytes: Uint8Array, originalName: string): Promise<{ id: string; sha256: string }>;
  resolveUrl(id: string): Promise<string>;
  verify(id: string): Promise<boolean>;
}

/**
 * Repositorio de dominio. La implementación local del MVP es la fachada de
 * comandos IPC (services/ en apps/desktop). RemoteRepository es el mismo
 * contrato contra una API HTTP futura.
 */
export interface RepositoryMarker {
  readonly kind: 'local' | 'remote';
}
