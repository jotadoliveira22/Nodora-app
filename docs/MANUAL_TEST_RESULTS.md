# MANUAL_TEST_RESULTS.md — Pruebas manuales

Registro de las validaciones hechas por una persona sobre la aplicación
instalada, complementarias a las pruebas automatizadas (`cargo test`,
Vitest y Playwright).

## v0.1.0 — Beta privada (2026-07-28)

**Ejecutadas por:** el propietario del producto, sobre el instalador de
Windows generado por CI (artefacto `nodora-windows-installer`, commit
`e0c7a92`).

**Resultado: 13 de 13 aprobadas.**

| # | Prueba | Resultado | Criterio de la spec §16 |
|---|---|---|---|
| 1 | Instalación y apertura | Aprobada | 1 |
| 2 | Autosave y persistencia | Aprobada | 4, 5, 6 |
| 3 | Apertura sin internet | Aprobada | 14 |
| 4 | Crear páginas | Aprobada | 2, 3 |
| 5 | Renombrar página | Aprobada | 3 |
| 6 | Subpáginas | Aprobada | 3 |
| 7 | Búsqueda | Aprobada | 8 |
| 8 | Backlinks | Aprobada | 9 |
| 9 | Base de datos | Aprobada | 7 |
| 10 | Adjuntos | Aprobada | 10 |
| 11 | Exportación | Aprobada | 11 |
| 12 | Respaldo | Aprobada | 12 |
| 13 | Restauración | Aprobada | 13 |

Con esto, **14 de los 15 criterios de éxito quedan verificados también a
mano**. La prueba 1 es especialmente relevante porque cierra el único
criterio que no podía demostrarse desde el entorno de desarrollo (Linux):
que el instalador funciona en Windows de verdad.

## Pendiente de validación manual

### Criterio 15 — Recuperarse de errores razonables sin corromper los datos

Es el único criterio de la spec §16 que no aparece en la tanda de v0.1.0.
Está cubierto por pruebas automatizadas, pero conviene comprobarlo en la
aplicación real. Guion detallado abajo.

---

## Guion: prueba del criterio 15

**Objetivo:** comprobar que Nodora aguanta cuatro fallos realistas sin perder
ni corromper datos. Se rompen cosas **a propósito**, así que se hace sobre un
espacio de pruebas, nunca sobre trabajo real.

### Preparación (obligatoria)

1. Abre Nodora y crea un espacio nuevo llamado **Pruebas 15**.
2. Crea una página «Notas» con un par de párrafos, una lista de tareas y
   **una imagen** (`/imagen` o arrastrando un PNG).
3. Crea una segunda página «Contrato» y enlázala desde «Notas» con `@`.
4. Espera a ver **«✓ Guardado»** en la cabecera.
5. Menú del espacio → **Crear respaldo**. Guárdalo en el Escritorio: es la
   red de seguridad y además el material del escenario 2.

La carpeta del espacio está, por defecto, en:

```text
%APPDATA%\com.nodora.app\workspaces\pruebas-15
```

(pega esa ruta en la barra del Explorador de Windows).

---

### Escenario 1 — Cierre abrupto mientras se escribe

Comprueba que un corte de luz o un cuelgue no dejan la base a medias.

1. Abre «Notas» y escribe un párrafo nuevo bien reconocible, por ejemplo
   `PRUEBA DE CIERRE ABRUPTO`.
2. **Sin esperar** a que aparezca «Guardado» (el guardado automático espera
   0,8 s tras dejar de teclear), abre el Administrador de tareas
   (`Ctrl+Shift+Esc`), busca **Nodora** y pulsa **Finalizar tarea**.
3. Vuelve a abrir Nodora.

**Aprobada si:** la aplicación abre con normalidad en el mismo espacio, la
página «Notas» se ve completa y conserva el texto anterior. El párrafo nuevo
puede estar o no según cuándo cortaste; lo que **no** puede ocurrir es que
falte contenido anterior, que la página aparezca vacía o rota, ni que salga
un error al abrir.

**Fallida si:** la aplicación no arranca, la página aparece vacía o truncada
por la mitad, o se pierde contenido que ya estaba guardado.

Repítelo 2 o 3 veces cortando en momentos distintos (justo al teclear, y
justo después de ver «Guardando…»).

---

### Escenario 2 — Respaldo manipulado

Comprueba que un respaldo dañado se rechaza **sin tocar** tus datos.

1. Copia el `.zip` del respaldo del Escritorio y renombra la copia a
   `respaldo-danado.zip`.
2. Ábrelo con el Explorador (doble clic) o con 7-Zip y **borra de dentro** el
   archivo `nodora.db`. Si tu compresor no deja editar dentro del ZIP,
   descomprímelo, borra `nodora.db`, y vuelve a comprimir la carpeta.
3. En Nodora: menú del espacio → **Restaurar respaldo** → elige
   `respaldo-danado.zip`.

