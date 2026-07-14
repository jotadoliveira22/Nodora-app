# SECURITY_ARCHITECTURE.md — Arquitectura de seguridad (MVP)

## Perímetros

1. **WebView (no confiable relativa):** la UI no recibe capacidades del
   sistema; solo puede llamar comandos IPC tipados. CSP estricta:
   `default-src 'self'; img-src 'self' asset: data:; style-src 'self'
   'unsafe-inline'; script-src 'self'` (sin orígenes remotos — coherente con
   "sin internet"). `unsafe-inline` de estilos lo exige el editor; se acota y
   documenta.
2. **Backend Rust (confiable):** única capa con acceso a disco y SQL.
   Valida TODA entrada de IPC (tipos, tamaños, rangos, canonicalización de
   rutas) aunque "venga de nuestra UI".
3. **Sistema de archivos:** acceso restringido por diseño a: carpeta del
   workspace, directorio de datos de la app y rutas elegidas explícitamente
   por el usuario mediante diálogos nativos (export/backup). El scope de
   assets de Tauri solo expone `attachments/` en lectura.

## Controles concretos

| Control | Implementación |
|---|---|
| SQL parametrizado | rusqlite con parámetros nombrados; ningún `format!` de SQL con datos |
| Validación de documentos | El JSON del editor se valida contra el schema de bloques permitido antes de persistir (tipos de nodo, attrs, profundidad, tamaño máximo) |
| Sanitización de pegado | HTML pegado → parser del editor → solo nodos/atributos del schema; URLs filtradas por protocolo (`http`, `https`, `mailto`, `attachment`) |
| Rutas | `dunce::canonicalize` + verificación de prefijo dentro del directorio permitido; rechazo de symlinks fuera de scope |
| Adjuntos | Nombre físico = UUID + extensión de lista blanca; MIME por magic bytes; tamaño máximo configurable (por defecto 50 MB) |
| Respaldos | ZIP con manifiesto JSON: versión de formato, versión de schema, SHA-256 de cada entrada; verificación completa antes de restaurar; `PRAGMA integrity_check` del DB restaurado en staging temporal |
| Secretos locales | El MVP no maneja secretos. El `device_id` no es secreto. Futuro: llavero del SO vía plugin oficial |
| Errores/logs | Códigos estables sin contenido de usuario; archivo de log en datos de app con rotación |
| Dependencias | lockfiles + `cargo audit`/`pnpm audit` en CI |
| Actualizaciones | MVP sin auto-update (instalador manual); si se añade, será con firmas del updater de Tauri |
| Permisos Tauri | `capabilities` mínimas: sin shell, sin HTTP, sin FS genérico para el frontend; solo los comandos propios y diálogos nativos |

## Ciclo de vida seguro

- Revisión de seguridad al cierre de cada slice (checklist en PR).
- `docs/THREAT_MODEL.md` se revisa al añadir cualquier capacidad nueva
  (especialmente red, en H2).
- Política de divulgación en `SECURITY.md`.
