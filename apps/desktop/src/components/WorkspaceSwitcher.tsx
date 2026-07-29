/**
 * Panel de espacios de trabajo (PRD R1.1/R1.5, docs/UX_IMPROVEMENTS_PLAN.md §1.2).
 *
 * Tres bloques: identidad del espacio actual con lo que contiene, la lista de
 * espacios conocidos con sus acciones, y las formas de sumar uno nuevo.
 *
 * Eliminar es dos acciones distintas a propósito: «Quitar de la lista» no toca
 * el disco y se deshace con «Abrir carpeta…»; «Eliminar del disco» es
 * irreversible y exige escribir el nombre del espacio.
 */
import { useCallback, useEffect, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Check, EyeOff, FolderOpen, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import type { KnownWorkspace, WorkspaceStats } from '@nodora/shared';

import { exportApi, workspaceApi } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { ContextMenu, Modal, type MenuItem } from './ui';

/** Tamaño legible; el dato importa cuando se está a punto de perderlo. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function describe(stats: WorkspaceStats | undefined): string {
  if (!stats) return '';
  const pags = `${stats.pageCount} página${stats.pageCount === 1 ? '' : 's'}`;
  const adj = stats.attachmentCount > 0 ? ` · ${stats.attachmentCount} adjunto(s)` : '';
  return `${pags}${adj} · ${formatBytes(stats.bytesOnDisk)}`;
}

export function WorkspaceSwitcher({ onClose }: { onClose: () => void }) {
  const { workspace, setWorkspace, navigate, notifyError, toast } = useAppStore();
  const [known, setKnown] = useState<KnownWorkspace[]>([]);
  const [stats, setStats] = useState<Record<string, WorkspaceStats>>({});
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🗂️');
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; ws: KnownWorkspace } | null>(null);
  const [deleting, setDeleting] = useState<KnownWorkspace | null>(null);

  const cargar = useCallback(async () => {
    try {
      const lista = await workspaceApi.listKnown();
      setKnown(lista);
      // Las estadísticas se leen por espacio y no bloquean la lista: si una
      // carpeta se movió o se borró fuera de Nodora, esa fila queda sin datos
      // en vez de romper el panel entero.
      const pares = await Promise.all(
        lista.map(async (k) => {
          try {
            return [k.path, await workspaceApi.stats(k.path)] as const;
          } catch {
            return null;
          }
        }),
      );
      setStats(Object.fromEntries(pares.filter((p) => p !== null)));
    } catch (e) {
      notifyError(e, 'No se pudieron listar los espacios');
    }
  }, [notifyError]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

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

  const quitarDeLista = async (k: KnownWorkspace) => {
    try {
      await workspaceApi.forget(k.path);
      await cargar();
      toast(`«${k.name}» ya no aparece en la lista. Sus datos siguen en el disco.`);
    } catch (e) {
      notifyError(e, 'No se pudo quitar de la lista');
    }
  };

  const esActual = (k: KnownWorkspace) => k.path === workspace?.path;

  const acciones = (k: KnownWorkspace): MenuItem[] => [
    {
      label: 'Quitar de la lista',
      icon: <EyeOff size={15} />,
      onClick: () => void quitarDeLista(k),
    },
    {
      label: 'Eliminar del disco…',
      icon: <Trash2 size={15} />,
      danger: true,
      onClick: () => setDeleting(k),
    },
  ];

  const fila = (k: KnownWorkspace, actual: boolean) => (
    <div key={k.path} className="nd-ws-row">
      {/* Nombre accesible explícito: cada fila tiene dos botones y «abrir» y
          «acciones» deben poder distinguirse sin ambigüedad. */}
      <button
        className="nd-ws-list-item"
        disabled={busy || actual}
        aria-current={actual ? 'true' : undefined}
        aria-label={actual ? `${k.name} (espacio actual)` : `Abrir ${k.name}`}
        onClick={() => void activar(() => workspaceApi.open(k.path))}
      >
        <span className="nd-ws-icon">{actual ? (workspace?.icon ?? '🗂️') : '🗂️'}</span>
        <span style={{ flex: 1, overflow: 'hidden' }}>
          {actual ? <strong>{k.name}</strong> : k.name}
          <div style={{ fontSize: 11, color: 'var(--nd-text-muted)' }}>
            {describe(stats[k.path]) || k.path}
          </div>
        </span>
        {actual && <Check size={15} aria-label="Espacio actual" />}
      </button>
      <button
        className="nd-icon-btn"
        aria-label={`Acciones de ${k.name}`}
        onClick={(e) => setMenu({ x: e.clientX, y: e.clientY, ws: k })}
      >
        <MoreHorizontal size={15} />
      </button>
    </div>
  );

  const actual = known.find(esActual);
  const otros = known.filter((k) => !esActual(k));

  return (
    <>
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
            {actual ? (
              fila(actual, true)
            ) : (
              <div className="nd-ws-list-item" style={{ marginTop: 0, cursor: 'default' }}>
                <span className="nd-ws-icon">
                  {workspace.icon ?? workspace.name[0]?.toUpperCase()}
                </span>
                <span style={{ flex: 1, overflow: 'hidden' }}>
                  <strong>{workspace.name}</strong>
                  <div style={{ fontSize: 11, color: 'var(--nd-text-muted)' }}>
                    {workspace.path}
                  </div>
                </span>
              </div>
            )}
          </>
        )}

        {otros.length > 0 && (
          <>
            <div className="nd-side-label" style={{ padding: '14px 0 4px' }}>
              Otros espacios
            </div>
            {otros.map((k) => fila(k, false))}
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

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={acciones(menu.ws)}
          onClose={() => setMenu(null)}
        />
      )}

      {deleting && (
        <DeleteWorkspaceDialog
          target={deleting}
          stats={stats[deleting.path]}
          isCurrent={esActual(deleting)}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            void cargar();
          }}
        />
      )}
    </>
  );
}

