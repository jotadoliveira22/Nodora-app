# ARCHITECTURE.md — Arquitectura técnica del MVP

## Vista general

```text
┌─────────────────────────────────────────────────────────────┐
│  apps/desktop (Tauri 2)                                     │
│                                                              │
│  ┌────────────────────────────┐   ┌──────────────────────┐  │
│  │  Frontend (WebView)        │   │  Backend (Rust)      │  │
│  │  React + TS + Vite         │   │                      │  │
│  │                            │   │  commands/ (IPC)     │  │
│  │  ui (componentes)          │   │    ↓ valida entrada  │  │
│  │    ↓                       │   │  domain/ (lógica)    │  │
│  │  features/ (páginas,       │◄──┤    ↓                 │  │
│  │   editor, búsqueda, db)    │IPC│  repository/ (SQL)   │  │
│  │    ↓                       │──►│    ↓                 │  │
│  │  services/ (invoke tipado) │   │  SQLite (rusqlite,   │  │
│  │  stores/ (Zustand)         │   │   WAL, FTS5, FK)     │  │
│  │  @nodora/editor (Tiptap    │   │  files/ (adjuntos,   │  │
│  │   encapsulado)             │   │   export, backup)    │  │
│  └────────────────────────────┘   └──────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
        packages/shared: tipos TS + contratos IPC + utilidades
```

## Reglas de dependencia (obligatorias)

1. Los componentes React **no** contienen lógica de negocio ni SQL: llaman a
   `services/` (wrappers tipados de `invoke`) y leen `stores/`.
2. Nada fuera de `@nodora/editor` importa Tiptap/ProseMirror.
3. Nada fuera de `repository/` (Rust) construye SQL. Todas las consultas son
   parametrizadas.
4. El frontend nunca toca el sistema de archivos directamente; todo pasa por
   comandos Tauri con validación.
5. `packages/shared` define los DTOs de IPC una sola vez (TS); el lado Rust
   los replica con `serde` y los tests de contrato verifican el JSON.

## Dónde vive cada responsabilidad

| Responsabilidad | Lugar |
|---|---|
| Estado visual (sidebar abierto, tema, diálogo activo) | Zustand `uiStore` |
| Estado de navegación (página actual, historial) | Zustand `navStore` |
| Estado del documento en edición | Instancia del editor (ProseMirror) |
| Estado persistido | SQLite (fuente de verdad) |
| Operaciones de dominio | Rust `domain/` + comandos |
| Estado futuro de sync | Tabla `sync_operations` + `SyncEngine` (interfaz) |

## Flujo de guardado (crítico)

1. El editor emite `update` → debounce 800 ms (o flush inmediato en blur,
   cambio de página, cierre).
2. `services/pages.savePageContent(pageId, docJson, baseVersion)` → IPC.
3. Rust valida el JSON contra el schema de bloques permitidos, y en **una
   transacción**: actualiza `pages.content`, incrementa `pages.version`
   (optimistic lock: rechaza si `baseVersion` no coincide), reescribe la
   proyección de texto (tabla FTS) y reconcilia `page_links`.
4. Respuesta → el store marca "Guardado". Error → estado de error visible y
   reintento; la edición local nunca se bloquea.

## Contratos preparados para la nube (solo interfaces en MVP)

En `packages/shared/src/contracts/` (TS) y espejo conceptual en Rust:

- `LocalRepository` — implementado (SQLite).
- `RemoteRepository` — interfaz + doc; sin implementación.
- `SyncEngine` — interfaz + doc (`docs/SYNC_ARCHITECTURE.md`).
- `FileStorage` — implementado local; interfaz admite S3 futuro.
- `AuthenticationProvider` — interfaz; MVP usa `LocalSingleUserAuth`
  (usuario propietario implícito).
- `PermissionService` — interfaz; MVP usa `AllowAllPermissions` explícito.

## Manejo de errores y logging

- Rust: `thiserror` por capa; los comandos devuelven `Result<T, ApiError>`
  serializable con código estable (`WORKSPACE_NOT_FOUND`, `VERSION_CONFLICT`,
  `BACKUP_INVALID`…), mensaje seguro y sin contenido de usuario.
- Frontend: boundary de error global + toast/estado por operación.
- Logging estructurado a archivo rotado en el directorio de datos de la app
  (nivel info; sin contenido de documentos). `tracing` en Rust.

## Empaquetado

- Desarrollo y CI Linux: `pnpm tauri dev` / `pnpm tauri build` (deb/AppImage
  como smoke test) + suites de test.
- Perfil de release: LTO «thin» con `opt-level = "s"` y `strip`. El LTO
  completo producía un binario un 22 % menor (6,5 MB frente a 8,3 MB) pero
  su enlazado superaba los 45 minutos en los runners de Windows, así que se
  eligió el compromiso rápido.
- Release Windows: GitHub Actions `windows-latest` → instalador **NSIS**
  (`.exe`). Firma de código fuera de alcance del MVP (documentado como deuda:
  SmartScreen advertirá; se acepta para uso privado).
