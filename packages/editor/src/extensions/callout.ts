/** Callout: bloque destacado con emoji, contenido propio de Nodora. */
import { mergeAttributes, Node } from '@tiptap/core';

export interface CalloutOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: () => ReturnType;
      toggleCallout: () => ReturnType;
    };
  }
}

export const Callout = Node.create<CalloutOptions>({
  name: 'callout',
  group: 'block',
  content: 'paragraph+',
  defining: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      emoji: {
        default: '💡',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-emoji') ?? '💡',
        renderHTML: (attrs: { emoji?: string }) => ({ 'data-emoji': attrs.emoji ?? '💡' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-nodora-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-nodora-callout': '',
        class: 'nd-callout',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setCallout:
        () =>
        ({ commands }) =>
          commands.wrapIn(this.name),
      toggleCallout:
        () =>
        ({ commands }) =>
          commands.toggleWrap(this.name),
    };
  },
});