/**
 * Confirmación de un borrado sin vuelta atrás. Pide escribir el nombre exacto
 * del espacio: un solo clic es demasiado barato para lo que cuesta el error.
 */
function DeleteWorkspaceDialog({
  target,
  stats,
  isCurrent,
  onClose,
  onDeleted,
}: {
  target: KnownWorkspace;
  stats: WorkspaceStats | undefined;
  isCurrent: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { notifyError, toast } = useAppStore();
  const [confirmacion, setConfirmacion] = useState('');
  const [busy, setBusy] = useState(false);

  const puedeBorrar = !isCurrent && confirmacion.trim() === target.name && !busy;

  const respaldar = async () => {
    const dir = await openDialog({ directory: true, title: 'Carpeta donde guardar el respaldo' });
    if (typeof dir !== 'string') return;
    try {
      // Se respalda el espacio que se va a eliminar, no el que está abierto.
      const path = await exportApi.backupWorkspaceAt(target.path, dir);
      toast(`Respaldo creado: ${path}`);
    } catch (e) {
      notifyError(e, 'No se pudo crear el respaldo');
    }
  };

  const borrar = async () => {
    if (!puedeBorrar) return;
    setBusy(true);
    try {
      await workspaceApi.delete(target.path);
      toast(`Espacio «${target.name}» eliminado del disco`);
      onDeleted();
    } catch (e) {
      notifyError(e, 'No se pudo eliminar el espacio');
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Eliminar espacio del disco"
      onClose={onClose}
      footer={
        <>
          <button className="nd-btn nd-btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="nd-btn nd-btn--danger"
            disabled={!puedeBorrar}
            onClick={() => void borrar()}
          >
            {busy ? 'Eliminando…' : 'Eliminar definitivamente'}
          </button>
        </>
      }
    >
      {isCurrent ? (
        <p>
          <strong>{target.name}</strong> es el espacio abierto ahora mismo. Cambia a otro espacio
          antes de eliminarlo.
        </p>
      ) : (
        <>
          <p style={{ marginTop: 0 }}>
            Se eliminará del disco la carpeta completa de <strong>{target.name}</strong>: su base de
            datos, sus adjuntos y los respaldos que guardes dentro.
          </p>
          <p className="nd-danger-note">
            {stats
              ? `Perderás ${stats.pageCount} página(s) y ${stats.attachmentCount} adjunto(s), ${formatBytes(stats.bytesOnDisk)} en total.`
              : 'No se ha podido leer el contenido de este espacio.'}{' '}
            Esta acción no se puede deshacer.
          </p>
          <p style={{ fontSize: 12, color: 'var(--nd-text-muted)' }}>{target.path}</p>
          <button className="nd-btn nd-btn--ghost" onClick={() => void respaldar()}>
            Crear un respaldo antes
          </button>
          <label
            style={{ display: 'block', marginTop: 14, fontSize: 13 }}
            htmlFor="nd-confirm-delete"
          >
            Escribe <strong>{target.name}</strong> para confirmar:
          </label>
          <input
            id="nd-confirm-delete"
            className="nd-input"
            style={{ marginTop: 6 }}
            value={confirmacion}
            autoComplete="off"
            onChange={(e) => setConfirmacion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void borrar()}
          />
        </>
      )}
    </Modal>
  );
}
