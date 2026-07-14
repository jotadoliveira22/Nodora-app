/**
 * Imagen adjunta: referencia attachment://<uuid>, nunca rutas del disco
 * (docs/DATA_MODEL.md §attachments). El host resuelve la URL renderizable y
 * el estado "adjunto faltante" (PRD R8.3).
 */
import { mergeAttributes, Node } from '@tiptap/core';

export interface AttachmentImageOptions {
  /** Devuelve una URL renderizable (asset:...) o null si falta el archivo. */
  resolveAttachmentUrl: (attachmentId: string) => Promise<string | null>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    attachmentImage: {
      insertAttachmentImage: (attachmentId: string, alt?: string) => ReturnType;
    };
  }
}

export const AttachmentImage = Node.create<AttachmentImageOptions>({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return { resolveAttachmentUrl: async () => null };
  },

  addAttributes() {
    return {
      attachmentId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-attachment-id'),
        renderHTML: (attrs: { attachmentId?: string | null }) =>
          attrs.attachmentId ? { 'data-attachment-id': attrs.attachmentId } : {},
      },
      alt: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-alt'),
        renderHTML: (attrs: { alt?: string | null }) =>
          attrs.alt ? { 'data-alt': attrs.alt } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'figure[data-nodora-image]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'figure',
      mergeAttributes(HTMLAttributes, { 'data-nodora-image': '', class: 'nd-image' }),
    ];
  },

  addCommands() {
    return {
      insertAttachmentImage:
        (attachmentId: string, alt?: string) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { attachmentId, alt: alt ?? null },
          }),
    };
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('figure');
      dom.className = 'nd-image';
      dom.setAttribute('data-nodora-image', '');
      const img = document.createElement('img');
      const fallback = document.createElement('div');
      fallback.className = 'nd-image-missing';
      fallback.textContent = '🖼️ Imagen no disponible (adjunto faltante)';
      fallback.style.display = 'none';
      img.alt = (node.attrs['alt'] as string | null) ?? '';
      img.draggable = false;
      dom.appendChild(img);
      dom.appendChild(fallback);
      const attachmentId = (node.attrs['attachmentId'] as string | null) ?? '';
      void this.options.resolveAttachmentUrl(attachmentId).then((url) => {
        if (url) {
          img.src = url;
        } else {
          img.style.display = 'none';
          fallback.style.display = 'block';
        }
      });
      img.addEventListener('error', () => {
        img.style.display = 'none';
        fallback.style.display = 'block';
      });
      return { dom };
    };
  },
});
