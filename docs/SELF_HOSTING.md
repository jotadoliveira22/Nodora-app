# SELF_HOSTING.md — Instalación self-hosted (diseño futuro)

> Aplica a Horizontes 2–4. El MVP no requiere servidor.

## Requisitos mínimos previstos

- Docker + Docker Compose v2.
- 2 vCPU / 4 GB RAM / 20 GB disco para un equipo pequeño.
- Un dominio o IP privada; TLS (Caddy lo automatiza con Let's Encrypt o
  certificados internos).

## Composición prevista (`docker/compose.yml`)

```yaml
# BORRADOR de diseño — no funcional todavía (no existe imagen del server)
services:
  proxy:      # Caddy: TLS + enrutado
  api:        # Sync API + auth
  collab:     # Hocuspocus (WS Yjs)
  db:         # postgres:16 (volumen persistente)
  files:      # minio (volumen persistente)
  backup:     # cron pg_dump + subida a bucket con retención
```

## Principios operativos

1. **Un solo archivo `.env`** documentado; sin secretos en imágenes.
2. **Actualizaciones:** imágenes versionadas semánticamente; migraciones de
   BD automáticas con backup previo (misma filosofía que el cliente).
3. **Backups:** diarios por defecto + verificación de restauración mensual
   documentada (runbook).
4. **Sin llamadas salientes**: el stack no contacta servicios externos.
5. **Aislamiento:** todo funciona en red privada sin acceso a internet
   (coherente con el principio local-first).

## Runbooks a escribir en H2

- Instalación desde cero; actualización; restauración de backup; rotación de
  secretos; migración de servidor; diagnóstico de sync.
