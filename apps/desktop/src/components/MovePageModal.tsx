/** Diálogo "Mover a…" con buscador de destino (F3). */
import { useEffect, useState } from 'react';
import type { PageSummary } from '@nodora/shared';

import { pagesApi } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { Modal } from './ui';

export function MovePageModal({ page, onClose }: { page: PageSummary; onClose: () => void }) {
  const { refreshTree, notifyError, toast } = useAppStore();
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<PageSummary[]>([]);

  useEffect(() => {
    let alive = true;
    void pagesApi.linkable(query, 30).then((res) => {
      if (!alive) return;
      setCandidates(
        res.filter((c) => c.id !== page.id && c.kind !== 'record' && c.kind !== 'database'),
      );
    });
    return () => {
      alive = false;
    };
  }, [query, page.id]);

  const move = async (newParent: string | null) => {
    try {
      await pagesApi.move(page.id, newParent, null);
      await refreshTree();
      toast('Página movida');
      onClose();
    } catch (e) {
      notifyError(e, 'No se pudo mover (¿destino dentro de la propia página?)');
    }
  };

  return (
    <Modal title={`Mover «${page.title || 'Sin título'}» a…`} onClose={onClose}>
      <input
        className="nd-input"
        placeholder="Buscar página destino…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      <div style={{ marginTop: 8, maxHeight: 260, overflowY: 'auto' }}>
        <button className="nd-palette-item" onClick={() => void move(null)}>
          🏠 Raíz del espacio
        </button>
        {candidates.map((c) => (
          <button key={c.id} className="nd-palette-item" onClick={() => void move(c.id)}>
            {c.icon ? `${c.icon} ` : '📄 '}
            {c.title || 'Sin título'}
          </button>
        ))}
      </div>
    </Modal>
  );
}
