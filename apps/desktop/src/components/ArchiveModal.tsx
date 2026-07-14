/** Archivo: restaurar o eliminar definitivamente páginas archivadas (F3.5). */
import { useCallback, useEffect, useState } from 'react';
import type { PageSummary } from '@nodora/shared';

import { pagesApi } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { Modal } from './ui';

export function ArchiveModal({ onClose }: { onClose: () => void }) {
  const { refreshTree, notifyError, toast } = useAppStore();
  const [items, setItems] = useState<PageSummary[] | null>(null);

  const load = useCallback(() => {
    pagesApi
      .listArchived()
      .then(setItems)
      .catch((e) => notifyError(e, 'No se pudo cargar el archivo'));
  }, [notifyError]);

  useEffect(() => load(), [load]);

  const restore = async (id: string) => {
    try {
      await pagesApi.restore(id);
      await refreshTree();
      load();
      toast('Página restaurada');
    } catch (e) {
      notifyError(e, 'No se pudo restaurar');
    }
  };

  const remove = async (p: PageSummary) => {
    const ok = window.confirm(
      `Eliminar definitivamente «${p.title || 'Sin título'}» y todas sus subpáginas.\n\nEsta acción no se puede deshacer. ¿Continuar?`,
    );
    if (!ok) return;
    try {
      const n = await pagesApi.deletePermanently(p.id);
      toast(`${n} página(s) eliminada(s) definitivamente`);
      await refreshTree();
      load();
    } catch (e) {
      notifyError(e, 'No se pudo eliminar');
    }
  };

  return (
    <Modal title="Archivo" onClose={onClose}>
      {items === null && <div className="nd-spinner" aria-label="Cargando" />}
      {items?.length === 0 && (
        <p style={{ color: 'var(--nd-text-muted)' }}>No hay páginas archivadas.</p>
      )}
      {items?.map((p) => (
        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {p.icon ? `${p.icon} ` : '📄 '}
            {p.title || 'Sin título'}
          </span>
          <button className="nd-btn nd-btn--ghost" onClick={() => void restore(p.id)}>
            Restaurar
          </button>
          <button className="nd-btn nd-btn--danger" onClick={() => void remove(p)}>
            Eliminar
          </button>
        </div>
      ))}
    </Modal>
  );
}
