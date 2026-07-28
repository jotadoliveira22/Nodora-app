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

Es el único criterio de la spec §16 que no aparece en la tanda anterior.
Está cubierto por pruebas automatizadas (rechazo de guardados obsoletos e
inválidos sin alterar el contenido, respaldos corruptos rechazados, adjunto
faltante, rollback de migración fallida, transacción sin confirmar invisible
tras reabrir), pero conviene comprobarlo en la aplicación real.

Guion sugerido:

1. **Cierre abrupto mientras se escribe.** Escribe varias líneas y, sin
   esperar al indicador «Guardado», cierra la aplicación desde el
   Administrador de tareas. Vuelve a abrirla.
   *Esperado:* la página abre correctamente y conserva todo salvo, como
   mucho, los últimos segundos de escritura. Nada queda a medias.
2. **Respaldo manipulado.** Copia un `.zip` de respaldo, ábrelo con
   cualquier compresor y modifica un byte de `nodora.db` (o borra un
   archivo de `attachments/`). Intenta restaurarlo.
   *Esperado:* Nodora lo rechaza indicando que el respaldo no es válido y
   **no** modifica ningún dato del espacio actual.
3. **Adjunto que desaparece.** Con la aplicación cerrada, borra a mano un
   archivo de la carpeta `attachments/`. Abre la página que lo usaba.
   *Esperado:* el bloque muestra «Imagen no disponible» y el resto de la
   página funciona con normalidad.
4. **Carpeta del espacio movida.** Cierra Nodora, mueve la carpeta del
   espacio a otra ubicación y vuelve a abrir la aplicación.
   *Esperado:* pantalla de recuperación que permite localizar la carpeta,
   abrir otro espacio o crear uno nuevo. Nunca un cierre inesperado.

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
