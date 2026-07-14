/** Subpágina embebida como bloque: navega a la página hija. */
import { mergeAttributes, Node } from '@tiptap/core';

export interface SubpageOptions {
  resolvePageTitle: (pageId: string) => string | null;
  onNavigate: (pageId: string) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    subpage: {
      insertSubpage: (pageId: string) => ReturnType;
    };
  }
}

export const Subpage = Node.create<SubpageOptions>({
  name: 'subpage',
  group: 'block',
  atom: true,

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
    return [{ tag: 'div[data-nodora-subpage]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-nodora-subpage': '', class: 'nd-subpage' }),
    ];
  },

  addCommands() {
    return {
      insertSubpage:
        (pageId: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { pageId } }),
    };
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.className = 'nd-subpage';
      dom.setAttribute('data-nodora-subpage', '');
      dom.setAttribute('role', 'link');
      dom.tabIndex = 0;
      const pageId = (node.attrs['pageId'] as string | null) ?? '';
      const title = this.options.resolvePageTitle(pageId);
      dom.textContent = `📄 ${title ?? 'página eliminada'}`;
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
