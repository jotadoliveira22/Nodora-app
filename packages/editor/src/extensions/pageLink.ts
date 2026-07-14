/**
 * pageLink: enlace interno a otra página, referenciado por ID (sobrevive a
 * renombrados, PRD R7.3). El título se resuelve al renderizar mediante el
 * callback resolvePageTitle del host.
 */
import { mergeAttributes, Node } from '@tiptap/core';

export interface PageLinkOptions {
  /** Devuelve el título actual de la página (o null si no existe). */
  resolvePageTitle: (pageId: string) => string | null;
  /** Navegación al hacer clic. */
  onNavigate: (pageId: string) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageLink: {
      insertPageLink: (pageId: string) => ReturnType;
    };
  }
}

export const PageLink = Node.create<PageLinkOptions>({
  name: 'pageLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return {
      resolvePageTitle: () => null,
      onNavigate: () => undefined,
    };
  },

  addAttributes() {
    return {
      pageId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-page-id'),
        renderHTML: (attrs: { pageId?: string | null }) =>
          attrs.pageId ? { 'data-page-id': attrs.pageId } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-nodora-page-link]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const pageId = (node.attrs['pageId'] as string | null) ?? '';
    const title = this.options.resolvePageTitle(pageId) ?? 'página eliminada';
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-nodora-page-link': '',
        class: 'nd-page-link',
        role: 'link',
        tabindex: '0',
      }),
      `↗ ${title}`,
    ];
  },

  addCommands() {
    return {
      insertPageLink:
        (pageId: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { pageId } }),
    };
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.className = 'nd-page-link';
      dom.setAttribute('data-nodora-page-link', '');
      dom.setAttribute('role', 'link');
      dom.tabIndex = 0;
      const pageId = (node.attrs['pageId'] as string | null) ?? '';
      const title = this.options.resolvePageTitle(pageId);
      dom.textContent = `↗ ${title ?? 'página'}`;
      if (title === null) dom.classList.add('nd-page-link--missing');
      const navigate = (e: Event) => {
        e.preventDefault();
        if (pageId) this.options.onNavigate(pageId);
      };
      dom.addEventListener('click', navigate);
      dom.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') navigate(e);
      });
      return { dom };
    };
  },
});
