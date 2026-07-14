/**
 * Lista flotante minimalista para menús de sugerencia (/ y @).
 * Sin dependencias externas: div posicionado junto al caret, navegable con
 * teclado y accesible (role=listbox).
 */

export interface FloatingItem {
  id: string;
  label: string;
  hint?: string;
}

export class FloatingList<T extends FloatingItem> {
  private el: HTMLDivElement;
  private items: T[] = [];
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
    this.items = items;
    this.selected = Math.min(this.selected, Math.max(0, items.length - 1));
    this.render();
    if (rect) {
      this.el.style.display = items.length ? 'block' : 'none';
      const menuH = Math.min(320, items.length * 34 + 12);
      const below = rect.bottom + 6;
      const top = below + menuH > window.innerHeight ? Math.max(8, rect.top - menuH - 6) : below;
      this.el.style.top = `${top}px`;
      this.el.style.left = `${Math.min(rect.left, window.innerWidth - 280)}px`;
    }
  }

  private render() {
    this.el.innerHTML = '';
    this.items.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'nd-floating-item' + (i === this.selected ? ' nd-floating-item--active' : '');
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', String(i === this.selected));
      const label = document.createElement('span');
      label.textContent = item.label;
      row.appendChild(label);
      if (item.hint) {
        const hint = document.createElement('span');
        hint.className = 'nd-floating-hint';
        hint.textContent = item.hint;
        row.appendChild(hint);
      }
      row.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.onPick(item);
      });
      row.addEventListener('mouseenter', () => {
        this.selected = i;
        this.render();
      });
      this.el.appendChild(row);
    });
  }

  onKeyDown(key: string): boolean {
    if (!this.items.length) return false;
    if (key === 'ArrowDown') {
      this.selected = (this.selected + 1) % this.items.length;
      this.render();
      return true;
    }
    if (key === 'ArrowUp') {
      this.selected = (this.selected - 1 + this.items.length) % this.items.length;
      this.render();
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
