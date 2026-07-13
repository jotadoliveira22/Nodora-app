# NODORA — Especificación obligatoria del producto

> Este documento es la fuente obligatoria de requisitos y criterios de
> aceptación del proyecto Nodora. Ante cualquier conflicto entre código,
> documentación y este documento, prevalece este documento; si el conflicto
> exige cambios destructivos o costosos de revertir, debe detenerse el trabajo
> y solicitarse decisión del propietario.

## Misión

Investigar, diseñar y desarrollar **Nodora**, una plataforma privada, original y
local-first de productividad, documentación y gestión del conocimiento,
inspirada conceptualmente en los principios públicos y comportamientos
observables de herramientas como Notion.

El resultado debe ser una aplicación de escritorio instalable que funcione
completamente en la computadora del usuario con Windows, sin conexión a
internet, sin servidores obligatorios y con todos los datos almacenados
localmente.

La arquitectura debe quedar preparada para evolucionar posteriormente hacia:

- Aplicación web.
- Acceso remoto.
- Sincronización entre dispositivos.
- Colaboración en tiempo real.
- Usuarios, equipos, roles y permisos.
- Despliegue privado en la nube.
- Instalación self-hosted.
- Integraciones, automatizaciones e inteligencia artificial.

No debe construirse una copia literal de Notion. No se copiará código,
identidad visual, recursos, textos, iconos ni componentes propietarios. Se
investigará únicamente documentación pública, API pública, artículos técnicos,
comportamientos observables y proyectos open source con licencias compatibles.

Debe diferenciarse siempre entre:

1. Hechos públicamente documentados.
2. Comportamientos observables.
3. Inferencias técnicas.
4. Decisiones originales propuestas para Nodora.

## 1. Principios obligatorios

### Local-first
- La copia principal de los datos existe en el dispositivo del usuario.
- La aplicación puede abrirse, consultarse y editarse sin conexión a internet.
- La pérdida temporal de internet nunca impide trabajar.

### Privacidad y propiedad de los datos
- Los datos pertenecen completamente al usuario.
- No se envía información a terceros sin autorización explícita.
- Debe existir exportación completa y legible de toda la información.
- No debe crearse dependencia irreversible de formatos propietarios.

### Cloud-ready
Aunque el MVP sea local, ninguna decisión importante debe impedir
posteriormente: añadir una API; sincronizar dispositivos; migrar o replicar
información en PostgreSQL; añadir almacenamiento de archivos compatible con S3;
añadir colaboración mediante WebSockets; crear una versión web; implementar
organizaciones, miembros y permisos.

### Arquitectura modular
- Interfaz, lógica de dominio, persistencia, editor, sincronización,
  autenticación e infraestructura desacopladas.
- Sin lógica de negocio dentro de componentes visuales.
- Sin dependencia total de una biblioteca específica sin capa de abstracción.

### Diseño original
- Prohibido copiar código, recursos gráficos, textos, iconos, nombres internos,
  logotipos o componentes propietarios de Notion.
- Prohibida la ingeniería inversa de software privado.
- Investigación permitida: documentación pública, API pública, artículos
  técnicos públicos, comportamientos observables de la interfaz, patrones
  conocidos de gestión del conocimiento, proyectos open source con licencias
  compatibles.
- Nodora debe tener identidad visual y experiencia propias.

## 2. Forma de trabajo

- No construir toda la aplicación en una sola ejecución; trabajar por fases
  controladas.
- Antes de escribir código: completar investigación, arquitectura y definición
  del MVP.
- No avanzar de fase sin presentar: hallazgos, decisiones, alternativas
  descartadas, riesgos, entregables y criterios de cierre de fase.
- Ante decisiones menores faltantes: adoptar el valor más simple, seguro y
  mantenible y documentar la suposición.
- Preguntar solo ante decisiones bloqueantes o difíciles de revertir.
- Producir documentos, estructura de proyecto, código funcional, pruebas y
  comandos reproducibles (no solo recomendaciones).

## 3. Fase 0 — Investigación

Investigar la arquitectura conceptual y funcional de aplicaciones modernas de
gestión del conocimiento, en especial: sistemas basados en bloques, editores de
texto enriquecido, árboles de páginas, bases de datos configurables,
propiedades dinámicas, relaciones entre registros, backlinks, búsqueda de texto
completo, historial de cambios, edición offline, sincronización entre
dispositivos, resolución de conflictos, colaboración en tiempo real, permisos,
archivos adjuntos, exportación y respaldo.

