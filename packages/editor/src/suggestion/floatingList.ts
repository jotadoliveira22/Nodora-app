/**
 * Lista flotante minimalista para menús de sugerencia (/ y @).
 * Sin dependencias externas: div posicionado junto al caret, navegable con
 * teclado y con el ratón, y accesible (role=listbox).
 */

export interface FloatingItem {
  id: string;
  label: string;
  hint?: string;
}

export class FloatingList<T extends FloatingItem> {
  private el: HTMLDivElement;
  private items: T[] = [];
  /** Filas ya construidas, para poder marcar la selección sin recrearlas. */
  private rows: HTMLDivElement[] = [];
  private selected = 0;
  private onPick: (item: T) => void;

  constructor(onPick: (item: T) => void) {
    this.onPick = onPick;
    this.el = document.createElement('div');
    this.el.className = 'nd-floating-menu';
    this.el.setAttribute('role', 'listbox');
    this.el.style.position = 'fixed';
    this.el.style.display = 'none';
    this.el.style.zIndex = '1000';
    document.body.appendChild(this.el);
  }

  update(items: T[], rect: DOMRect | null) {
    const sameItems =
      items.length === this.items.length && items.every((item, i) => item.id === this.items[i]?.id);
    this.items = items;
    this.selected = Math.min(this.selected, Math.max(0, items.length - 1));
    // Solo se reconstruye el DOM cuando cambia la lista: recrearlo en cada
    // interacción hacía que el elemento bajo el cursor desapareciera y el
    // clic no llegara nunca a completarse.
    if (sameItems) {
      this.paintSelection();
    } else {
      this.build();
    }
    if (rect) {
      this.el.style.display = items.length ? 'block' : 'none';
      const menuH = Math.min(320, items.length * 34 + 12);
      const below = rect.bottom + 6;
      const top = below + menuH > window.innerHeight ? Math.max(8, rect.top - menuH - 6) : below;
      this.el.style.top = `${top}px`;
      this.el.style.left = `${Math.min(rect.left, window.innerWidth - 280)}px`;
    }
  }

  /** Construye las filas una sola vez por cada lista de opciones. */
  private build() {
    this.el.innerHTML = '';
    this.rows = this.items.map((item, i) => {
      const row = document.createElement('div');
      row.className = 'nd-floating-item';
      row.setAttribute('role', 'option');
      const label = document.createElement('span');
      label.textContent = item.label;
      row.appendChild(label);
      if (item.hint) {
        const hint = document.createElement('span');
        hint.className = 'nd-floating-hint';
        hint.textContent = item.hint;
        row.appendChild(hint);
      }
      // mousedown, no click: se adelanta al blur del editor y así la
      // selección del documento sigue intacta al insertar el bloque.
      row.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.onPick(item);
      });
      row.addEventListener('mousemove', () => {
        if (this.selected !== i) {
          this.selected = i;
          this.paintSelection();
        }
      });
      this.el.appendChild(row);
      return row;
    });
    this.paintSelection();
  }

  /** Marca la fila activa sin tocar la estructura del DOM. */
  private paintSelection() {
    this.rows.forEach((row, i) => {
      const active = i === this.selected;
      row.classList.toggle('nd-floating-item--active', active);
      row.setAttribute('aria-selected', String(active));
    });
    const current = this.rows[this.selected];
    if (current) current.scrollIntoView({ block: 'nearest' });
  }

  onKeyDown(key: string): boolean {
    if (!this.items.length) return false;
    if (key === 'ArrowDown') {
      this.selected = (this.selected + 1) % this.items.length;
      this.paintSelection();
      return true;
    }
    if (key === 'ArrowUp') {
      this.selected = (this.selected - 1 + this.items.length) % this.items.length;
      this.paintSelection();
      return true;
    }
    if (key === 'Enter') {
      const item = this.items[this.selected];
      if (item) this.onPick(item);
      return true;
    }
    return false;
  }

  hide() {
    this.el.style.display = 'none';
  }

  destroy() {
    this.el.remove();
  }
}
