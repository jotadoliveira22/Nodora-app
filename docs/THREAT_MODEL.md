# THREAT_MODEL.md — Modelo de amenazas

> Alcance: MVP de escritorio monousuario y sin red. Se anotan las amenazas
> futuras (sync/nube) que condicionan el diseño actual.

## Activos

A1 Contenido del usuario (nodora.db). A2 Adjuntos. A3 Respaldos/exports.
A4 Integridad de la app instalada. A5 (futuro) credenciales/tokens.

## Amenazas, evaluación y mitigación

| # | Amenaza | Riesgo (MVP) | Mitigación MVP | Estado |
|---|---|---|---|---|
| T1 | Acceso no autorizado al dispositivo | Medio | Fuera del perímetro de la app: se delega en la sesión del SO (BitLocker/cifrado de disco recomendado en docs de usuario). Evaluación de cifrado propio: abajo | Documentado |
| T2 | Robo del archivo SQLite | Medio | Igual que T1: sin cifrado propio en MVP (decisión abajo). El archivo no contiene secretos de terceros | Documentado |
| T3 | Exposición de adjuntos | Medio | Adjuntos dentro de la carpeta del workspace; sin nombres significativos (UUID); mismos supuestos que T1 | Mitigado parcial |
| T4 | Inyección SQL | Alto si existiera | 100 % consultas parametrizadas (rusqlite); el frontend jamás envía SQL; test de intento de inyección | Mitigado |
| T5 | XSS en el editor | Alto si existiera | El editor renderiza su propio modelo (nunca `innerHTML` de datos); pegado HTML pasa por sanitización a nodos del schema; enlaces solo http(s)/attachment; CSP estricta sin `unsafe-inline` de scripts y sin orígenes remotos | Mitigado |
| T6 | Archivos maliciosos adjuntos | Medio | MIME por magic bytes, extensión saneada de lista blanca para imágenes MVP; nunca se ejecutan; se sirven vía protocolo asset local restringido a la carpeta de adjuntos | Mitigado |
| T7 | Path traversal (nombres de archivo, rutas de export/restore) | Alto si existiera | Los nombres físicos son UUIDs generados; toda ruta de usuario se canonicaliza y valida contra el directorio permitido en Rust; tests con `../` y rutas UNC | Mitigado |
| T8 | Secretos en el repositorio | Medio | El MVP no tiene secretos; CI sin credenciales embebidas; .gitignore de artefactos; revisión en PR | Mitigado |
| T9 | Corrupción de respaldos | Alto | Manifiesto con SHA-256 por archivo + verificación de integridad SQLite antes de restaurar; restauración nunca destruye el workspace actual (ver USER_FLOWS F10) | Mitigado |
| T10 | Manipulación externa de archivos del workspace | Medio | `PRAGMA integrity_check` al abrir; checksums de migraciones; hash de adjuntos verificable; fallo → mensaje claro + no abrir a medias | Mitigado parcial |
| T11 | Dependencias vulnerables | Medio | Lockfiles versionados; `pnpm audit` + `cargo audit` en CI (informativo, bloqueante en release); actualizaciones deliberadas | Mitigado |
| T12 | Escalada de permisos (futuro) | — | Permisos autoritativos solo en servidor; `PermissionService` desde MVP para que la autorización no se "pegue" a la UI | Diseñado |
| T13 | Secuestro de sesión (futuro) | — | JWT corto + refresh rotativo + revocación por dispositivo (CLOUD_ARCHITECTURE.md) | Diseñado |
| T14 | Sync de datos manipulados (futuro) | — | Validación servidor de toda operación; idempotencia; verificación de esquema de payloads | Diseñado |

## Decisión sobre cifrado local en reposo (spec §10)

**Decisión MVP: NO cifrar la base localmente. Registrada como ADR-008.**

- **Qué cubriría:** T1/T2/T3 frente a un atacante con acceso al disco pero
  sin la clave.
- **Qué NO cubre:** atacante con la app abierta o con el keylogger en la
  máquina; borrado; ransomware.
- **Dónde estarían las claves:** derivada de passphrase (Argon2id) o en el
  llavero del SO (DPAPI en Windows) — ambas opciones documentadas.
- **Coste real:** SQLCipher/SEE complican FTS5, rendimiento, respaldos,
  recuperación ante corrupción y debugging; una passphrase olvidada = pérdida
  total, lo que contradice el principio "nunca pierdas trabajo" para el
  usuario objetivo del MVP.
- **Mitigación recomendada al usuario:** cifrado de disco del SO (BitLocker),
  que cubre las mismas amenazas sin los costes anteriores.
- **Reversibilidad:** el diseño no lo impide; puede añadirse por-workspace en
  V2 (migración: crear DB cifrada y copiar). Se reevaluará antes de
  sincronizar datos fuera del dispositivo.

## Registro de errores

Los logs nunca incluyen contenido de documentos ni títulos; solo códigos de
error, ids y metadatos técnicos. Verificado por revisión y test del
formateador de logs.
