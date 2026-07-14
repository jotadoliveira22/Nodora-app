# apps/server — Servidor de sincronización/colaboración (futuro)

**Estado: no implementado (placeholder deliberado, spec §11).**

El diseño completo está en `docs/SYNC_ARCHITECTURE.md` y
`docs/CLOUD_ARCHITECTURE.md`. El MVP local ya deja preparado el contrato que
este servidor deberá cumplir: log de operaciones idempotentes
(`sync_operations`), UUIDs estables, tombstones y versiones por entidad.
