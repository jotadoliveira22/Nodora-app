# RESEARCH_SOURCES.md — Registro de fuentes

> Toda fuente lista: URL, fecha de consulta, método y qué afirmación respalda.
> Método: **F** = fetch directo verificado en esta sesión; **S** = resultados
> de buscador verificados en esta sesión; **K** = conocimiento técnico
> consolidado del autor con URL de referencia (el fetch directo devolvió 403 a
> través del proxy del entorno; la afirmación es de bajo riesgo y verificable).

| # | Fuente | Fecha | Método | Respalda |
|---|---|---|---|---|
| 1 | https://github.com/tauri-apps/tauri | 2026-07-13 | F | Tauri MIT/Apache-2.0; v2 estable (v2.11.5, jul-2026); ~109k★; soporta Windows 7+, macOS 10.15+, Linux (webkit2gtk-4.1), iOS, Android |
| 2 | https://github.com/yjs/yjs | 2026-07-13 | F | Yjs MIT; 22.2k★; usado por Linear, GitBook, Evernote, ProtonMail Docs, JupyterLab, AWS SageMaker; bindings y-prosemirror (Tiptap), Lexical, etc. |
| 3 | https://github.com/automerge/automerge | 2026-07-13 | F | Automerge MIT; núcleo Rust; Automerge 3 con ~10x menos memoria; 6.4k★ |
| 4 | https://github.com/ueberdosis/hocuspocus | 2026-07-13 | F | Hocuspocus MIT; backend WebSocket Yjs; hooks de auth y persistencia; v4.4.0 (jul-2026) |
| 5 | https://tiptap.dev/pricing + https://github.com/ueberdosis/tiptap + https://news.ycombinator.com/item?id=44202103 | 2026-07-13 | S | Tiptap core MIT; 10 extensiones ex-Pro liberadas MIT (2025); pricing 2025 cobra servicios cloud (Start $49/mes…), OSS gratis |
| 6 | https://developers.notion.com/guides/data-apis/working-with-page-content | 2026-07-13 | S | API pública Notion: contenido de página = lista de blocks; block tiene `type`, `has_children`, `parent`; bloques anidados por listas ordenadas de IDs; páginas se crean dentro de páginas o databases |
| 7 | https://www.notion.com/blog/data-model-behind-notion | 2026-07-13 | S/K | Post oficial de ingeniería: "todo es un bloque"; árbol por `parent`+`content`; permisos en páginas heredados por el árbol (fetch directo 403; título y contenido corroborados por resultados de búsqueda y conocimiento del post, publicado en 2021) |
| 8 | https://openalternative.co/... (comparativas AppFlowy/Joplin/Logseq/Anytype/Outline) | 2026-07-13 | S | Licencias: AppFlowy, Logseq, Joplin, SiYuan, Docmost AGPL-3.0; Outline BSL 1.1; Anytype ASAL (no OSI); AFFiNE en listados OSI |
| 9 | https://sqlite.org/fts5.html | 2026-07-13 | K | FTS5: índice full-text embebido, BM25, `snippet()`/`highlight()`, external content tables, tokenizador unicode61 con remove_diacritics (fetch 403; documentación estable y pública de SQLite) |
| 10 | https://www.figma.com/blog/realtime-editing-of-ordered-sequences/ | 2026-07-13 | K | Fractional indexing: posiciones entre vecinos, inserciones sin renumerar, problemas de crecimiento de clave e interleaving (fetch 403; artículo público de 2017 ampliamente citado) |
| 11 | https://www.inkandswitch.com/local-first/ | 2026-07-13 | K | Ensayo "Local-first software" (2019): siete ideales local-first; CRDTs como fundamento (fetch 403; ensayo público ampliamente citado) |
| 12 | https://prosemirror.net/docs/guide/ | 2026-07-13 | K | ProseMirror: documento en árbol tipado por schema, transacciones, plugins (documentación pública estable) |

## Notas de método

- Los fetch marcados **F** se realizaron el 2026-07-13 a través del proxy del
  entorno y sus datos se citan tal como se obtuvieron.
- Varios sitios (notion.com blog, sqlite.org, figma.com, inkandswitch.com)
  devolvieron HTTP 403 al proxy; se citan como **K** solo afirmaciones
  estables, públicas y de bajo riesgo, corroboradas por los resultados de
  búsqueda listados. Ninguna decisión arquitectónica depende exclusivamente de
  una fuente K.
- No se consultó ninguna fuente privada ni se realizó ingeniería inversa.
