/**
 * Backend en memoria para las pruebas de interfaz.
 *
 * Implementa la frontera IPC (mismos nombres de comando y mismas formas de
 * DTO en camelCase que el backend Rust; el contrato está verificado del lado
 * Rust por `tests/robustness.rs::ipc_dtos_serialize_in_camel_case`).
 *
 * Su propósito es ejercitar los flujos de INTERFAZ. La lógica real de
 * persistencia se prueba en Rust; aquí solo se comprueba que la UI llama a
 * lo que debe y reacciona a lo que recibe.
 */
(() => {
  const uuid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();

  const state = {
    workspace: null,
    known: [],
    pages: new Map(),
    favorites: [],
    recents: [],
    databases: new Map(),
    properties: new Map(),
    values: new Map(),
    links: [],
    settings: new Map(),
    calls: [],
  };

  const err = (code, message) => {
    throw { code, message };
  };

  function summary(p) {
    return {
      id: p.id,
      parentPageId: p.parentPageId,
      title: p.title,
      icon: p.icon,
      position: p.position,
      kind: p.kind,
      databaseId: p.databaseId,
      archivedAt: p.archivedAt,
      hasChildren: [...state.pages.values()].some(
        (c) => c.parentPageId === p.id && !c.archivedAt && c.kind !== 'record',
      ),
      updatedAt: p.updatedAt,
    };
  }

  function newPage(parentPageId, title, icon, kind = 'page', databaseId = null) {
    const p = {
      id: uuid(),
      parentPageId,
      title: title ?? '',
      icon: icon ?? null,
      position: String(state.pages.size).padStart(4, '0'),
      kind,
      databaseId,
      archivedAt: null,
      contentJson: JSON.stringify({ type: 'doc', content: [] }),
      version: 1,
      updatedAt: now(),
    };
    state.pages.set(p.id, p);
    return p;
  }

  function detail(p) {
    return {
      id: p.id,
      parentPageId: p.parentPageId,
      title: p.title,
      icon: p.icon,
      kind: p.kind,
      databaseId: p.databaseId,
      archivedAt: p.archivedAt,
      contentJson: p.contentJson,
      version: p.version,
      updatedAt: p.updatedAt,
    };
  }

  function plainText(node, out) {
    if (!node) return out;
    if (node.type === 'text') out.push(node.text ?? '');
    (node.content ?? []).forEach((c) => plainText(c, out));
    return out;
  }

  const handlers = {
    // ---- workspace ----
    list_known_workspaces: () => state.known,
    create_workspace: ({ name, icon }) => {
      const ws = { id: uuid(), name, icon: icon ?? null, path: `/fake/${name}` };
      state.workspace = ws;
      state.known.unshift({ id: ws.id, name: ws.name, path: ws.path, lastOpenedAt: now() });
      const p = newPage(null, 'Bienvenida', '👋');
      p.contentJson = JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { blockId: uuid() },
            content: [{ type: 'text', text: 'Tu espacio de trabajo privado.' }],
          },
        ],
      });
      return ws;
    },
    open_workspace: ({ path }) => {
      const k = state.known.find((w) => w.path === path);
      if (!k) err('WORKSPACE_NOT_FOUND', 'El espacio de trabajo no existe o no está abierto');
      state.workspace = { id: k.id, name: k.name, icon: null, path: k.path };
      return state.workspace;
    },
    open_last_workspace: () => state.workspace,
    current_workspace: () => state.workspace,
    close_workspace: () => null,
    forget_workspace: () => null,
    rename_workspace: ({ name }) => {
      state.workspace.name = name;
      return null;
    },
    set_workspace_icon: ({ icon }) => {
      state.workspace.icon = icon;
      return null;
    },
    get_app_setting: ({ key }) => state.settings.get(key) ?? null,
    set_app_setting: ({ key, value }) => {
      state.settings.set(key, value);
      return null;
    },

    // ---- páginas ----
    create_page: ({ parentPageId, title, icon }) =>
      detail(newPage(parentPageId ?? null, title, icon)),
    get_page: ({ id }) => {
      const p = state.pages.get(id);
      if (!p || p.deleted) err('PAGE_NOT_FOUND', 'La página no existe');
      return detail(p);
    },
    list_pages: () =>
      [...state.pages.values()]
        .filter((p) => !p.deleted && !p.archivedAt && p.kind !== 'record')
        .sort((a, b) => a.position.localeCompare(b.position))
        .map(summary),
    list_archived_pages: () =>
      [...state.pages.values()].filter((p) => !p.deleted && p.archivedAt).map(summary),
    rename_page: ({ id, title }) => {
      const p = state.pages.get(id);
      if (!p) err('PAGE_NOT_FOUND', 'La página no existe');
      p.title = title;
      p.version += 1;
      p.updatedAt = now();
      return { version: p.version, updatedAt: p.updatedAt };
    },
    set_page_icon: ({ id, icon }) => {
      const p = state.pages.get(id);
      p.icon = icon;
      p.version += 1;
      p.updatedAt = now();
      return { version: p.version, updatedAt: p.updatedAt };
    },
    save_page_content: ({ id, contentJson, baseVersion }) => {
      const p = state.pages.get(id);
      if (!p) err('PAGE_NOT_FOUND', 'La página no existe');
      if (p.version !== baseVersion) {
        err('VERSION_CONFLICT', 'El contenido cambió desde la última carga; recarga la página');
      }
      p.contentJson = contentJson;
      p.version += 1;
      p.updatedAt = now();
      // Reconciliación de enlaces, igual que el backend real.
      state.links = state.links.filter((l) => l.sourcePageId !== id);
      const walk = (n, blockId) => {
        const bid = n.attrs?.blockId ?? blockId;
        if (n.type === 'pageLink' && n.attrs?.pageId) {
          state.links.push({ sourcePageId: id, targetPageId: n.attrs.pageId, blockId: bid ?? '' });
        }
        (n.content ?? []).forEach((c) => walk(c, bid));
      };
      walk(JSON.parse(contentJson), null);
      return { version: p.version, updatedAt: p.updatedAt };
    },
    move_page: ({ id, newParentId }) => {
      const p = state.pages.get(id);
      let cur = newParentId;
      while (cur) {
        if (cur === id) err('CYCLE_DETECTED', 'La operación crearía un ciclo en el árbol');
        cur = state.pages.get(cur)?.parentPageId ?? null;
      }
      p.parentPageId = newParentId ?? null;
      return null;
    },
    duplicate_page: ({ id }) => {
      const src = state.pages.get(id);
      const copy = newPage(src.parentPageId, `${src.title} (copia)`, src.icon);
      copy.contentJson = src.contentJson;
      return copy.id;
    },
    archive_page: ({ id }) => {
      const stamp = now();
      const mark = (pid) => {
        const p = state.pages.get(pid);
        if (!p) return;
        p.archivedAt = stamp;
        [...state.pages.values()].filter((c) => c.parentPageId === pid).forEach((c) => mark(c.id));
      };
      mark(id);
      return null;
    },
    restore_page: ({ id }) => {
      const unmark = (pid) => {
        const p = state.pages.get(pid);
        if (!p) return;
        p.archivedAt = null;
        [...state.pages.values()]
          .filter((c) => c.parentPageId === pid)
          .forEach((c) => unmark(c.id));
      };
      unmark(id);
      return null;
    },
    delete_page_permanently: ({ id }) => {
      let n = 0;
      const kill = (pid) => {
        const p = state.pages.get(pid);
        if (!p) return;
        p.deleted = true;
        n += 1;
        [...state.pages.values()].filter((c) => c.parentPageId === pid).forEach((c) => kill(c.id));
      };
      kill(id);
      state.pages.forEach((p, k) => p.deleted && state.pages.delete(k));
      return n;
    },
    get_backlinks: ({ id }) =>
      state.links
        .filter((l) => l.targetPageId === id)
        .map((l) => {
          const src = state.pages.get(l.sourcePageId);
          return {
            sourcePageId: l.sourcePageId,
            title: src?.title ?? '',
            icon: src?.icon ?? null,
            blockId: l.blockId,
          };
        }),
    get_breadcrumbs: ({ id }) => {
      const out = [];
      let cur = id;
      while (cur) {
        const p = state.pages.get(cur);
        if (!p) break;
        out.unshift({ id: p.id, title: p.title, icon: p.icon });
        cur = p.parentPageId;
      }
      return out;
    },
    add_favorite: ({ id }) => {
      if (!state.favorites.includes(id)) state.favorites.push(id);
      return null;
    },
    remove_favorite: ({ id }) => {
      state.favorites = state.favorites.filter((f) => f !== id);
      return null;
    },
    list_favorites: () =>
      state.favorites
        .map((id) => state.pages.get(id))
        .filter(Boolean)
        .map(summary),
    is_favorite: ({ id }) => state.favorites.includes(id),
    touch_recent: ({ id }) => {
      state.recents = [id, ...state.recents.filter((r) => r !== id)].slice(0, 20);
      return null;
    },
    list_recents: ({ limit }) =>
      state.recents
        .map((id) => state.pages.get(id))
        .filter((p) => p && !p.deleted && !p.archivedAt)
        .slice(0, limit ?? 10)
        .map(summary),
    linkable_pages: ({ query }) =>
      [...state.pages.values()]
        .filter(
          (p) =>
            !p.deleted &&
            !p.archivedAt &&
            p.title.toLowerCase().includes((query ?? '').toLowerCase()),
        )
        .map(summary),

    // ---- búsqueda ----
    search_pages: ({ query, includeArchived }) => {
      const q = (query ?? '').trim().toLowerCase();
      if (!q) return [];
      return [...state.pages.values()]
        .filter((p) => !p.deleted && (includeArchived || !p.archivedAt))
        .map((p) => {
          const text = plainText(JSON.parse(p.contentJson), []).join(' ');
          const inTitle = p.title.toLowerCase().includes(q);
          const idx = text.toLowerCase().indexOf(q);
          if (!inTitle && idx < 0) return null;
          const snippet =
            idx >= 0
              ? `${text.slice(Math.max(0, idx - 20), idx)}«${text.slice(idx, idx + q.length)}»${text.slice(idx + q.length, idx + q.length + 30)}`
              : '';
          return {
            pageId: p.id,
            title: p.title,
            icon: p.icon,
            snippet,
            archived: Boolean(p.archivedAt),
            kind: p.kind,
          };
        })
        .filter(Boolean);
    },

    // ---- bases de datos ----
    create_database: ({ parentPageId, title }) => {
      const page = newPage(parentPageId ?? null, title, null, 'database');
      const db = { id: uuid(), pageId: page.id, title };
      state.databases.set(db.id, db);
      const prop = {
        id: uuid(),
        databaseId: db.id,
        name: 'Título',
        type: 'title',
        configJson: '{}',
        position: '0',
        hidden: false,
      };
      state.properties.set(db.id, [prop]);
      return { id: db.id, pageId: page.id, title, properties: [prop] };
    },
    get_database_by_page: ({ pageId }) => {
      const db = [...state.databases.values()].find((d) => d.pageId === pageId);
      if (!db) err('DATABASE_NOT_FOUND', 'La base de datos interna no existe');
      return {
        id: db.id,
        pageId: db.pageId,
        title: state.pages.get(db.pageId).title,
        properties: state.properties.get(db.id),
      };
    },
    add_property: ({ databaseId, name, propType }) => {
      const props = state.properties.get(databaseId);
      const prop = {
        id: uuid(),
        databaseId,
        name,
        type: propType,
        configJson: '{}',
        position: String(props.length),
        hidden: false,
      };
      props.push(prop);
      return prop;
    },
    rename_property: ({ propertyId, name }) => {
      for (const props of state.properties.values()) {
        const p = props.find((x) => x.id === propertyId);
        if (p) p.name = name;
      }
      return null;
    },
    set_property_hidden: ({ propertyId, hidden }) => {
      for (const props of state.properties.values()) {
        const p = props.find((x) => x.id === propertyId);
        if (p) p.hidden = hidden;
      }
      return null;
    },
    set_property_config: ({ propertyId, configJson }) => {
      for (const props of state.properties.values()) {
        const p = props.find((x) => x.id === propertyId);
        if (p) p.configJson = configJson;
      }
      return null;
    },
    delete_property: ({ propertyId }) => {
      for (const [k, props] of state.properties) {
        state.properties.set(
          k,
          props.filter((x) => x.id !== propertyId),
        );
      }
      return null;
    },
    change_property_type: ({ propertyId, newType, dryRun }) => {
      if (newType === 'checkbox') {
        err('UNSAFE_TYPE_CONVERSION', 'Conversión de tipo no segura: text → checkbox');
      }
      if (!dryRun) {
        for (const props of state.properties.values()) {
          const p = props.find((x) => x.id === propertyId);
          if (p) p.type = newType;
        }
      }
      return { convertible: 1, lossy: 0, applied: !dryRun };
    },
    create_record: ({ databaseId }) => {
      const db = state.databases.get(databaseId);
      const page = newPage(db.pageId, '', null, 'record', databaseId);
      return page.id;
    },
    list_records: ({ databaseId, sort }) => {
      let rows = [...state.pages.values()]
        .filter((p) => p.databaseId === databaseId && !p.deleted && !p.archivedAt)
        .map((p) => ({
          pageId: p.id,
          title: p.title,
          icon: p.icon,
          position: p.position,
          values: state.values.get(p.id) ?? {},
        }));
      if (sort) {
        rows.sort((a, b) => a.title.localeCompare(b.title));
        if (sort.direction === 'desc') rows.reverse();
      }
      return rows;
    },
    set_record_value: ({ recordPageId, propertyId, valueJson }) => {
      const vals = state.values.get(recordPageId) ?? {};
      if (valueJson === null) delete vals[propertyId];
      else vals[propertyId] = valueJson;
      state.values.set(recordPageId, vals);
      return null;
    },

    // ---- adjuntos / export / respaldos ----
    import_attachment_from_path: ({ path }) => ({
      id: uuid(),
      originalName: String(path).split('/').pop(),
      mime: 'image/png',
      sizeBytes: 68,
      sha256: 'x'.repeat(64),
    }),
    import_attachment_base64: ({ name }) => ({
      id: uuid(),
      originalName: name,
      mime: 'image/png',
      sizeBytes: 68,
      sha256: 'y'.repeat(64),
    }),
    resolve_attachment: () => '/fake/attachments/x.png',
    verify_attachment: () => true,
    export_page_markdown: () => ['/fake/salida.md'],
    export_workspace_json: () => null,
    create_backup: () => '/fake/backups/nodora-backup.zip',
    validate_backup: () => ({
      formatVersion: 1,
      schemaVersion: 1,
      workspaceName: 'Respaldo de prueba',
      createdAt: now(),
      pageCount: 3,
      attachmentCount: 1,
    }),
    restore_backup: () => '/fake/restaurado',
  };

  window.__TAURI_INTERNALS__ = {
    invoke: async (cmd, args) => {
      state.calls.push(cmd);
      // Diálogos nativos: la prueba define de antemano qué devuelven.
      if (cmd.startsWith('plugin:dialog|')) {
        return window.__NODORA_TEST__.dialogResult;
      }
      const h = handlers[cmd];
      if (!h) throw { code: 'INTERNAL', message: `comando no implementado: ${cmd}` };
      return h(args ?? {});
    },
    convertFileSrc: (p) => `asset://localhost/${encodeURIComponent(p)}`,
    transformCallback: (cb) => {
      const id = Math.floor(Math.random() * 1e9);
      window[`_${id}`] = cb;
      return id;
    },
  };

  window.__NODORA_TEST__ = {
    dialogResult: null,
    state,
    calls: () => state.calls,
  };
})();
