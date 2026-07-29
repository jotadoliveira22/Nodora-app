# Guía de uso de Nodora

Nodora es tu espacio de trabajo privado. Funciona **completamente en tu
equipo**: no necesita cuenta, ni servidor, ni conexión a internet.

## Instalación en Windows

1. Descarga el instalador `Nodora_0.1.0_x64-setup.exe`.
2. Ejecútalo. Windows SmartScreen puede advertir que el editor es
   desconocido: la aplicación aún no tiene firma de código (ver
   *Limitaciones conocidas*). Elige «Más información» → «Ejecutar de todas
   formas» si confías en el origen del archivo.
3. La instalación es para el usuario actual y no requiere privilegios de
   administrador.

## Primeros pasos

### Crear tu espacio de trabajo

Al abrir Nodora por primera vez verás la pantalla de bienvenida. Escribe un
nombre (por ejemplo, «Mi Consultora»), elige un emoji y pulsa **Crear
espacio**. Nodora creará una carpeta con:

```text
mi-consultora/
├── nodora.db        Tu base de datos (páginas, bases de datos, índices)
├── attachments/     Las imágenes que insertes
└── backups/         Respaldos que crees sin elegir otra carpeta
```

Esa carpeta **es** tu espacio: puedes copiarla a otro equipo o a un disco
externo y abrirla desde allí con «Abrir carpeta…».

### Varios espacios de trabajo

Puedes tener tantos como quieras (por ejemplo, uno por cliente). En el menú
del espacio → **Espacios de trabajo…** verás cada uno con lo que contiene
(páginas, adjuntos y tamaño en disco), y podrás **cambiar** a cualquiera,
**crear uno nuevo** o **abrir una carpeta** que ya contenga un espacio.

Cada fila tiene un menú **⋯** con dos formas distintas de quitarlo de en medio:

- **Quitar de la lista** — deja de aparecer, pero **no toca el disco**. Sus
  datos siguen ahí y lo recuperas con «Abrir carpeta…».
- **Eliminar del disco…** — borra la carpeta entera: base de datos, adjuntos y
  los respaldos que guardes dentro. **No se puede deshacer**, así que Nodora
  te dice cuántas páginas y cuántos MB vas a perder, te ofrece crear un
  respaldo antes y te pide escribir el nombre del espacio para confirmarlo. No
  puedes eliminar el espacio que tienes abierto: cambia a otro primero.

### Escribir

- Pulsa **+** en la barra lateral (o `Ctrl+N`) para crear una página.
- Una página recién creada te ofrece **Añadir icono**, **Añadir portada** y
  **Usar plantilla** sobre el título, y una fila de puntos de partida al pie
  que desaparece en cuanto escribes algo.
- Escribe el título y pulsa `Enter` para bajar al contenido.
- Dentro del contenido, escribe `/` para abrir el menú de bloques: texto,
  encabezados, listas, tareas, citas, código, separadores, callouts,
  imágenes, enlaces y subpáginas.
