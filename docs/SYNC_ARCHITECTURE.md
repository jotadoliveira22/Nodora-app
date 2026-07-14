# SYNC_ARCHITECTURE.md — Arquitectura de sincronización (diseño futuro)

> No se implementa en el MVP. Define el contrato que el MVP debe respetar
> (y respeta: UUIDs, versiones, tombstones, `sync_operations`, documento
> ProseMirror compatible con Yjs).

## Componentes

```text
Dispositivo A ──┐
Dispositivo B ──┼──► Sync API (HTTPS) ──► PostgreSQL (metadatos, ops, schema)
Dispositivo C ──┘        │
                         ├──► Colaboración WS (Hocuspocus) ──► docs Yjs
                         └──► FileStorage S3-compatible (adjuntos por hash)
```

- **SyncEngine (cliente):** interfaz definida en el MVP. Responsable de:
  drenar `sync_operations` pendientes, aplicar operaciones remotas, exponer
  estado (`idle/syncing/error/offline`).
- **Sync API:** recibe lotes de operaciones idempotentes, asigna `server_at`
  y orden total por workspace (secuencia monótona `server_seq`), devuelve
  acks + operaciones nuevas desde el último checkpoint del dispositivo.
- **Servidor de colaboración:** Yjs/Hocuspocus por documento de página;
  persistencia de updates en PostgreSQL/S3; autenticación por token de
  dispositivo vía hooks.

## Flujos

### Sincronización inicial (dispositivo nuevo)
1. Autenticación → token de dispositivo; registro en `devices`.
2. Descarga snapshot del workspace (dump lógico + updates Yjs compactados +
   manifiesto de adjuntos por hash).
3. Descarga adjuntos bajo demanda o en bloque (configurable).
4. Marca checkpoint `server_seq`; a partir de ahí, incremental.

### Sincronización incremental
1. Cliente envía lote de ops `pending` (orden `local_at`).
2. Servidor aplica idempotentemente (`operation_id` único), valida permisos
   por operación, asigna `server_seq`, responde acks + ops ajenas nuevas.
3. Cliente aplica ops remotas en transacción local, recalcula proyecciones
   (FTS, links), marca `acked`.
4. Contenido de páginas: canal Yjs separado (updates binarios), convergencia
   automática CRDT.

### Reintentos
Backoff exponencial con jitter; los lotes son re-enviables sin daño
(idempotencia). El estado `sent` sin ack vuelve a `pending` tras timeout.

### Conflictos (metadatos/estructura)
- Regla general: **última operación según `server_seq` gana por campo**
  (LWW por campo, no por fila), con excepciones:
  - `position`: se aplica tal cual (claves fraccionarias conmutan bien; el
    peor caso es orden inesperado, no corrupción).
  - `parent_page_id`: si crea ciclo, el servidor rechaza (`rejected` +
    razón); el cliente revierte a la versión del servidor y notifica.
  - multi_select / favoritos: unión de conjuntos.
  - eliminar vs editar: la eliminación (tombstone) gana; la edición queda
    registrada en activity_log para recuperación manual.
- Contenido del editor: sin reglas — Yjs converge.

### Tombstones y eliminaciones
`deleted_at` se replica como cualquier campo; la purga física es una
operación administrativa separada (`purge`) que el servidor solo ejecuta
cuando todos los dispositivos conocidos superaron el checkpoint, o tras un
TTL configurable (por defecto 90 días). Restaurar = limpiar `deleted_at`
antes de la purga.

### Dispositivos largamente desconectados
- Si su checkpoint sigue disponible: incremental normal (las ops se retienen
  ≥ TTL de purga).
- Si no (checkpoint purgado): re-bootstrap como dispositivo nuevo; las ops
  locales pendientes se re-aplican encima del snapshot (idempotentes; las
  rechazadas se reportan al usuario con su payload exportable).

### Cambio de permisos (futuro COLAB)
Los permisos son autoritativos del servidor. Al perder acceso a un subárbol,
el servidor emite ops `revoke` y el cliente elimina localmente ese contenido
(retención local opcional cifrada fuera de alcance). Las ops pendientes de un
usuario sin permiso se rechazan con razón.

### Archivos grandes
Subida por streaming multipart al FileStorage con hash previo; el documento
solo referencia `attachment://<uuid>`; los updates Yjs nunca contienen bytes
de archivos. Límite configurable; reanudación por partes.

### Recuperación ante corrupción
- Cliente: si `nodora.db` falla `PRAGMA integrity_check`, se restaura del
  último respaldo local y se re-sincroniza desde el checkpoint del servidor.
- Servidor: backups PostgreSQL/S3 (ver CLOUD_ARCHITECTURE.md); los updates
  Yjs se compactan periódicamente con verificación.

## Presencia y cursores (COLAB)
Awareness de Yjs vía el mismo WebSocket: usuario, página, selección. Nunca se
persiste.

## Qué exige esto del MVP (checklist cumplida por el diseño actual)

- [x] UUIDs estables en todas las entidades.
- [x] `version` por entidad y optimistic lock en escrituras.
- [x] Tombstones (`deleted_at`) en lugar de DELETE físico directo.
- [x] `device_id` registrado y persistido.
- [x] Tabla `sync_operations` con clave de idempotencia.
- [x] Documento del editor = árbol ProseMirror con `blockId` (cargable en Yjs).
- [x] Proyecciones (FTS, links) recalculables, nunca fuente de verdad.
- [x] Adjuntos direccionados por id + hash, sin rutas.
