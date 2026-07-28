/** Cabecera del workspace: renombrar, icono, tema, export, respaldos, archivo. */
import { useState } from 'react';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import {
  Archive,
  ChevronDown,
  LayoutGrid,
  Download,
  FolderOpen,
  Moon,
  Package,
  RefreshCcw,
  Sun,
  Trash2,
} from 'lucide-react';

import { attachmentsApi, exportApi, workspaceApi } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { ArchiveModal } from './ArchiveModal';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { ContextMenu, Modal, type MenuItem } from './ui';

export function WorkspaceMenu() {
  const { workspace, theme, setTheme, setWorkspace, navigate, notifyError, toast } = useAppStore();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');

  if (!workspace) return null;

  const exportJson = async () => {
    const dest = await saveDialog({
      title: 'Exportar espacio completo a JSON',
      defaultPath: `nodora-export-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (!dest) return;
    try {
      await exportApi.workspaceJson(dest);
      toast('Exportación JSON completada');
    } catch (e) {
      notifyError(e, 'No se pudo exportar');
    }
  };

  const createBackup = async () => {
    const dir = await openDialog({ directory: true, title: 'Carpeta donde guardar el respaldo' });
    try {
      const path = await exportApi.createBackup(typeof dir === 'string' ? dir : null);
      toast(`Respaldo creado: ${path}`);
    } catch (e) {
      notifyError(e, 'No se pudo crear el respaldo');
    }
  };

  const restoreBackup = async () => {
    const zip = await openDialog({
      title: 'Selecciona un respaldo de Nodora',
      filters: [{ name: 'Respaldo Nodora', extensions: ['zip'] }],
    });
    if (typeof zip !== 'string') return;
    try {
      const summary = await exportApi.validateBackup(zip);
      const ok = window.confirm(
        `Respaldo válido:\n\n· Espacio: ${summary.workspaceName}\n· Páginas: ${summary.pageCount}\n· Adjuntos: ${summary.attachmentCount}\n· Creado: ${summary.createdAt}\n\nSe restaurará como un espacio NUEVO (el actual no se toca). ¿Continuar?`,
      );
      if (!ok) return;
      const path = await exportApi.restoreBackup(zip, null);
      const ws = await workspaceApi.open(path);
      await setWorkspace(ws);
      const pages = useAppStore.getState().pages;
      if (pages[0]) await navigate(pages[0].id);
      toast('Respaldo restaurado y abierto');
    } catch (e) {
      notifyError(e, 'El respaldo no es válido');
    }
  };

  const liberarEspacio = async () => {
    try {
      const previo = await attachmentsApi.collectUnreferenced(true);
      if (previo.unreferenced === 0) {
        toast(
          previo.orphanFiles > 0
            ? `No hay adjuntos que liberar. Hay ${previo.orphanFiles} archivo(s) no registrado(s), que no se tocan.`
            : 'No hay adjuntos sin usar: nada que liberar.',
        );
        return;
      }
      const mb = (previo.bytesFreed / (1024 * 1024)).toFixed(2);
      const ok = window.confirm(
        `Se eliminarán ${previo.unreferenced} adjunto(s) que ninguna página usa ya y se recuperarán ${mb} MB.\n\nLas imágenes que sigan insertadas en alguna página no se tocan. Esta acción no se puede deshacer: crea un respaldo antes si tienes dudas.\n\n¿Continuar?`,
      );
      if (!ok) return;
      const hecho = await attachmentsApi.collectUnreferenced(false);
      toast(`Liberados ${hecho.unreferenced} adjunto(s) (${mb} MB).`);
    } catch (e) {
      notifyError(e, 'No se pudo liberar espacio');
    }
  };

  const items: MenuItem[] = [
    {
      label: 'Espacios de trabajo…',
      icon: <LayoutGrid size={15} />,
      onClick: () => setSwitcherOpen(true),
    },
    {
      label: 'Renombrar espacio…',
      icon: <RefreshCcw size={15} />,
      onClick: () => {
        setName(workspace.name);
        setIcon(workspace.icon ?? '');
        setRenaming(true);
      },
    },
    {
      label: theme === 'dark' ? 'Tema claro' : 'Tema oscuro',
      icon: theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />,
      onClick: () => void setTheme(theme === 'dark' ? 'light' : 'dark'),
    },
    { label: '', separator: true },
    {
      label: 'Archivo (páginas archivadas)…',
      icon: <Archive size={15} />,
      onClick: () => setArchiveOpen(true),
    },
    { label: '', separator: true },
    {
      label: 'Exportar todo a JSON…',
      icon: <Download size={15} />,
      onClick: () => void exportJson(),
    },
    { label: 'Crear respaldo…', icon: <Package size={15} />, onClick: () => void createBackup() },
    {
      label: 'Liberar espacio…',
      icon: <Trash2 size={15} />,
      onClick: () => void liberarEspacio(),
    },
    {
      label: 'Restaurar respaldo…',
      icon: <FolderOpen size={15} />,
      onClick: () => void restoreBackup(),
    },
  ];

  const saveRename = async () => {
    try {
      if (name.trim() && name.trim() !== workspace.name) await workspaceApi.rename(name.trim());
      const newIcon = icon.trim() || null;
      if (newIcon !== workspace.icon) await workspaceApi.setIcon(newIcon);
      const ws = await workspaceApi.current();
      if (ws) useAppStore.setState({ workspace: ws });
      setRenaming(false);
    } catch (e) {
      notifyError(e, 'No se pudo renombrar');
    }
  };

  return (
    <>
      <button
        className="nd-ws-header"
        style={{ width: '100%', textAlign: 'left' }}
        onClick={(e) => setMenu({ x: e.clientX, y: e.clientY })}
        aria-haspopup="menu"
      >
        <span className="nd-ws-icon">{workspace.icon ?? workspace.name[0]?.toUpperCase()}</span>
        <span className="nd-ws-name">{workspace.name}</span>
        <ChevronDown size={14} style={{ color: 'var(--nd-text-muted)' }} />
      </button>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={items} onClose={() => setMenu(null)} />}
      {renaming && (
        <Modal
          title="Espacio de trabajo"
          onClose={() => setRenaming(false)}
          footer={
            <>
              <button className="nd-btn nd-btn--ghost" onClick={() => setRenaming(false)}>
                Cancelar
              </button>
              <button className="nd-btn nd-btn--primary" onClick={() => void saveRename()}>
                Guardar
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="nd-input"
              style={{ width: 56, textAlign: 'center' }}
              value={icon}
              maxLength={4}
              aria-label="Icono"
              onChange={(e) => setIcon(e.target.value)}
            />
            <input
              className="nd-input"
              value={name}
              aria-label="Nombre del espacio"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void saveRename()}
            />
          </div>
        </Modal>
      )}
      {archiveOpen && <ArchiveModal onClose={() => setArchiveOpen(false)} />}
      {switcherOpen && <WorkspaceSwitcher onClose={() => setSwitcherOpen(false)} />}
    </>
  );
}
