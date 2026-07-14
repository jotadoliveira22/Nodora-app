# SYNC_DATA_MODEL.md — Modelo de datos de sincronización

> El MVP **no** sincroniza. Este documento define qué queda reservado en el
> schema desde la migración 001 y por qué, para que activar sync (Horizonte 2)
> sea aditivo y no destructivo.

## Columnas reservadas en entidades sincronizables

En `workspaces`, `pages`, `databases`, `database_properties`, `attachments`,
`favorites`, `users`, `devices`, `memberships`:

| Columna | Uso en MVP | Uso futuro |
|---|---|---|
| `id` UUID | PK | identidad global entre dispositivos |
| `created_at` / `updated_at` | auditoría | diagnóstico (NO resolución de conflictos) |
| `deleted_at` | tombstone local | replicar eliminaciones a otros dispositivos |
| `created_by` / `updated_by` | siempre el owner local | atribución multiusuario |
| `device_id` | dispositivo actual | origen del cambio |
| `version` | optimistic lock local (rechaza guardados obsoletos) | versión base de operaciones sync |

**Por qué no fechas para conflictos (spec §7):** los relojes de dispositivos
divergen y retroceden. La resolución usa `version` (contador por entidad) +
log de operaciones ordenado por el servidor; las fechas quedan como metadato
humano.

## Tabla `sync_operations`

Creada en la migración 001, vacía durante el MVP:

```sql
CREATE TABLE sync_operations (
  operation_id   TEXT PRIMARY KEY,          -- UUID generado por el cliente
  workspace_id   TEXT NOT NULL,
  entity_id      TEXT NOT NULL,
  entity_type    TEXT NOT NULL,             -- 'page' | 'database' | ...
  actor_id       TEXT NOT NULL,
  device_id      TEXT NOT NULL,
  op_type        TEXT NOT NULL,             -- 'create'|'update'|'move'|'archive'|'delete'|'restore'|...
  payload_json   TEXT NOT NULL,             -- delta o snapshot según op_type
  base_version   INTEGER NOT NULL,          -- versión de la entidad sobre la que se aplicó
  local_at       TEXT NOT NULL,             -- fecha local del dispositivo
  server_at      TEXT,                      -- asignada por el servidor (futuro)
  sync_status    TEXT NOT NULL DEFAULT 'pending'  -- 'pending'|'sent'|'acked'|'rejected'
);
CREATE INDEX idx_sync_ops_status ON sync_operations(sync_status, local_at);
CREATE INDEX idx_sync_ops_entity ON sync_operations(entity_id, base_version);
```

### Idempotencia

`operation_id` es la clave de idempotencia extremo a extremo: el servidor
futuro hace `INSERT ... ON CONFLICT (operation_id) DO NOTHING` y responde el
mismo ack; reenviar una operación jamás la aplica dos veces (spec §8).

## Qué se sincroniza cómo (diseño)

| Dato | Mecanismo futuro | Razón |
|---|---|---|
| `content_json` de páginas | Documento **Yjs** por página (el árbol ProseMirror actual se carga en Y.XmlFragment; `blockId` estables ya existen) | fusión concurrente real |
| Metadatos de páginas (título, icono, parent, position, archived) | Operaciones LWW-por-campo sobre `version` vía `sync_operations` | conflictos raros; CRDT innecesario |
| Schema de bases y valores de registros | Operaciones idempotentes + reglas por tipo (p. ej. multi_select = unión) | datos estructurados, validación servidor |
| Adjuntos | Subida por hash a `FileStorage` (S3-compatible); el contenido es inmutable por id | dedup natural |
| Favoritos/recientes | Favoritos: operaciones; recientes: **no se sincroniza** (local puro) | ruido sin valor |
| Permisos/membresías | Solo servidor autoritativo (nunca CRDT) | seguridad |

## Proyección texto/enlaces

`content_text`, `pages_fts` y `page_links` son **derivados**: nunca se
sincronizan; cada dispositivo los recalcula al aplicar operaciones. Esto
elimina toda una clase de conflictos.

## Migración del contenido a Yjs (Horizonte 2)

1. Cargar `content_json` (ProseMirror) en un `Y.Doc` con `y-prosemirror`
   (proceso determinista y sin pérdida — mismo modelo de documento).
2. Guardar el update binario Yjs en una columna nueva `content_crdt BLOB`
   (migración aditiva); `content_json` pasa a ser snapshot derivado para
   export/búsqueda.
3. Los dispositivos sin la migración no pueden abrir el workspace hasta
   actualizar (gate por `schema_migrations.version`).

Ver el protocolo completo en `docs/SYNC_ARCHITECTURE.md`.