Investigar públicamente Notion para comprender sus principios, sin asumir que
su arquitectura interna completa es pública. Diferenciar hechos documentados,
comportamientos observados, inferencias técnicas y propuestas propias.

Tecnologías a evaluar: Tauri, Electron, React, Next.js, SQLite, PostgreSQL,
ProseMirror, Tiptap, Lexical, Yjs, Automerge, Hocuspocus, IndexedDB, object
storage compatible con S3. Para cada alternativa: madurez, licencia, comunidad,
rendimiento, complejidad, soporte offline, compatibilidad escritorio/web,
self-hosting, riesgo de dependencia del proveedor, facilidad de migración.

**Entregables:** `docs/RESEARCH.md`, `docs/COMPETITOR_ANALYSIS.md`,
`docs/TECHNOLOGY_EVALUATION.md`, `docs/LEGAL_AND_LICENSES.md`,
`docs/RESEARCH_SOURCES.md` (fuentes, fecha de consulta y afirmación que
respalda cada una). Sin código de producción en esta fase.

## 4. Fase 1 — Definición del producto

Nodora será un espacio de trabajo privado para organizar: notas, documentos,
proyectos, tareas, procesos, wikis, bases de datos, conocimiento empresarial,
archivos y relaciones entre información.

**Usuario inicial:** persona o consultora que administra proyectos, clientes,
documentación, procesos y conocimiento desde una aplicación privada instalada
en su computadora.

**Alcance inicial:** MVP de un solo usuario y un solo dispositivo, sin servidor,
capaz de evolucionar a varios usuarios/dispositivos sin reconstruir el modelo
de datos.

**Entregables:** `docs/PRODUCT_VISION.md`, `docs/PRD.md`, `docs/USER_FLOWS.md`,
`docs/MVP_SCOPE.md`, `docs/FUTURE_ROADMAP.md`, `docs/NON_GOALS.md`.
Clasificar cada función como: MVP, Segunda versión, Colaboración, Nube,
Inteligencia artificial o Fuera de alcance.

## 5. MVP funcional

### Espacios de trabajo
Crear espacio local; editar nombre; configurar icono o identificador visual;
abrir automáticamente el último espacio utilizado.

### Páginas
Crear; editar títulos; anidar; reordenar; mover; duplicar; archivar;
restaurar; eliminar definitivamente.

### Editor por bloques
Bloques iniciales: texto, encabezados, listas con viñetas, listas numeradas,
lista de tareas, citas, código, separadores, callouts, imágenes locales,
enlaces, subpáginas.

Capacidades: menú `/`; comandos de teclado; deshacer/rehacer; copiar/pegar;
arrastrar y reordenar; conversión entre bloques compatibles; guardado
automático; recuperación ante cierre inesperado.

### Navegación
Barra lateral; favoritos; páginas recientes; breadcrumbs; atrás/adelante;
apertura rápida por teclado.

### Búsqueda
Por título; dentro del contenido; resultados con fragmentos; filtros básicos;
índice actualizado automáticamente.

### Base de datos sencilla
Vista de tabla. Propiedades: título, texto, número, selección, selección
múltiple, estado, fecha, checkbox, URL. Operaciones: crear/renombrar columnas;
cambiar tipo cuando sea seguro; añadir/editar registros; ordenar; filtrar;
ocultar propiedades; abrir registro como página. Sin fórmulas complejas,
rollups ni automatizaciones.

### Relaciones de conocimiento
Enlaces entre páginas; backlinks; referencias internas; visualización de
páginas relacionadas.

### Importación y exportación
Exportar página a Markdown; exportar espacio completo a JSON; crear respaldo;
restaurar respaldo; validar el respaldo antes de sobrescribir información.

## 6. Arquitectura técnica inicial (referencia a validar)

- **Escritorio:** Tauri 2, React, TypeScript, Vite, pnpm.
- **Editor:** Tiptap o ProseMirror; esquema de nodos y extensiones propias;
  capa de abstracción; preparado para integración futura con Yjs.
