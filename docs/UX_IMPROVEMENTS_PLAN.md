# UX_IMPROVEMENTS_PLAN.md — Mejoras de experiencia posteriores a la beta

> Documento previo a la implementación, exigido por el proceso del proyecto
> («antes de escribir código de producción, documenta el alcance, las
> alternativas técnicas, la arquitectura, el modelo de datos, los riesgos y las
> decisiones difíciles de revertir»).
>
> Origen: peticiones del propietario tras usar la beta v0.1.0, acompañadas de
> dos capturas de pantalla de Notion como referencia de comportamiento.

## 0. Conflicto detectado con una restricción del proyecto

La restricción vigente es explícita: **no copiar código, recursos gráficos,
textos, identidad visual ni componentes propietarios de Notion**; solo se
permite estudiar documentación pública, API pública, artículos técnicos,
**comportamientos observables** y proyectos open source con licencia
compatible.

Las capturas aportadas son de la interfaz de Notion. Eso obliga a separar dos
cosas que a simple vista parecen una sola:

| Se puede tomar | No se puede tomar |
|---|---|
| El **patrón funcional**: un panel que lista los espacios y permite cambiar entre ellos; una página vacía que ofrece poner icono, portada y elegir un punto de partida | Su **maquetación exacta**, tipografías, iconografía, espaciados y paleta |
| La **idea** de ofrecer plantillas al crear una página | Sus **textos literales** («¿Con qué quieres empezar?», «Mejorar tu plan», «Anotador con IA») |
| La **jerarquía de información** (identidad del espacio arriba, acciones debajo, lista de espacios al pie) | Sus **nombres de producto y funciones propietarias** |

**Decisión (D-UX-1):** se implementan los patrones funcionales con la
identidad visual propia de Nodora (`docs/DESIGN_SYSTEM.md`), textos propios y
los iconos de Lucide (ISC) que ya usa el proyecto. Ninguna captura se usa como
referencia píxel a píxel.

### Elementos de la captura 1 que **no** se implementan, y por qué

La captura muestra un menú de cuenta de un producto SaaS multiusuario:

- «Plan gratuito · 1 miembro», «Mejorar tu plan» — Nodora no tiene planes ni
  cobro. No hay nada que mostrar.
- «Invitar a miembros» — usuarios, equipos y roles están **explícitamente
  diferidos** (`docs/NON_GOALS.md`, `docs/FUTURE_ROADMAP.md`). La arquitectura
  está preparada (tablas `users`, `memberships`), pero pintar el botón sin la
  función detrás sería una promesa falsa.
- «Añadir cuenta», la cabecera con el correo, «Cerrar sesión» — Nodora no tiene
  cuentas ni sesión: no requiere registro ni conexión. Es el rasgo central del
  producto, no una carencia.

Poner esos elementos exigiría inventar conceptos que el producto no tiene. Lo
que sí se toma de esa captura es su **estructura**: identidad del espacio
actual arriba, acciones de ese espacio en medio, lista de espacios conocidos
abajo y una acción clara para crear uno nuevo al pie.

## 1. Alcance

### 1.1 Eliminar espacios de trabajo

Hoy `Registry::forget()` existe en el backend y el comando `forget_workspace`
está expuesto, pero **ninguna pantalla lo usa**: un espacio creado por error se
queda en la lista para siempre. No existe ninguna forma de borrar sus datos
desde la aplicación.

Se implementan **dos acciones distintas**, porque mezclarlas es exactamente
como se pierden datos:

1. **Quitar de la lista** — llama a `forget_workspace`. No toca el disco. La
   carpeta sigue ahí y se recupera con «Abrir carpeta…». Reversible.
2. **Eliminar del disco…** — borra la carpeta completa del espacio. Comando
   nuevo `delete_workspace_folder`. Irreversible.

Salvaguardas de la segunda (todas obligatorias):

- No se puede eliminar el espacio **abierto** en ese momento: primero hay que
  cambiar a otro o cerrarlo. Evita borrar el archivo que la aplicación tiene
  abierto y con WAL activo.
- Diálogo que exige **escribir el nombre del espacio** para habilitar el botón.
  Un `confirm()` de una pulsación es demasiado poco para una acción sin vuelta
  atrás.
- El diálogo indica cuántas páginas y cuántos MB se van a perder, y ofrece
  **crear un respaldo antes** con un clic.
- El backend valida que la ruta **es un espacio de Nodora** (contiene
  `nodora.db` con el esquema esperado) antes de borrar nada. Sin esa
  comprobación, una ruta corrupta en el registro podría llevarse por delante
  una carpeta cualquiera del usuario.
- Se borra el contenido conocido del espacio y la carpeta; nunca se borra de
  forma recursiva y ciega una ruta que no supere la validación.

### 1.2 Menú principal del espacio

Se reorganiza `WorkspaceMenu` + `WorkspaceSwitcher` en un único panel con la
estructura de tres bloques descrita arriba:

- **Cabecera:** icono, nombre del espacio y una línea de contexto real y
  verificable — número de páginas y tamaño en disco (Nodora no tiene «miembros»
  que contar, pero sí datos propios que mostrar).
- **Acciones del espacio:** configuración (renombrar e icono), tema, archivo,
  exportar, respaldar, restaurar, liberar espacio.