**Aprobada si:** Nodora muestra un aviso de que el respaldo no es válido
(mensajes posibles: «falta nodora.db», «hash no coincide: …», «no es un ZIP
válido» o «no es una base de Nodora») y **no** cambia nada: sigues en tu
espacio, con tus páginas intactas.

**Fallida si:** acepta el respaldo dañado, borra o altera algo del espacio
actual, o se cierra inesperadamente.

**Variante recomendada (más exigente):** en vez de borrar `nodora.db`, ábrelo
con el Bloc de notas desde el ZIP descomprimido, cambia unos cuantos
caracteres del medio, guarda y vuelve a comprimir. Debe rechazarlo igual, por
la huella SHA-256 del manifiesto.

**Contraprueba:** restaura ahora el respaldo **bueno**. Debe crear un espacio
nuevo llamado **Pruebas 15-restaurado** (nunca sobrescribe el original) con
todo el contenido, incluidas la imagen y los backlinks.

---

### Escenario 3 — Adjunto que desaparece

Comprueba que la falta de un archivo no rompe la página.

1. Cierra Nodora.
2. Ve a `%APPDATA%\com.nodora.app\workspaces\pruebas-15\attachments`.
3. Borra el archivo de imagen que hay allí (se llama con un identificador
   largo, por ejemplo `3f2a…c1.png`).
4. Abre Nodora y ve a «Notas».

**Aprobada si:** donde estaba la imagen aparece
**«🖼️ Imagen no disponible (adjunto faltante)»**, y el resto de la página —
texto, lista de tareas, enlaces — funciona con total normalidad. Puedes
seguir editando y guardando.

**Fallida si:** la página no carga, la aplicación se cierra, o el resto del
contenido deja de verse o de guardarse.

**Recuperación:** restaura el respaldo bueno; la imagen vuelve.

---

### Escenario 4 — Carpeta del espacio movida

Comprueba que Nodora no se cuelga si el espacio ya no está donde estaba.

1. Cierra Nodora.
2. Mueve la carpeta `pruebas-15` completa a otro sitio, por ejemplo al
   Escritorio.
3. Abre Nodora.

**Aprobada si:** aparece la pantalla de bienvenida (en vez de un error o un
cierre inesperado), y con **«Abrir carpeta…»** puedes señalar la nueva
ubicación y recuperar el espacio con todo su contenido.

**Fallida si:** la aplicación se cierra al arrancar, se queda en blanco, o
no hay forma de volver a abrir el espacio desde su nueva ubicación.

**Nota esperada:** el espacio seguirá apareciendo en «Espacios recientes» con
la ruta antigua; al pulsarlo dará un aviso de que no existe. Es correcto:
usa «Abrir carpeta…» para registrarlo en su ubicación nueva.

---

### Después de la prueba

Comprueba que el registro de errores no filtra tu contenido: abre

```text
%APPDATA%\com.nodora.app\logs\nodora.log
```

**Esperado:** solo códigos de error, identificadores y datos técnicos. **No**
debe aparecer el texto de tus páginas ni los títulos.

Cuando termines, puedes eliminar el espacio «Pruebas 15» y sus copias.

### Plantilla de resultados

```text
Criterio 15 — Recuperación ante errores

E1 cierre abrupto mientras se escribe .... APROBADA / FALLIDA — notas:
E2 respaldo manipulado ................... APROBADA / FALLIDA — notas:
E2b restauración del respaldo bueno ...... APROBADA / FALLIDA — notas:
E3 adjunto borrado a mano ................ APROBADA / FALLIDA — notas:
E4 carpeta del espacio movida ............ APROBADA / FALLIDA — notas:
Log sin contenido de usuario ............. SÍ / NO
```

---

### Incidencias reportadas en la beta y ya corregidas

Detectadas por el propietario el 2026-07-28 usando la aplicación instalada:

1. **Los menús `/` y `@` no respondían al clic del ratón** (solo al teclado).
   Causa: la lista flotante recreaba su DOM al pasar el cursor, destruyendo
   la fila que se iba a pulsar. Corregido y cubierto por dos pruebas nuevas
   que usan el ratón, no Enter.
2. **No había forma de crear ni cambiar de espacio de trabajo** una vez
   abierto el primero. Corregido con el gestor «Espacios de trabajo…», con
   prueba de interfaz que crea un segundo espacio y vuelve al primero.

### Funciones del MVP no cubiertas por la tanda anterior

No son criterios de éxito de la spec, pero forman parte del alcance del MVP
y conviene ejercitarlas antes de usar Nodora en un cliente real:

- Mover y duplicar páginas (incluido el subárbol completo).
- Archivar, restaurar desde el Archivo y eliminar definitivamente.
- Favoritos y páginas recientes.
- Bases de datos: ordenar, filtrar, ocultar columnas y **cambiar el tipo de
  una columna** (con el aviso previo de cuántos valores se convierten).
- Abrir un registro como página y editar sus propiedades.
- «Liberar espacio» (recolección de adjuntos sin referencias).
- Tema claro/oscuro y navegación completa por teclado.
