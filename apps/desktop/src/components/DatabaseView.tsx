/** Vista de tabla de una base de datos interna (PRD R6, F6). */
import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, EyeOff, MoreHorizontal, Plus } from 'lucide-react';

import {
  dbApi,
  isApiError,
  pagesApi,
  type DbDetail,
  type DbProperty,
  type DbRecordRow,
} from '../services/api';
import { useAppStore } from '../stores/appStore';
import { CellEditor } from './CellEditor';
import { ContextMenu, Modal, type MenuItem } from './ui';

const PROPERTY_TYPES: { id: string; label: string }[] = [
  { id: 'text', label: 'Texto' },
  { id: 'number', label: 'Número' },
  { id: 'select', label: 'Selección' },
  { id: 'multi_select', label: 'Selección múltiple' },
  { id: 'status', label: 'Estado' },
  { id: 'date', label: 'Fecha' },
  { id: 'checkbox', label: 'Checkbox' },
  { id: 'url', label: 'URL' },
];

interface Filter {
  propertyId: string;
  operator: string;
  valueJson: string | null;
}

export function DatabaseView({ pageId }: { pageId: string }) {
  const { navigate, notifyError, toast } = useAppStore();
  const [db, setDb] = useState<DbDetail | null>(null);
  const [rows, setRows] = useState<DbRecordRow[]>([]);
  const [sort, setSort] = useState<{ propertyId: string | null; direction: 'asc' | 'desc' } | null>(
    null,
  );
  const [filter, setFilter] = useState<Filter | null>(null);
  const [colMenu, setColMenu] = useState<{ x: number; y: number; prop: DbProperty } | null>(null);
  const [addingCol, setAddingCol] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState('text');
  const [showHidden, setShowHidden] = useState(false);

  const load = useCallback(async () => {
    try {
      const detail = await dbApi.byPage(pageId);
      setDb(detail);
      const records = await dbApi.listRecords(detail.id, sort, filter ? [filter] : []);
      setRows(records);
    } catch (e) {
      notifyError(e, 'No se pudo cargar la base de datos');
    }
  }, [pageId, sort, filter, notifyError]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!db) return <div className="nd-spinner" aria-label="Cargando" />;

  const visibleProps = db.properties.filter((p) => showHidden || !p.hidden);
  const hiddenCount = db.properties.filter((p) => p.hidden).length;

  const addRecord = async () => {
    try {
      await dbApi.createRecord(db.id);
      await load();
    } catch (e) {
      notifyError(e, 'No se pudo crear el registro');
    }
  };

  const addColumn = async () => {
    if (!newColName.trim()) return;
    try {
      await dbApi.addProperty(db.id, newColName.trim(), newColType);
      setAddingCol(false);
      setNewColName('');
      await load();
    } catch (e) {
      notifyError(e, 'No se pudo crear la columna');
    }
  };

  const changeType = async (prop: DbProperty, newType: string) => {
    try {
      const report = await dbApi.changePropertyType(prop.id, newType, true);
      const msg =
        report.lossy > 0
          ? `Se convertirán ${report.convertible} valores; ${report.lossy} no son convertibles y se vaciarán. ¿Continuar?`
          : `Se convertirán ${report.convertible} valores sin pérdida. ¿Continuar?`;
      if (!window.confirm(msg)) return;
      await dbApi.changePropertyType(prop.id, newType, false);
      await load();
      toast('Tipo de columna cambiado');
    } catch (e) {
      if (isApiError(e) && e.code === 'UNSAFE_TYPE_CONVERSION') {
        toast(`Conversión no disponible: ${e.message}`, 'error');
      } else {
        notifyError(e, 'No se pudo cambiar el tipo');
      }
    }
  };

  const colMenuItems = (prop: DbProperty): MenuItem[] => {
    const items: MenuItem[] = [
      {
        label: 'Ordenar ascendente',
        icon: <ArrowUp size={14} />,
        onClick: () =>
          setSort({ propertyId: prop.type === 'title' ? null : prop.id, direction: 'asc' }),
      },
      {
        label: 'Ordenar descendente',
        icon: <ArrowDown size={14} />,
        onClick: () =>
          setSort({ propertyId: prop.type === 'title' ? null : prop.id, direction: 'desc' }),
      },
      { label: '', separator: true },
      {
        label: 'Renombrar…',
        onClick: () => {
          const name = window.prompt('Nombre de la columna:', prop.name);
          if (name?.trim())
            void dbApi
              .renameProperty(prop.id, name.trim())
              .then(load)
              .catch((e) => notifyError(e, 'No se pudo renombrar'));
        },
      },
    ];
    if (prop.type !== 'title') {
      items.push(
        {
          label: 'Cambiar tipo ▸',
          onClick: () => {
            const t = window.prompt(
              `Tipo destino (${PROPERTY_TYPES.map((t) => t.id).join(', ')}):`,
              prop.type,
            );
            if (t && t !== prop.type) void changeType(prop, t);
          },
        },
        {
          label: prop.hidden ? 'Mostrar columna' : 'Ocultar columna',
          icon: <EyeOff size={14} />,
          onClick: () =>
            void dbApi
              .setPropertyHidden(prop.id, !prop.hidden)
              .then(load)
              .catch((e) => notifyError(e, 'No se pudo ocultar')),
        },
        { label: '', separator: true },
        {
          label: 'Eliminar columna',
          danger: true,
          onClick: () => {
            if (window.confirm(`Eliminar la columna «${prop.name}» y sus valores?`))
              void dbApi
                .deleteProperty(prop.id)
                .then(load)
                .catch((e) => notifyError(e, 'No se pudo eliminar'));
          },
        },
      );
    }
    return items;
  };

  const filterProp = filter ? db.properties.find((p) => p.id === filter.propertyId) : null;

  return (
    <div className="nd-db-wrap" style={{ padding: 0 }}>
      <div className="nd-db-toolbar">
        <button className="nd-btn nd-btn--primary" onClick={() => void addRecord()}>
          <Plus size={14} style={{ verticalAlign: -2 }} /> Nuevo registro
        </button>
        <button className="nd-btn nd-btn--ghost" onClick={() => setAddingCol(true)}>
          + Columna
        </button>
        {sort && (
          <button className="nd-chip nd-chip--on" onClick={() => setSort(null)}>
            Orden: {db.properties.find((p) => p.id === sort.propertyId)?.name ?? 'Título'}{' '}
            {sort.direction === 'asc' ? '↑' : '↓'} ✕
          </button>
        )}
        {filter && (
          <button className="nd-chip nd-chip--on" onClick={() => setFilter(null)}>
            Filtro: {filterProp?.name ?? '—'} {filter.operator} ✕
          </button>
        )}
        {!filter && (
          <select
            className="nd-chip"
            style={{ background: 'transparent' }}
            value=""
            aria-label="Añadir filtro"
            onChange={(e) => {
              const prop = db.properties.find((p) => p.id === e.target.value);
              if (!prop) return;
              if (prop.type === 'checkbox') {
                setFilter({ propertyId: prop.id, operator: 'is_checked', valueJson: null });
              } else {
                const val = window.prompt(`Filtrar «${prop.name}» que contenga:`, '');
                if (val !== null)
                  setFilter({
                    propertyId: prop.id,
                    operator: 'contains',
                    valueJson: JSON.stringify(val),
                  });
              }
            }}
          >
            <option value="">+ Filtro</option>
            {db.properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        {hiddenCount > 0 && (
          <button className="nd-chip" onClick={() => setShowHidden(!showHidden)}>
            {showHidden ? 'Ocultar ocultas' : `${hiddenCount} columna(s) oculta(s)`}
          </button>
        )}
      </div>

      <table className="nd-db-table">
        <thead>
          <tr>
            {visibleProps.map((prop) => (
              <th key={prop.id} style={prop.hidden ? { opacity: 0.5 } : undefined}>
                <button
                  className="nd-db-th"
                  onClick={(e) => setColMenu({ x: e.clientX, y: e.clientY, prop })}
                >
                  <span>{prop.name}</span>
                  <MoreHorizontal size={13} style={{ color: 'var(--nd-text-muted)' }} />
                </button>
              </th>
            ))}
            <th style={{ minWidth: 44, width: 44 }} aria-label="Abrir" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.pageId}>
              {visibleProps.map((prop) =>
                prop.type === 'title' ? (
                  <td key={prop.id}>
                    <TitleCell row={row} onSaved={load} />
                  </td>
                ) : (
                  <td key={prop.id}>
                    <CellEditor
                      prop={prop}
                      valueJson={row.values[prop.id]}
                      onSave={async (vj) => {
                        await dbApi.setRecordValue(row.pageId, prop.id, vj);
                        await load();
                        if (
                          prop.type === 'select' ||
                          prop.type === 'status' ||
                          prop.type === 'multi_select'
                        ) {
                          // recargar opciones nuevas
                          const detail = await dbApi.byPage(pageId);
                          setDb(detail);
                        }
                      }}
                    />
                  </td>
                ),
              )}
              <td>
                <button
                  className="nd-icon-btn"
                  style={{ margin: 4 }}
                  aria-label="Abrir como página"
                  title="Abrir como página"
                  onClick={() => void navigate(row.pageId)}
                >
                  <ExternalLink size={14} />
                </button>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td
                colSpan={visibleProps.length + 1}
                style={{ padding: 16, color: 'var(--nd-text-muted)' }}
              >
                Sin registros. Crea el primero con «Nuevo registro».
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {colMenu && (
        <ContextMenu
          x={colMenu.x}
          y={colMenu.y}
          items={colMenuItems(colMenu.prop)}
          onClose={() => setColMenu(null)}
        />
      )}
      {addingCol && (
        <Modal
          title="Nueva columna"
          onClose={() => setAddingCol(false)}
          footer={
            <>
              <button className="nd-btn nd-btn--ghost" onClick={() => setAddingCol(false)}>
                Cancelar
              </button>
              <button
                className="nd-btn nd-btn--primary"
                disabled={!newColName.trim()}
                onClick={() => void addColumn()}
              >
                Crear
              </button>
            </>
          }
        >
          <input
            className="nd-input"
            placeholder="Nombre de la columna"
            value={newColName}
            onChange={(e) => setNewColName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void addColumn()}
          />
          <select
            className="nd-input"
            style={{ marginTop: 8 }}
            value={newColType}
            aria-label="Tipo"
            onChange={(e) => setNewColType(e.target.value)}
          >
            {PROPERTY_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Modal>
      )}
      <div style={{ height: '20vh' }} />
    </div>
  );
}

function TitleCell({ row, onSaved }: { row: DbRecordRow; onSaved: () => Promise<void> }) {
  const { notifyError } = useAppStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.title);
  if (!editing) {
    return (
      <button
        className="nd-db-cell"
        style={{ fontWeight: 500 }}
        onClick={() => {
          setDraft(row.title);
          setEditing(true);
        }}
      >
        {row.title || <span style={{ color: 'var(--nd-text-muted)' }}>Sin título</span>}
      </button>
    );
  }
  return (
    <input
      className="nd-db-cell-input"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        void pagesApi
          .rename(row.pageId, draft)
          .then(onSaved)
          .catch((e) => notifyError(e, 'No se pudo renombrar'));
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setEditing(false);
      }}
    />
  );
}
