# DEPLOYMENT_OPTIONS.md — Opciones de despliegue

## Hoy (MVP)

| Opción | Estado | Notas |
|---|---|---|
| Escritorio Windows (instalador NSIS) | Objetivo del MVP | Sin red, sin servidor, sin cuenta |
| Escritorio Linux (deb/AppImage) | Subproducto de CI | Usado como smoke test |
| Escritorio macOS | Posible con CI runner macOS | No es objetivo del MVP |

## Futuro (con servidor de sync/colaboración)

| Opción | Escenario | Componentes |
|---|---|---|
| 1. Docker Compose self-hosted | Red privada, servidor doméstico, VPS | Ver SELF_HOSTING.md — **opción preferida y primera** |
| 2. VPS gestionado a mano | Usuario avanzado individual | Compose + Caddy en un VPS pequeño |
| 3. Nube pública managed | Empresa sin ops | Contenedores gestionados + PostgreSQL gestionado (RDS/Cloud SQL) + S3 real + CDN opcional |
| 4. Empresarial privado | Compliance estricto | Compose/K8s en red aislada + SSO OIDC + backups internos |

## Matriz de decisión

- ¿Solo tú y una máquina? → MVP escritorio, sin servidor.
- ¿Tú con 2+ dispositivos? → Opción 1 mínima (API+DB+MinIO) en H2.
- ¿Equipo? → Opción 1 completa (con colaboración) o 3 si no hay ops.
- La app de escritorio siempre sigue funcionando offline contra su SQLite
  local, sea cual sea la opción.
