/**
 * Portada de página: degradado propio o una imagen del propio espacio.
 *
 * Los colores son degradados resueltos en CSS (`--nd-cover-*`), no imágenes
 * empaquetadas: no engordan el instalador y no hay nada que descargar. Las
 * imágenes pasan por el sistema de adjuntos ya existente, así que se copian
 * dentro del espacio y viajan con él.
 */
import { useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { ImagePlus, Trash2 } from 'lucide-react';

import { attachmentsApi } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { Modal } from './ui';

/** Debe coincidir con `pages::COVER_PRESETS` del backend. */
export const COVER_PRESETS = [
  'arena',
  'salvia',
  'niebla',
  'tinta',
  'cobre',
  'musgo',
  'ciruela',
  'brasa',
] as const;

const NOMBRES: Record<string, string> = {
  arena: 'Arena',
  salvia: 'Salvia',
  niebla: 'Niebla',
  tinta: 'Tinta',
  cobre: 'Cobre',
  musgo: 'Musgo',
  ciruela: 'Ciruela',
  brasa: 'Brasa',
};

export function PageCover({
  kind,
  value,
  onEdit,
}: {
  kind: string | null;
  value: string | null;
  onEdit: () => void;
}) {
  if (!kind) return null;
  const style =
    kind === 'attachment' && value
      ? { backgroundImage: `url("${attachmentsApi.resolveUrl(value)}")`, backgroundSize: 'cover' }
      : undefined;
  return (
    <div
      className={`nd-page-cover${kind === 'color' && value ? ` nd-cover--${value}` : ''}`}
      style={style}
    >
      <button className="nd-cover-edit" onClick={onEdit}>
        Cambiar portada
      </button>
    </div>
  );
}

export function CoverPicker({
  onPick,
  onRemove,
  onClose,
}: {
  onPick: (kind: 'color' | 'attachment', value: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const { notifyError } = useAppStore();
  const [busy, setBusy] = useState(false);

  const subirImagen = async () => {
    const file = await openDialog({
      title: 'Imagen de portada',
      filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    });
    if (typeof file !== 'string') return;
    setBusy(true);
    try {
      const info = await attachmentsApi.importFromPath(file);
      onPick('attachment', info.id);
    } catch (e) {
      notifyError(e, 'No se pudo usar esa imagen como portada');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Portada de la página"
      onClose={onClose}
      footer={
        <>
          <button className="nd-btn nd-btn--ghost" onClick={onRemove}>
            <Trash2 size={15} style={{ verticalAlign: -2 }} /> Quitar portada
          </button>
          <button className="nd-btn nd-btn--ghost" onClick={onClose}>
            Cerrar
          </button>
        </>
      }
    >
      <div className="nd-side-label" style={{ padding: '0 0 6px' }}>
        Colores
      </div>
      <div className="nd-cover-grid">
        {COVER_PRESETS.map((preset) => (
          <button
            key={preset}
            className={`nd-cover-swatch nd-cover--${preset}`}
            aria-label={`Portada ${NOMBRES[preset] ?? preset}`}
            onClick={() => onPick('color', preset)}
          />
        ))}
      </div>

      <div className="nd-side-label" style={{ padding: '14px 0 6px' }}>
        Imagen propia
      </div>
      <button className="nd-btn nd-btn--ghost" disabled={busy} onClick={() => void subirImagen()}>
        <ImagePlus size={15} style={{ verticalAlign: -2 }} />{' '}
        {busy ? 'Importando…' : 'Elegir una imagen…'}
      </button>
      <p style={{ fontSize: 12, color: 'var(--nd-text-muted)', marginTop: 8 }}>
        La imagen se copia dentro de la carpeta del espacio, así que sigue funcionando sin conexión
        y viaja con tus respaldos.
      </p>
    </Modal>
  );
}
