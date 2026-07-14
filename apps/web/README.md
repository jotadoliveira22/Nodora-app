# apps/web — Aplicación web (futura)

**Estado: no implementada (placeholder deliberado, spec §11).**

La versión web de Nodora pertenece al Horizonte 4 del roadmap
(`docs/FUTURE_ROADMAP.md`). El frontend del escritorio (`apps/desktop/src`)
se escribió para que su capa de UI sea reutilizable: los componentes solo
hablan con `services/api.ts`, que hoy delega en IPC de Tauri y mañana podrá
delegar en una API HTTP (`RemoteRepository`, ver
`packages/shared/src/contracts.ts` y `docs/CLOUD_ARCHITECTURE.md`).
