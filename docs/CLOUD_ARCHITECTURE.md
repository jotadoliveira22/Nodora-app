# CLOUD_ARCHITECTURE.md — Arquitectura futura en la nube (diseño)

> Horizontes 2–4 del roadmap. Nada de esto se implementa en el MVP; se diseña
> para verificar que las decisiones del MVP no lo bloquean.

## Topología objetivo (self-hosted primero)

```text
                        ┌──────────────────────────────────────┐
   apps/desktop ──────► │  Reverse proxy (Caddy/Traefik, TLS)  │
   apps/web (Next.js) ─►│                                      │
                        │  ┌──────────────┐  ┌──────────────┐  │
                        │  │ API (REST/   │  │ Colaboración │  │
                        │  │ JSON, auth,  │  │ WS Hocuspocus│  │
                        │  │ sync ops)    │  │ (docs Yjs)   │  │
                        │  └──────┬───────┘  └──────┬───────┘  │
                        │         │                 │          │
                        │  ┌──────▼─────────────────▼───────┐  │
                        │  │ PostgreSQL (metadatos, ops,    │  │
                        │  │ permisos, updates Yjs, audit)  │  │
                        │  └──────┬─────────────────────────┘  │
                        │  ┌──────▼───────┐  ┌──────────────┐  │
                        │  │ MinIO (S3):  │  │ Backups +    │  │
                        │  │ adjuntos     │  │ monitoreo    │  │
                        │  └──────────────┘  └──────────────┘  │
                        └──────────────────────────────────────┘
```

## Servicios

| Servicio | Tecnología candidata | Notas |
|---|---|---|
| API | Rust (axum) o Node (Fastify) — decidir en H2; el contrato es `sync_operations` + REST de recursos | Reutilizar validación de dominio de Rust favorece axum |
| Colaboración | Hocuspocus (Node, MIT) | Hooks de auth contra la API |
| BD | PostgreSQL 16+ | jsonb + tsvector; RLS para multitenancy |
| Archivos | MinIO / cualquier S3 | direccionado por hash (igual que local) |
| Auth | Email+password con Argon2id, sesiones JWT cortas + refresh; SSO (OIDC) empresarial después | `AuthenticationProvider` ya abstrae esto en el cliente |
| Web | Next.js reutilizando packages/ui, editor, shared | El frontend del MVP no usa APIs de Tauri fuera de `services/` |

## Modelo multiusuario

`organizations → workspaces → members(roles) → permisos por página
(herencia por árbol, overrides por subárbol)`. El modelo local ya reserva
`users`, `memberships` y `PermissionService`. Roles iniciales: owner, admin,
editor, viewer.

## Auditoría, backups, monitoreo

- Auditoría: `activity_log` replicado al servidor + eventos de auth.
- Backups: `pg_dump` programado + WAL archiving; versioning en bucket S3;
  restauración ensayada (runbook en SELF_HOSTING.md).
- Monitoreo: healthchecks HTTP, métricas Prometheus, logs estructurados.

## Entornos soportados (spec §9)

Computadora local (solo MVP), red privada / servidor doméstico / VPS
(Docker Compose), nube pública (Compose o managed: RDS + S3 + contenedores),
entorno empresarial (Compose + SSO + red aislada).

## Invariante

La nube es **opcional para siempre**: el escritorio funciona 100 % sin ella,
y desconectarse de la nube nunca destruye datos locales.
