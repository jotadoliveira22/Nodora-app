# packages/ — Paquetes del monorepo

| Paquete | Estado | Contenido |
|---|---|---|
| `shared` | Activo | Tipos DTO de la frontera IPC, contratos cloud-ready (`LocalRepository`/`RemoteRepository`/`SyncEngine`/`FileStorage`/`AuthenticationProvider`/`PermissionService`), utilidades (orden fraccionario) |
| `editor` | Activo | Capa de abstracción sobre Tiptap/ProseMirror (ADR-004): nadie más importa `@tiptap/*` |
| `domain` | Diferido | La lógica de dominio del MVP vive en Rust (`apps/desktop/src-tauri/src`), donde es transaccional y testeable con `cargo test`. Se extraerá aquí lo que la web futura necesite compartir |
| `database` | Diferido | El acceso a datos es parte del backend Rust en el MVP (ADR-003) |
| `sync` | Diferido | Diseño en `docs/SYNC_ARCHITECTURE.md`; se implementará en el Horizonte 2 |
| `search` | Diferido | FTS5 vive junto al repositorio SQLite (misma transacción de guardado) |
| `ui` | Diferido | Los tokens y componentes viven en `apps/desktop/src/styles` + `components/ui.tsx` hasta que exista un segundo consumidor (la web) |
| `config` | Diferido | La configuración compartida (tsconfig/eslint) vive en la raíz del monorepo |

Regla aplicada (spec §11): «No agregues complejidad sin necesidad» — los
paquetes diferidos se crearán cuando tengan un segundo consumidor real.
