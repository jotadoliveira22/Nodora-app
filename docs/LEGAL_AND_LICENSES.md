# LEGAL_AND_LICENSES.md — Marco legal y de licencias

> Fecha: 2026-07-13. Este documento fija las reglas de cumplimiento que rigen
> todo el desarrollo de Nodora.

## 1. Reglas de originalidad (obligatorias)

1. **Prohibido** copiar código, recursos gráficos, textos de interfaz, iconos,
   logotipos, nombres internos o componentes de Notion o de cualquier producto
   propietario.
2. **Prohibida** la ingeniería inversa de software privado (descompilación,
   inspección de binarios, scraping de APIs privadas).
3. **Permitido**: leer documentación pública y API pública de Notion, artículos
   técnicos publicados por sus autores, observar el comportamiento visible del
   producto como usuario, y estudiar proyectos open source respetando sus
   licencias.
4. Los **conceptos** (bloques, backlinks, bases de datos con propiedades) no
   son protegibles por copyright; su **expresión concreta** (código, pixel
   design, textos) sí. Nodora implementa los conceptos con expresión propia.
5. La identidad visual de Nodora (nombre, paleta, tipografía, iconos, layouts)
   se diseña desde cero en `docs/DESIGN_SYSTEM.md`.

## 2. Política de dependencias

- Solo se admiten dependencias con licencias permisivas compatibles con un
  producto propietario/privado: **MIT, Apache-2.0, BSD, ISC, MPL-2.0 (con
  cuidado, sin modificar los archivos MPL), dominio público/CC0**.
- **Prohibido** incorporar código **GPL/AGPL** (AppFlowy, Logseq, Joplin,
  SiYuan…) o **BSL** (Outline) o **ASAL** (Anytype). Puede *estudiarse su
  comportamiento como usuario y su documentación pública*, pero no copiar ni
  adaptar su código.
- Toda dependencia nueva se justifica en `DECISIONS.md` con: necesidad,
  licencia, mantenimiento y alternativa evaluada (regla de la spec §15).

## 3. Licencias del stack seleccionado (verificadas)

| Dependencia | Licencia | Verificación |
|---|---|---|
| Tauri 2 | MIT OR Apache-2.0 | Repo oficial, 2026-07-13 |
| React | MIT | Ampliamente documentado |
| Vite | MIT | Ampliamente documentado |
| TypeScript | Apache-2.0 | Ampliamente documentado |
| Tiptap core + extensiones libres | MIT | tiptap.dev / GitHub, 2026-07-13 |
| ProseMirror | MIT | prosemirror.net |
| Zustand | MIT | GitHub pmndrs |
| rusqlite | MIT | GitHub rusqlite |
| SQLite | Dominio público | sqlite.org |
| Yjs (futuro) | MIT | Repo oficial, 2026-07-13 |
| Hocuspocus (futuro) | MIT | Repo oficial, 2026-07-13 |
| Vitest / ESLint / Prettier | MIT | Ampliamente documentado |

**Nota Tiptap:** el modelo comercial de Tiptap (junio 2025) cobra por servicios
cloud (colaboración alojada, IA, documentos). Nodora **no** usa esos servicios;
usa únicamente los paquetes npm MIT. Riesgo residual: futuras extensiones
podrían nacer bajo licencia de pago; mitigación: capa de abstracción y
fallback a ProseMirror puro (ver TECHNOLOGY_EVALUATION.md §3).

## 4. Licencia del propio Nodora

Nodora es un producto **privado** del propietario del repositorio. Mientras no
se decida otra cosa: repositorio privado, sin licencia open source publicada
(todos los derechos reservados). Si en el futuro se distribuye, deberá
añadirse un archivo `LICENSE` explícito y un aviso de atribuciones de terceros
(los MIT/Apache requieren conservar sus avisos de copyright en la
distribución: se generará un `THIRD_PARTY_NOTICES` en el empaquetado).

## 5. Marcas

"Notion" es marca de Notion Labs, Inc. Nodora no usará la marca en el
producto, marketing ni UI. Las menciones en `docs/` son nominativas y de
investigación. El nombre "Nodora" fue provisto por el propietario; no se ha
realizado búsqueda de disponibilidad de marca (fuera de alcance técnico; se
recomienda verificación legal antes de distribución comercial).

## 6. Datos personales

El MVP no recolecta, transmite ni telemetría ningún dato. Cualquier función
futura de nube deberá pasar por revisión de privacidad (GDPR/LOPD según
mercado) antes de activarse por defecto.
