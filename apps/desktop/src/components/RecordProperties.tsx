/** Propiedades de un registro abierto como página (PRD R6.6, F6.5). */
import { useCallback, useEffect, useState } from 'react';

import { dbApi, type DbDetail, type DbRecordRow } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { CellEditor } from './CellEditor';

export function RecordProperties({
  recordPageId,
  databasePageId,
}: {
  recordPageId: string;
  databasePageId: string;
}) {
  const { notifyError } = useAppStore();
  const [db, setDb] = useState<DbDetail | null>(null);
  const [row, setRow] = useState<DbRecordRow | null>(null);

  const load = useCallback(async () => {
    try {
      const detail = await dbApi.byPage(databasePageId);
      setDb(detail);
      const rows = await dbApi.listRecords(detail.id, null, []);
      setRow(rows.find((r) => r.pageId === recordPageId) ?? null);
    } catch (e) {
      notifyError(e, 'No se pudieron cargar las propiedades');
    }
  }, [databasePageId, recordPageId, notifyError]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!db || !row) return null;
  const props = db.properties.filter((p) => p.type !== 'title' && !p.hidden);
  if (!props.length) return null;

  return (
    <div
      style={{
        border: '1px solid var(--nd-border)',
        borderRadius: 'var(--nd-radius-md)',
        marginBottom: 20,
      }}
    >
      {props.map((prop) => (
        <div
          key={prop.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid var(--nd-border)',
          }}
        >
          <span
            style={{
              width: 160,
              padding: '6px 10px',
              color: 'var(--nd-text-muted)',
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            {prop.name}
          </span>
          <div style={{ flex: 1 }}>
            <CellEditor
              prop={prop}
              valueJson={row.values[prop.id]}
              onSave={async (vj) => {
                await dbApi.setRecordValue(recordPageId, prop.id, vj);
                await load();
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
