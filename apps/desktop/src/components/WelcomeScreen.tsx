/** F1/F2: primer arranque, crear espacio, abrir existente o restaurar respaldo. */
import { useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

import { exportApi, workspaceApi } from '../services/api';
import { useAppStore } from '../stores/appStore';

export function WelcomeScreen() {
  const { knownWorkspaces, setWorkspace, navigate, notifyError, toast } = useAppStore();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🗂️');
  const [busy, setBusy] = useState(false);

  const createWs = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const ws = await workspaceApi.create(name.trim(), icon || null);
      await setWorkspace(ws);
      const pages = useAppStore.getState().pages;
      if (pages[0]) await navigate(pages[0].id);
    } catch (e) {
      notifyError(e, 'No se pudo crear el espacio');
    } finally {
      setBusy(false);
    }
  };

  const openExisting = async (path: string) => {
    setBusy(true);
    try {
      const ws = await workspaceApi.open(path);
      await setWorkspace(ws);
      const pages = useAppStore.getState().pages;
      if (pages[0]) await navigate(pages[0].id);
    } catch (e) {
      notifyError(e, 'No se pudo abrir el espacio (¿carpeta movida?)');
    } finally {
      setBusy(false);
    }
  };

  const openFolder = async () => {
    const dir = await openDialog({ directory: true, title: 'Abrir carpeta de espacio Nodora' });
    if (typeof dir === 'string') await openExisting(dir);
  };

  const restoreBackup = async () => {
    const zip = await openDialog({
      title: 'Selecciona un respaldo de Nodora',
      filters: [{ name: 'Respaldo Nodora', extensions: ['zip'] }],
    });
    if (typeof zip !== 'string') return;
    setBusy(true);
    try {
      const summary = await exportApi.validateBackup(zip);
      const ok = window.confirm(
        `Respaldo válido:\n\n· Espacio: ${summary.workspaceName}\n· Páginas: ${summary.pageCount}\n· Adjuntos: ${summary.attachmentCount}\n· Creado: ${summary.createdAt}\n\n¿Restaurar como espacio nuevo?`,
      );
      if (!ok) return;
      const path = await exportApi.restoreBackup(zip, null);
      toast('Respaldo restaurado correctamente');
      await openExisting(path);
    } catch (e) {
      notifyError(e, 'El respaldo no es válido');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="nd-welcome">
      <div className="nd-welcome-card">
        <div className="nd-welcome-logo" aria-hidden>
          N
        </div>
        <h1 style={{ margin: '0 0 4px', fontSize: 22 }}>Nodora</h1>
        <p style={{ color: 'var(--nd-text-muted)', margin: '0 0 20px' }}>
          Tu espacio de trabajo privado. Todo se guarda en este equipo.
        </p>

        <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
          Crear un espacio nuevo
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="nd-input"
            style={{ width: 52, textAlign: 'center' }}
            value={icon}
            maxLength={4}
            aria-label="Icono del espacio"
            onChange={(e) => setIcon(e.target.value)}
          />
          <input
            className="nd-input"
            placeholder="Nombre del espacio (p. ej. Mi Consultora)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void createWs()}
          />
        </div>
        <button
          className="nd-btn nd-btn--primary"
          style={{ width: '100%', marginTop: 10 }}
          disabled={!name.trim() || busy}
          onClick={() => void createWs()}
        >
          {busy ? 'Creando…' : 'Crear espacio'}
        </button>

        {knownWorkspaces.length > 0 && (
          <>
            <div style={{ fontWeight: 600, marginTop: 24, marginBottom: 4 }}>
              Espacios recientes
            </div>
            {knownWorkspaces.slice(0, 5).map((w) => (
              <button
                key={w.path}
                className="nd-ws-list-item"
                onClick={() => void openExisting(w.path)}
              >
                <span className="nd-ws-icon">🗂️</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {w.name}
                  <div style={{ fontSize: 11, color: 'var(--nd-text-muted)' }}>{w.path}</div>
                </span>
              </button>
            ))}
          </>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button
            className="nd-btn nd-btn--ghost"
            style={{ flex: 1 }}
            onClick={() => void openFolder()}
          >
            Abrir carpeta…
          </button>
          <button
            className="nd-btn nd-btn--ghost"
            style={{ flex: 1 }}
            onClick={() => void restoreBackup()}
          >
            Restaurar respaldo…
          </button>
        </div>
      </div>
    </div>
  );
}
