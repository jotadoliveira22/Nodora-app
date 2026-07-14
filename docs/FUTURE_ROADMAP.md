# FUTURE_ROADMAP.md — Hoja de ruta posterior al MVP

> Orientativa; cada fase requiere su propio ciclo de investigación/decisión.

## Horizonte 1 — V2 de escritorio (monousuario)

- Historial de versiones por página (snapshots + diff).
- Bloques avanzados: tablas, toggles, columnas, embeds, LaTeX.
- Vistas de base de datos: kanban, calendario, galería; agrupación;
  relaciones entre bases; fórmulas simples.
- Importadores: Markdown/carpetas, export de Notion (vía su formato público
  de exportación), Evernote ENEX.
- Respaldos programados y retención.
- Plantillas de página.
- Multiventana.

## Horizonte 2 — Sincronización entre dispositivos (un usuario)

- Activar log de operaciones (`sync_operations`) en escritura.
- Servidor de sincronización mínimo (self-hosted Docker): API + PostgreSQL +
  S3-compatible para adjuntos.
- Cifrado del transporte y autenticación por dispositivo.
- Documento del editor migrado a Yjs (el modelo ya es compatible);
  reconciliación offline prolongada; tombstones.
- App de escritorio = cliente sync; el disco local sigue siendo la verdad.

## Horizonte 3 — Colaboración y equipos

- Usuarios, organizaciones, memberships, roles y permisos (modelo ya
  reservado en el schema).
- Colaboración en tiempo real (Yjs + Hocuspocus), presencia y cursores.
- Comentarios y menciones.
- Auditoría (activity log ya existe en el modelo).

## Horizonte 4 — Web y nube privada

- `apps/web` (Next.js u otro; el frontend React se reutiliza en gran parte).
- Despliegue self-hosted completo con Docker Compose; luego opción managed.
- Búsqueda del lado servidor, backups gestionados, monitoreo.

## Horizonte 5 — Integraciones e IA (opt-in)

- API pública propia y webhooks.
- Automatizaciones simples (triggers sobre bases de datos).
- IA local u opt-in remota: resumen, redacción, búsqueda semántica.

## Invariantes en todos los horizontes

- El modo 100 % local y offline sigue funcionando siempre.
- Exportación completa siempre disponible.
- Nada de lo anterior exige migración destructiva del modelo del MVP
  (garantizado por UUIDs, tombstones, versiones y `sync_operations`).
