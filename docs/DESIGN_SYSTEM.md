# DESIGN_SYSTEM.md — Sistema de diseño de Nodora

> Identidad visual original de Nodora. No se replican layouts, colores,
> iconos ni textos de ningún producto existente.

## Personalidad

Calma, precisa, tipográfica. La interfaz desaparece detrás del contenido.
Nombre interno del tema: **"Tinta y papel"** (claro) / **"Grafito"** (oscuro).

## Tokens (CSS custom properties, prefijo `--nd-`)

### Color — modo claro
| Token | Valor | Uso |
|---|---|---|
| `--nd-bg` | `#FAFAF7` | fondo de app (papel cálido) |
| `--nd-surface` | `#FFFFFF` | tarjetas, popovers |
| `--nd-sidebar` | `#F1F0EB` | barra lateral |
| `--nd-text` | `#1F2328` | texto primario |
| `--nd-text-muted` | `#5B6472` | secundario (AA sobre fondo y barra lateral) |
| `--nd-border` | `#E3E2DC` | bordes/divisores |
| `--nd-accent` | `#2F6F5E` | acción primaria (verde bosque propio) |
| `--nd-accent-soft` | `#E4F0EC` | fondos de selección/hover accent |
| `--nd-danger` | `#B4372F` | destructivo |
| `--nd-warning` | `#9A6B15` | avisos |
| `--nd-info` | `#31597F` | información |

### Color — modo oscuro
`--nd-bg #16181D · surface #1E2127 · sidebar #1A1D22 · text #E8E6E1 ·
muted #9AA0A6 · border #2C3037 · accent #6FB39E · accent-soft #24352F ·
danger #D26A63 · warning #C99A4B · info #7FA6C9`

Paleta funcional para etiquetas select/status (12 tonos con par claro/oscuro,
contraste AA sobre su fondo): `gray, brown, orange, amber, green, teal, blue,
indigo, purple, pink, red, olive` — valores en `packages/ui/tokens.css`.

### Tipografía
- UI y contenido: pila de sistema — `ui-sans-serif, "Segoe UI", Roboto,
  "Helvetica Neue", Arial, sans-serif` (rápida, sin fuentes externas: regla
  offline).
- Código: `ui-monospace, "Cascadia Code", Consolas, monospace`.
- Escala: 12 / 13 / 14 (base) / 16 / 20 / 24 / 32. Interlineado 1.6 en
  contenido, 1.4 en UI. Ancho de columna de lectura: 44rem máx.

### Espaciado y forma
Escala de 4: `4, 8, 12, 16, 24, 32, 48`. Radio: 4 (controles), 8 (tarjetas),
12 (diálogos). Sombra solo en capas flotantes (2 niveles).

### Movimiento
120 ms `ease-out` en hover/apertura; 200 ms en diálogos; sin animaciones
decorativas; respeta `prefers-reduced-motion`.

## Iconografía

**Lucide** (licencia ISC, permisiva): set consistente de trazo, sin coste de
diseño propio y sin parecido con la iconografía de productos concretos.
Tamaños 16/20. Los iconos de página del usuario son emoji del sistema.

## Componentes (packages/ui)

Button (primary/ghost/danger), IconButton, Input, Select propio, Checkbox,
Dialog, Popover, Menu contextual, Tooltip, Toast, Tabs, Tree (sidebar),
EmptyState, Spinner, Kbd, Badge/Tag, Breadcrumbs, Table (para DB view).
Todos: navegables por teclado, foco visible (`outline` accent 2px), ARIA
correcta, tema claro/oscuro por tokens.

## Estados obligatorios (spec §13)

| Estado | Patrón |
|---|---|
| Vacío | Ilustración tipográfica sobria + una acción primaria |
| Carga | Skeletons (sin spinners de página completa) |
| Guardando / Guardado | Indicador discreto en cabecera (`● Guardando…` → `✓ Guardado`) |
| Error | Mensaje inline + acción de reintento; nunca pierde el trabajo del usuario |
| Sin conexión | Componente existe (badge); en MVP siempre "local" |
| Recuperación | Banner discreto "Se recuperó la sesión anterior" |
| Respaldo/Restauración | Diálogo con progreso por pasos y resumen verificado |

## Accesibilidad

- Contraste AA mínimo en ambos temas (verificado en tokens).
- 100 % operable por teclado; atajos documentados en la app (Ctrl+/):
  Ctrl+K quick open · Ctrl+N nueva página · Alt+←/→ historial · Ctrl+B/I/E
  formato · `/` bloques · `@` enlaces.
- Roles/etiquetas ARIA en árbol, menús, diálogos y editor.
- Tamaño de tipografía base ajustable (V2).

## Modo claro/oscuro

Automático según SO con override manual (claro/oscuro/sistema) persistido en
`app_settings`. Implementado con `data-theme` en la raíz + tokens.