- También funcionan los atajos de Markdown mientras escribes: `# `, `## `,
  `- `, `1. `, `> ` y ``` ``` ```.
- Escribe `@` para enlazar otra página.

Todo se guarda solo. En la parte superior verás «Guardando…» y luego
«Guardado». Si cierras la aplicación de golpe, como mucho perderás los
últimos segundos de escritura.

### Organizar

- Arrastra o usa el menú **⋯ → Mover a…** para reordenar y anidar páginas.
- **⋯ → Duplicar** copia la página con todas sus subpáginas.
- **⋯ → Archivar** la retira de la vista sin borrarla. Recupérala desde el
  menú del espacio → **Archivo**.
- Desde el Archivo puedes **Eliminar** definitivamente (te avisa de cuántas
  subpáginas se eliminarán; esta acción no se deshace).

### Buscar

Pulsa `Ctrl+K` en cualquier momento. Busca por título y por contenido, con
los fragmentos coincidentes resaltados. Los filtros «incluir archivadas» y
«solo títulos» acotan la búsqueda. Con la caja vacía verás tus favoritos y
las páginas recientes.

### Enlaces y backlinks

Cuando enlazas una página con `@`, la página enlazada muestra al pie
«N páginas enlazan aquí». Los enlaces apuntan a un identificador interno, así
que **siguen funcionando aunque renombres la página**.

### Bases de datos

Pulsa el icono de tabla en la barra lateral para crear una base de datos.
Tendrá una vista de tabla con una columna «Título».

- **+ Columna** para añadir propiedades: texto, número, selección, selección
  múltiple, estado, fecha, checkbox o URL.
- **Nuevo registro** añade una fila.
- Clic en la cabecera de una columna para ordenar, renombrar, ocultar,
  cambiar el tipo o eliminarla. Al cambiar el tipo, Nodora te dice cuántos
  valores se convertirán y cuántos se perderán **antes** de aplicarlo, y solo
  ofrece conversiones seguras.
- El icono ⤢ de cada fila abre el registro como una página completa, con sus
  propiedades arriba y espacio libre para escribir debajo.

### Plantillas

En una página vacía, **Usar plantilla** (o ⋯ → **Aplicar una plantilla…**)
abre el catálogo, agrupado por temas: consultora y clientes, proyectos, notas
y conocimiento, personal y otras. Unas rellenan la página con su estructura;
otras crean una base de datos con sus columnas ya definidas (tareas, CRM,
contenidos, calendario, hábitos, lecturas, operaciones).

Cuatro plantillas llevan un aviso porque su nombre promete más de lo que esta
versión hace: **Reunión grabada** (Nodora no graba ni transcribe; guarda el
enlace a tu grabación), **Panel de control** (aún no hay fórmulas ni
gráficos), **Calendario** (la vista de calendario llegará más adelante; de
momento es una tabla) y **Diario de trading** (los importes se anotan a mano,
no hay cotizaciones). El aviso aparece antes de aplicarlas.

### Icono y portada

El icono se elige desde un selector con buscador. La portada puede ser uno de
los ocho degradados de Nodora o una imagen tuya: la imagen se copia dentro de
la carpeta del espacio, así que sigue funcionando sin conexión y viaja con tus
respaldos. Para quitarla, entra en la portada → **Quitar portada**.

### Imágenes

Usa `/imagen`, arrastra un archivo al editor o pega desde el portapapeles.
Nodora copia la imagen a la carpeta `attachments/` del espacio (nunca deja
referencias a rutas de tu disco) y detecta imágenes repetidas para no
duplicarlas. Formatos admitidos: PNG, JPEG, GIF y WebP, hasta 50 MB.

## Exportar, respaldar y restaurar

Tus datos son tuyos y siempre puedes llevártelos.

| Acción | Dónde | Qué obtienes |
|---|---|---|
| Exportar página | ⋯ de la página → Exportar a Markdown | Un `.md` (opcionalmente con las subpáginas) más una carpeta `assets/` con las imágenes |
| Exportar todo | Menú del espacio → Exportar todo a JSON | Un `.json` con todo el contenido y su estructura |
| Crear respaldo | Menú del espacio → Crear respaldo | Un `.zip` con la base de datos, los adjuntos y un manifiesto con huellas de verificación |
| Restaurar | Menú del espacio → Restaurar respaldo | Nodora **verifica** el respaldo completo antes de tocar nada |

### Liberar espacio

Con el tiempo pueden quedar imágenes que ya no usa ninguna página (porque
borraste el bloque o la página entera). En el menú del espacio →
**Liberar espacio**, Nodora calcula cuáles son y te dice cuántas y cuántos MB
recuperarías **antes** de borrar nada. Las imágenes que sigan insertadas en
alguna página no se tocan, y los archivos que Nodora no reconozca (por
ejemplo, si copiaste la carpeta a medias) se informan pero nunca se eliminan
solos. Como la operación no se puede deshacer, conviene crear un respaldo
antes.

**La restauración nunca sobrescribe tu espacio actual**: crea siempre un
espacio nuevo junto al existente. Si el archivo está dañado o alterado,
Nodora lo rechaza y te lo dice, sin modificar ningún dato.

Conviene crear un respaldo antes de cambios grandes y guardarlo fuera del
equipo (disco externo o unidad de red).

## Atajos de teclado

| Atajo | Acción |
|---|---|
| `Ctrl+K` / `Ctrl+P` | Buscar y abrir |
| `Ctrl+N` | Nueva página |
| `Alt+←` / `Alt+→` | Atrás / adelante |
| `/` | Menú de bloques |
| `@` | Enlazar una página |
| `Ctrl+B` / `Ctrl+I` | Negrita / cursiva |
| `Ctrl+Z` / `Ctrl+Y` | Deshacer / rehacer |

## Tema claro y oscuro

Menú del espacio → **Tema claro/oscuro**. Por defecto Nodora sigue la
configuración de Windows.

## Preguntas frecuentes

**¿Necesito internet?** No. Nodora no hace ninguna petición de red.

**¿Dónde están mis datos?** En la carpeta del espacio que elegiste. Por
defecto, dentro de `%APPDATA%\com.nodora.app\workspaces\`.

**¿Puedo abrir el mismo espacio desde dos equipos?** Todavía no: la
sincronización entre dispositivos está diseñada pero no implementada (ver
`docs/FUTURE_ROADMAP.md`). Mientras tanto, usa respaldos para moverte de un
equipo a otro y trabaja en un solo sitio a la vez.

**¿Puedo inspeccionar mis datos con otras herramientas?** Sí. `nodora.db` es
un archivo SQLite estándar; cualquier visor de SQLite puede abrirlo.

**¿Qué pasa si el equipo se apaga mientras escribo?** La base usa
transacciones y modo WAL: al reabrir, tu contenido estará como en el último
guardado automático. Nunca queda a medias.

## Limitaciones conocidas de esta versión

- Sin firma de código: Windows mostrará una advertencia al instalar.
- Un solo usuario y un solo dispositivo (sin sincronización ni colaboración).
- Sin historial de versiones navegable: hay durabilidad y respaldos, pero no
  «volver a la versión de ayer».
- Bases de datos: solo vista de tabla, sin fórmulas ni relaciones entre
  bases.
- Editor: sin tablas, columnas ni bloques desplegables (previstos para la
  siguiente versión).
- Al instalar esta versión sobre un espacio creado con la anterior, la base se
  actualiza para admitir portadas. **Después de eso, una versión anterior de
  Nodora ya no podrá abrir ese espacio**: crea un respaldo antes de
  actualizar.
- Sin importadores desde otras herramientas.
- Al renombrar una página, los enlaces que apuntan a ella y que estén en la
  página abierta siguen mostrando el nombre anterior hasta que navegues fuera
  y vuelvas (el enlace funciona igual).

## Si algo va mal

- El registro de errores está en el directorio de datos de la aplicación,
  en `logs/nodora.log`. No contiene el contenido de tus páginas.
- Si un espacio no abre porque moviste la carpeta, usa «Abrir carpeta…» en
  la pantalla de bienvenida para indicar su nueva ubicación.
- Si una imagen aparece como «no disponible», el archivo falta en
  `attachments/`; restaura un respaldo para recuperarla.