- **Persistencia local:** SQLite; migraciones versionadas; transacciones;
  claves foráneas; índices; borrado lógico; FTS5 cuando sea viable. La base
  local es la fuente de verdad del MVP. No almacenar estado principal solo en
  LocalStorage.
- **Archivos:** carpeta controlada por Nodora; identificadores internos (no
  rutas absolutas en documentos); hashes para deduplicación e integridad.
- **Estado:** sistema pequeño y predecible; separar estado visual, del
  documento, persistido, operaciones de dominio y estado futuro de sync.
- **Preparación nube:** interfaces `LocalRepository`, `RemoteRepository`,
  `SyncEngine`, `FileStorage`, `AuthenticationProvider`, `PermissionService`.
  Solo implementaciones locales reales durante el MVP.

Modificar esta referencia únicamente con razón técnica documentada.

## 7. Modelo de datos

Soportar como mínimo: workspaces, users, devices, memberships, pages, blocks,
databases, database properties, database records, relations, backlinks,
attachments, favorites, comments futuros, permissions futuras, activity log,
sync operations futuras.

Cada entidad sincronizable: UUID estable; `created_at`; `updated_at`;
`deleted_at`; `created_by`; `updated_by`; `device_id`; número o vector de
versión cuando corresponda; identificador de operación; metadatos para detectar
conflictos. No usar fechas como único mecanismo de resolución de conflictos.

Para ordenar bloques y páginas: estrategia que permita inserciones y
movimientos sin renumerar toda la colección (p. ej. índices fraccionarios).

Documentar la evolución del modelo local SQLite hacia un sistema sincronizado
con PostgreSQL.

**Entregables:** `docs/DATA_MODEL.md`, `docs/ERD.md`,
`docs/SYNC_DATA_MODEL.md`, `docs/MIGRATION_STRATEGY.md`, migraciones SQL
iniciales.

## 8. Arquitectura de sincronización futura

Evaluar Yjs o CRDT equivalente para: contenido del editor, cambios
concurrentes, trabajo offline, reconciliación automática, presencia, cursores.
No convertir todas las tablas relacionales en documentos CRDT sin justificarlo.
Separar: contenido colaborativo, metadatos, permisos, archivos, operaciones
administrativas, datos estructurados.

Registro de operaciones idempotentes con: `operation_id`, `workspace_id`,
`entity_id`, `entity_type`, `actor_id`, `device_id`, tipo de operación,
payload, versión base, fecha local, fecha del servidor futura, estado de
sincronización. El servidor debe poder recibir una operación repetida sin
aplicarla dos veces.

Documentar: sincronización inicial e incremental, reintentos, conflictos,
tombstones, dispositivos largamente desconectados, eliminaciones,
restauraciones, cambio de permisos, archivos grandes, recuperación ante
corrupción. **Entregable:** `docs/SYNC_ARCHITECTURE.md`.

## 9. Arquitectura futura en la nube

Diseñar fase posterior con: aplicación web, API segura, PostgreSQL, WebSockets,
servidor de colaboración, almacenamiento S3-compatible, autenticación,
organizaciones, miembros, roles, permisos, auditoría, backups, monitoreo.

Primera alternativa de despliegue: self-hosted con Docker Compose. Segunda:
servicios administrados. La infraestructura debe poder ejecutarse en:
computadora local, red privada, servidor doméstico, VPS, nube pública, entorno
empresarial privado.

**Entregables:** `docs/CLOUD_ARCHITECTURE.md`, `docs/SELF_HOSTING.md`,
`docs/DEPLOYMENT_OPTIONS.md`, `docs/COST_ESTIMATE.md`. No implementar la nube
durante el MVP salvo para validar una interfaz arquitectónica.

## 10. Seguridad

Modelo de amenazas que considere: acceso no autorizado al dispositivo, robo del
archivo SQLite, exposición de adjuntos, inyección SQL, XSS en el editor,
archivos maliciosos, path traversal, secretos en el repositorio, corrupción de
respaldos, manipulación de archivos, dependencias vulnerables, escalada de
permisos futura, secuestro de sesiones futuras, sincronización de datos
manipulados.

Implementar desde el MVP: consultas parametrizadas; validación de entradas;
sanitización del contenido renderizado; restricciones de acceso al sistema de
archivos; gestión segura de secretos locales; verificación de integridad de
respaldos; registro de errores sin contenido sensible; CSP apropiada;
actualizaciones de dependencias controladas.

