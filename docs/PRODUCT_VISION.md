# PRODUCT_VISION.md — Visión de producto de Nodora

## Qué es Nodora

Nodora es un **espacio de trabajo privado y local-first** para organizar
notas, documentos, proyectos, tareas, procesos, wikis, bases de datos,
conocimiento empresarial, archivos y las relaciones entre toda esa
información.

Es una aplicación de escritorio instalable que funciona **completamente en la
computadora del usuario**: sin cuenta, sin servidor, sin internet. Los datos
viven en el disco del usuario, en formatos abiertos y exportables.

## Para quién

El usuario inicial es una **persona o consultora** que administra proyectos,
clientes, documentación, procesos y conocimiento, y que necesita:

- Trabajar aunque no haya red.
- Garantía de que su información no sale de su máquina.
- Un solo lugar para notas libres y datos estructurados.
- Poder llevarse todo (exportación completa, respaldos verificables).

## Principios de producto

1. **Tu disco es la verdad.** La copia primaria de los datos está en el
   dispositivo; la nube (futura) es una réplica, nunca la dueña.
2. **Nunca pierdas trabajo.** Autosave, transacciones, recuperación ante
   cierres inesperados y respaldos verificados son requisitos de primera
   clase, no extras.
3. **Sin lock-in.** Exportación Markdown/JSON completa y documentada; el
   formato interno (SQLite) es inspeccionable con herramientas estándar.
4. **Estructura opcional.** Empiezas con una nota vacía; la estructura
   (bases de datos, propiedades, relaciones) se añade cuando aporta valor.
5. **Rápida y de teclado.** Abrir, buscar, navegar y escribir sin tocar el
   ratón; ninguna operación común debe sentirse lenta.
6. **Preparada para crecer.** Un día habrá web, sincronización, equipo y
   nube privada; ninguna decisión del MVP debe hacer eso imposible.

## Qué NO es Nodora

- No es un clon de Notion: es un producto propio inspirado en patrones
  públicos de la categoría.
- No es una app de nube con modo offline: es local-first con nube opcional
  futura.
- No es un editor de archivos Markdown sueltos: es una base de conocimiento
  con estructura, búsqueda y relaciones.

## Métrica de éxito del MVP

Una consultora puede gestionar un cliente real (proyecto, notas de reuniones,
tareas, documentos adjuntos) durante una semana sin internet, cerrar y abrir
la app cuantas veces quiera sin perder nada, y llevarse todo en un respaldo
que restaura en otra instalación.
