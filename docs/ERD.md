# ERD.md — Diagrama entidad-relación

```mermaid
erDiagram
    workspaces ||--o{ pages : contiene
    workspaces ||--o{ users : "propietario (MVP: 1)"
    workspaces ||--o{ devices : registra
    workspaces ||--o{ memberships : "futuro"
    users ||--o{ memberships : "futuro"
    pages ||--o{ pages : "subpáginas (parent_page_id)"
    pages ||--o{ page_links : "enlaces salientes"
    pages ||--o{ page_links : "backlinks (target)"
    pages ||--o| favorites : "fijada"
    pages ||--o| recents : "visitada"
    pages ||--o| databases : "kind='database'"
    databases ||--o{ database_properties : define
    databases ||--o{ pages : "registros (kind='record')"
    pages ||--o{ record_values : "valores si record"
    database_properties ||--o{ record_values : tipa
    workspaces ||--o{ attachments : gestiona
    workspaces ||--o{ activity_log : audita
    workspaces ||--o{ sync_operations : "futuro"

    workspaces {
        TEXT id PK
        TEXT name
        TEXT icon
        TEXT settings_json
        INT  version
        TEXT created_at
        TEXT updated_at
        TEXT deleted_at
    }
    pages {
        TEXT id PK
        TEXT workspace_id FK
        TEXT parent_page_id FK
        TEXT title
        TEXT icon
        TEXT position
        TEXT content_json
        TEXT content_text
        TEXT kind
        TEXT database_id FK
        TEXT archived_at
        INT  version
        TEXT device_id
        TEXT created_at
        TEXT updated_at
        TEXT deleted_at
    }
    page_links {
        TEXT source_page_id FK
        TEXT target_page_id FK
        TEXT block_id
    }
    databases {
        TEXT id PK
        TEXT workspace_id FK
        TEXT page_id FK
    }
    database_properties {
        TEXT id PK
        TEXT database_id FK
        TEXT name
        TEXT type
        TEXT config_json
        TEXT position
        INT  hidden
    }
    record_values {
        TEXT record_page_id FK
        TEXT property_id FK
        TEXT value_json
    }
    attachments {
        TEXT id PK
        TEXT workspace_id FK
        TEXT original_name
        TEXT mime
        INT  size_bytes
        TEXT sha256
        INT  ref_count
    }
    favorites {
        TEXT id PK
        TEXT page_id FK
        TEXT position
    }
    recents {
        TEXT page_id PK
        TEXT visited_at
    }
    users {
        TEXT id PK
        TEXT name
        TEXT kind
    }
    devices {
        TEXT id PK
        TEXT name
        TEXT platform
    }
    memberships {
        TEXT id PK
        TEXT workspace_id FK
        TEXT user_id FK
        TEXT role
    }
    activity_log {
        TEXT id PK
        TEXT entity_type
        TEXT entity_id
        TEXT action
        TEXT actor_id
        TEXT created_at
    }
    sync_operations {
        TEXT operation_id PK
        TEXT entity_id
        TEXT entity_type
        TEXT op_type
        TEXT payload_json
        INT  base_version
        TEXT sync_status
    }
```

Además existe `app.db` global (fuera del workspace) con `known_workspaces` y
`app_settings`, y la tabla virtual `pages_fts` (FTS5, contenido externo sobre
`pages`). Detalle de columnas en `docs/DATA_MODEL.md`.