Evaluar cifrado local y documentar: qué se cifra, dónde se guardan las claves,
qué amenazas cubre y cuáles no, impacto en respaldos, búsqueda y recuperación.

**Entregables:** `docs/THREAT_MODEL.md`, `docs/SECURITY_ARCHITECTURE.md`,
`SECURITY.md`.

## 11. Estructura del repositorio

Monorepo preparado para crecer:

```text
nodora/
├── apps/
│   ├── desktop/
│   ├── web/
│   └── server/
├── packages/
│   ├── domain/
│   ├── editor/
│   ├── database/
│   ├── sync/
│   ├── search/
│   ├── ui/
│   ├── shared/
│   └── config/
├── docs/
├── migrations/
├── scripts/
├── tests/
├── docker/
└── .github/
```

Durante el MVP, `web` y `server` pueden existir solo como documentación o
paquetes vacíos claramente identificados. No agregar complejidad sin necesidad.

## 12. Calidad y pruebas

Configurar desde el comienzo: TypeScript estricto, ESLint, formateador,
pruebas unitarias, de integración, del repositorio SQLite, de migraciones, de
respaldo/restauración, básicas de interfaz, manejo centralizado de errores,
logging estructurado, CI.

Probar especialmente: cierre inesperado durante edición; dos guardados
consecutivos; operaciones repetidas; migración desde base antigua; eliminación
y restauración; importación inválida; respaldo corrupto; adjunto faltante;
página con miles de bloques; espacio con miles de páginas; caracteres
especiales y contenido multilingüe.

Una función no está terminada solo porque se ve correctamente: debe existir
evidencia automatizada de que persiste, se recupera y no corrompe información.

## 13. Experiencia de usuario

Interfaz limpia, rápida, profesional, minimalista, accesible, original,
optimizada para teclado, con modo claro y oscuro. No reproducir pixel por
pixel la interfaz de Notion; diseñar sistema visual propio: paleta,
tipografía, espaciado, iconografía, estados de interacción, componentes,
tokens de diseño, guía de accesibilidad.

Estados requeridos: vacío, carga, guardando, guardado, error, sin conexión,
recuperación, respaldo, restauración. **Entregable:** `docs/DESIGN_SYSTEM.md`.

## 14. Gestión del proyecto

Mantener permanentemente: `PROJECT_STATE.md` (estado actual, terminado, en
desarrollo, bloqueos, riesgos, próximo paso exacto, última prueba, resultado de
compilación); `TASKS.md` (Pendiente/En progreso/Bloqueado/Terminado/
Descartado); `DECISIONS.md` (contexto, opciones, decisión, razón,
consecuencias, reversión); `CHANGELOG.md`. El repositorio debe contener estado
suficiente para que otro desarrollador continúe sin el historial del chat.

## 15. Reglas de implementación

Antes de modificar: inspeccionar repo; leer `PROJECT_STATE.md` y
`DECISIONS.md`; identificar el cambio mínimo; explicar qué se modificará.

Después de modificar: ejecutar pruebas relacionadas, typecheck, linter,
compilación; actualizar documentación; informar archivos modificados, comandos
ejecutados y deuda técnica introducida.

No afirmar que algo funciona sin ejecutarlo. No ocultar errores. No reemplazar
implementaciones completas cuando baste un cambio pequeño. No añadir paquetes
sin justificar necesidad, licencia, mantenimiento y alternativa evaluada.

## 16. Criterios de éxito del MVP

El MVP está terminado cuando una persona puede:

1. Instalar Nodora en Windows.
2. Crear un espacio de trabajo.
3. Crear y organizar páginas.
4. Escribir contenido mediante bloques.
5. Cerrar la aplicación.
6. Volver a abrirla sin perder información.
7. Crear una base de datos sencilla.
8. Buscar contenido.
9. Crear enlaces y consultar backlinks.
10. Adjuntar una imagen local.
11. Exportar información.
12. Crear un respaldo.
13. Restaurar un respaldo.
14. Trabajar completamente sin internet.
15. Recuperarse de errores razonables sin corromper los datos.

Además: pruebas críticas en verde; compilación completa; sin cuenta requerida;
sin API externa; sin servidor; código preparado para futuras interfaces de
sincronización.