- **Espacios conocidos:** lista con marca en el actual, cambio con un clic,
  menú contextual por fila con «Quitar de la lista» y «Eliminar del disco…», y
  al pie «Nuevo espacio de trabajo» y «Abrir carpeta…».

### 1.3 Página nueva

Estado actual: una página recién creada muestra el campo de título y un editor
vacío, sin ninguna indicación de qué hacer. El icono solo se puede poner desde
`⋯ → Cambiar icono…`, con un `window.prompt()`.

Cambios:

- Barra de acciones sobre el título, visible al pasar el cursor y siempre
  visible mientras la página está vacía: **Añadir icono** y **Añadir portada**.
- Selector de emoji propio, con buscador y categorías, en lugar del `prompt()`.
- **Punto de partida** al pie del cuerpo vacío: una fila de opciones (página en
  blanco, base de datos y las plantillas) que desaparece en cuanto se escribe
  algo. No es un bloque del documento: es interfaz, no contenido, así que no
  ensucia el JSON de la página ni las exportaciones.

### 1.4 Plantillas

Catálogo de plantillas **de datos**, no de código: cada una es un objeto con
título sugerido, icono, documento ProseMirror inicial y, opcionalmente, un
esquema de base de datos con sus propiedades. Vive en
`packages/shared/src/templates/`, con lo que backend, frontend y pruebas ven la
misma definición.

Ventaja de ese diseño: añadir una plantilla nueva no toca ni un componente ni
un comando, y las plantillas quedan cubiertas por una única prueba
parametrizada que valida cada documento contra el validador de documentos ya
existente.

## 2. Alternativas consideradas

| Decisión | Alternativas | Elegida y por qué |
|---|---|---|
| Portada de página | (a) columna nueva en `pages`; (b) guardarla dentro de `settings_json`; (c) bloque del documento | **(a)**. Es un atributo de la página, no contenido: como bloque contaminaría exportaciones y búsqueda; en un JSON opaco no se puede consultar ni migrar con garantías |
| Origen de la portada | (a) solo colores/degradados propios; (b) imagen del usuario vía adjuntos; (c) galería de fotos embebida | **(a) + (b)**. Reutiliza el sistema de adjuntos ya probado y sigue funcionando sin internet. Una galería embebida engordaría el instalador sin aportar |
| Plantillas | (a) datos declarativos en `shared`; (b) archivos Markdown incrustados; (c) plantillas creadas por el usuario | **(a)** para esta tanda. (c) es una función de producto por derecho propio y se registra en el roadmap |
| Eliminar espacio | (a) una sola acción destructiva; (b) dos acciones separadas | **(b)**. Quitar de la lista y borrar del disco son intenciones distintas con consecuencias muy distintas |

## 3. Cambio en el modelo de datos

Migración `002_page_cover.sql` sobre el esquema del workspace:

```sql
ALTER TABLE pages ADD COLUMN cover_kind TEXT;   -- NULL | 'color' | 'attachment'
ALTER TABLE pages ADD COLUMN cover_value TEXT;  -- id del preset o del adjunto
```

Notas:

- Aditiva y con valores nulos: una base v1 abierta por la versión nueva se
  migra sin pérdida, y el mecanismo de checksums y rollback transaccional ya
  existente la cubre.
- **No es reversible por el usuario**: una vez migrada, la base no la abre una
  versión anterior de Nodora (el arranque rechaza esquemas más nuevos, por
  diseño). Es la decisión más costosa de revertir de esta tanda.
- La exportación JSON sube a la versión `2` de su formato incluyendo la
  portada; el importador de la v1 sigue siendo válido porque el campo es
  opcional.

## 4. Riesgos

1. **Borrado de datos del usuario** (1.1). Mitigado con las cinco salvaguardas
   descritas; se cubre con pruebas de que la validación rechaza rutas que no
   son espacios de Nodora y de que el espacio abierto no se puede eliminar.
2. **Migración de esquema** (3). Mitigado por el mecanismo existente, pero
   conviene crear un respaldo antes de instalar la versión nueva.
3. **Deriva hacia la interfaz ajena** (0). Mitigado por D-UX-1 y por la
   revisión explícita de textos e iconos frente a la lista de la §0.
4. **Crecimiento del alcance.** Las plantillas son un pozo sin fondo: se cierra
   el catálogo inicial y lo demás va al roadmap.

## 5. Decisiones abiertas

Ninguna bloquea el arranque; se anotan las asunciones tomadas por defecto:

- **Alcance del borrado:** se implementan las dos acciones (asunción tomada al
  no haber respuesta; es la opción segura y no impide adoptar otra después).
- **Portada:** se incluye, con la migración de la §3.
- **Catálogo de plantillas:** se parte de un conjunto amplio y se ajusta con
  la respuesta del propietario.

## 6. Orden de trabajo

1. Eliminar espacios (backend + salvaguardas + pruebas).
2. Panel del espacio reorganizado.
3. Migración de portada y atributos de página.
4. Página nueva: barra de acciones, selector de emoji, portada.
5. Catálogo de plantillas y punto de partida.
6. Pruebas de interfaz y accesibilidad de todo lo anterior; documentación.
