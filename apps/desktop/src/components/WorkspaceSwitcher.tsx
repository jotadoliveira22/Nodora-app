/**
 * Gestor de espacios de trabajo: crear uno nuevo, cambiar a otro conocido o
 * abrir una carpeta existente sin salir de la aplicación (PRD R1.1/R1.5).
 *
 * Antes solo se podía crear un espacio en el primer arranque: una vez había
 * uno abierto, la pantalla de bienvenida ya no volvía a aparecer.
 */
import { useEffect, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { FolderOpen, Plus } from 'lucide-react';
import type { KnownWorkspace } from '@nodora/shared';

import { workspaceApi } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { Modal } from './ui';

export function WorkspaceSwitcher({ onClose }: { onClose: () => void }) {
  const { workspace, setWorkspace, navigate, notifyError, toast } = useAppStore();
  const [known, setKnown] = useState<KnownWorkspace[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🗂️');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    workspaceApi
      .listKnown()
      .then(setKnown)
      .catch((e) => notifyError(e, 'No se pudieron listar los espacios'));
  }, [notifyError]);

  /** Deja abierto el espacio indicado y navega a su primera página. */
  const activar = async (abrir: () => Promise<{ id: string; name: string }>) => {
    setBusy(true);
    try {
      const ws = await abrir();
      await setWorkspace(ws as Parameters<typeof setWorkspace>[0]);
      const pages = useAppStore.getState().pages;
      const primera = pages[0];
      if (primera) await navigate(primera.id);
      toast(`Espacio «${ws.name}» abierto`);
      onClose();
    } catch (e) {
      notifyError(e, 'No se pudo abrir el espacio');
    } finally {
      setBusy(false);
    }
  };

  const crear = async () => {
    if (!name.trim() || busy) return;
    await activar(() => workspaceApi.create(name.trim(), icon || null));
  };

  const abrirCarpeta = async () => {
    const dir = await openDialog({ directory: true, title: 'Abrir carpeta de espacio Nodora' });
    if (typeof dir !== 'string') return;
    await activar(() => workspaceApi.open(dir));
  };

  const otros = known.filter((k) => k.path !== workspace?.path);

  return (
    <Modal
      title="Espacios de trabajo"
      onClose={onClose}
      footer={
        <>
          <button className="nd-btn nd-btn--ghost" onClick={() => void abrirCarpeta()}>
            <FolderOpen size={15} style={{ verticalAlign: -2 }} /> Abrir carpeta…
          </button>
          <button className="nd-btn nd-btn--ghost" onClick={onClose}>
            Cerrar
          </button>
        </>
      }
    >
      {workspace && (
        <>
          <div className="nd-side-label" style={{ padding: '0 0 4px' }}>
            Espacio actual
          </div>
          <div className="nd-ws-list-item" style={{ marginTop: 0, cursor: 'default' }}>
            <span className="nd-ws-icon">{workspace.icon ?? workspace.name[0]?.toUpperCase()}</span>
            <span style={{ flex: 1, overflow: 'hidden' }}>
              <strong>{workspace.name}</strong>
              <div style={{ fontSize: 11, color: 'var(--nd-text-muted)' }}>{workspace.path}</div>
            </span>
          </div>
        </>
      )}

      {otros.length > 0 && (
        <>
          <div className="nd-side-label" style={{ padding: '14px 0 4px' }}>
            Cambiar a
          </div>
          {otros.map((k) => (
            <button
              key={k.path}
              className="nd-ws-list-item"
              disabled={busy}
              onClick={() => void activar(() => workspaceApi.open(k.path))}
            >
              <span className="nd-ws-icon">🗂️</span>
              <span style={{ flex: 1, overflow: 'hidden' }}>
                {k.name}
                <div style={{ fontSize: 11, color: 'var(--nd-text-muted)' }}>{k.path}</div>
              </span>
            </button>
          ))}
        </>
      )}

      <div className="nd-side-label" style={{ padding: '14px 0 4px' }}>
        Crear un espacio nuevo
      </div>
      {creating ? (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="nd-input"
              style={{ width: 56, textAlign: 'center' }}
              value={icon}
              maxLength={4}
              aria-label="Icono del espacio nuevo"
              onChange={(e) => setIcon(e.target.value)}
            />
            <input
              className="nd-input"
              placeholder="Nombre del espacio"
              aria-label="Nombre del espacio nuevo"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void crear()}
            />
          </div>
          <button
            className="nd-btn nd-btn--primary"
            style={{ width: '100%', marginTop: 10 }}
            disabled={!name.trim() || busy}
            onClick={() => void crear()}
          >
            {busy ? 'Creando…' : 'Crear y abrir'}
          </button>
        </>
      ) : (
        <button className="nd-ws-list-item" onClick={() => setCreating(true)}>
          <span className="nd-ws-icon">
            <Plus size={15} />
          </span>
          <span style={{ flex: 1 }}>Espacio nuevo…</span>
        </button>
      )}
    </Modal>
  );
}
