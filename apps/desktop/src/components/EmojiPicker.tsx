/**
 * Selector de emoji para iconos de página y de espacio.
 *
 * Sustituye al `window.prompt()` que había antes. La lista está embebida y es
 * corta a propósito: cubre lo que se usa para etiquetar páginas sin arrastrar
 * una dependencia de miles de emojis ni descargar nada (Nodora funciona sin
 * conexión). El campo de texto sigue admitiendo cualquier emoji pegado.
 */
import { useMemo, useState } from 'react';

import { Modal } from './ui';

// Los emojis van en lista, no en una cadena: varios llevan selector de
// variación (U+FE0F) y recorrer la cadena los partiría por la mitad.
const CATEGORIAS: { label: string; emojis: string[]; terms: string[] }[] = [
  {
    label: 'Trabajo',
    emojis: [
      '📄',
      '📝',
      '📌',
      '📎',
      '📊',
      '📈',
      '📉',
      '🗂️',
      '📁',
      '📅',
      '🗓️',
      '✅',
      '🎯',
      '🚀',
      '💼',
      '🏢',
      '🧾',
      '📋',
    ],
    terms: ['documento', 'nota', 'proyecto', 'tarea', 'oficina', 'informe', 'carpeta', 'agenda'],
  },
  {
    label: 'Comunicación',
    emojis: ['💬', '📣', '📢', '✉️', '📨', '📞', '🎥', '🎙️', '🔔', '🤝'],
    terms: ['reunión', 'mensaje', 'correo', 'llamada', 'grabación', 'aviso', 'cliente'],
  },
  {
    label: 'Ideas y estudio',
    emojis: ['💡', '🧠', '📚', '🎓', '🔍', '🧪', '🧭', '📐', '✏️', '🔖'],
    terms: ['idea', 'aprender', 'libro', 'clase', 'buscar', 'investigación', 'diseño'],
  },
  {
    label: 'Estado',
    emojis: ['⭐', '🔥', '⚠️', '🚧', '🟢', '🟡', '🔴', '⏳', '🏁', '❗'],
    terms: ['favorito', 'urgente', 'aviso', 'progreso', 'listo', 'pendiente', 'bloqueado'],
  },
  {
    label: 'Personal',
    emojis: ['🏠', '🌱', '🕯️', '🧘', '🍽️', '🎵', '🎨', '🧳', '💪', '🐾'],
    terms: ['casa', 'hábito', 'diario', 'salud', 'viaje', 'música', 'ocio'],
  },
  {
    label: 'Cosas',
    emojis: ['🔧', '⚙️', '🔒', '🔑', '💾', '🖥️', '📦', '🧩', '🗺️', '🏷️'],
    terms: ['herramienta', 'ajustes', 'seguridad', 'archivo', 'equipo', 'mapa', 'etiqueta'],
  },
];

export function EmojiPicker({
  current,
  title = 'Elegir un icono',
  onPick,
  onClose,
}: {
  current: string | null;
  title?: string;
  onPick: (emoji: string | null) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');

  const categorias = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATEGORIAS;
    return CATEGORIAS.filter(
      (c) => c.label.toLowerCase().includes(q) || c.terms.some((t) => t.includes(q)),
    );
  }, [query]);

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="nd-btn nd-btn--ghost" onClick={() => onPick(null)}>
            Quitar icono
          </button>
          <button className="nd-btn nd-btn--ghost" onClick={onClose}>
            Cancelar
          </button>
        </>
      }
    >
      <input
        className="nd-input"
        placeholder="Buscar por tema, o pega un emoji"
        aria-label="Buscar o escribir un icono"
        value={query}
        autoFocus
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          // Escribir o pegar un emoji cualquiera y pulsar Enter también vale:
          // la lista embebida no puede cubrirlos todos.
          if (e.key === 'Enter' && query.trim()) onPick(query.trim().slice(0, 8));
        }}
      />
      {current && (
        <p style={{ fontSize: 12, color: 'var(--nd-text-muted)', marginTop: 8 }}>
          Icono actual: <span style={{ fontSize: 16 }}>{current}</span>
        </p>
      )}

      <div className="nd-emoji-groups">
        {categorias.map((c) => (
          <section key={c.label}>
            <div className="nd-side-label" style={{ padding: '10px 0 4px' }}>
              {c.label}
            </div>
            <div className="nd-emoji-grid">
              {c.emojis.map((emoji) => (
                <button
                  key={emoji}
                  className="nd-emoji-btn"
                  aria-label={`Icono ${emoji}`}
                  onClick={() => onPick(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </section>
        ))}
        {!categorias.length && (
          <p style={{ color: 'var(--nd-text-muted)' }}>
            Sin coincidencias. Pega el emoji que quieras y pulsa Enter.
          </p>
        )}
      </div>
    </Modal>
  );
}
