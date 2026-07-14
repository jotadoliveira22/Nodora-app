/**
 * blockId: identificador UUID estable por bloque de nivel superior.
 * Es el seguro de vida para la futura migración a operaciones por bloque /
 * CRDT (ADR-005): el backend lo persiste dentro del documento.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

const TOP_LEVEL_TYPES = [
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'taskList',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'callout',
  'image',
  'subpage',
];

function newBlockId(): string {
  return crypto.randomUUID();
}

export const BlockId = Extension.create({
  name: 'blockId',

  addGlobalAttributes() {
    return [
      {
        types: TOP_LEVEL_TYPES,
        attributes: {
          blockId: {
            default: null,
            keepOnSplit: false,
            parseHTML: (el: HTMLElement) => el.getAttribute('data-block-id'),
            renderHTML: (attrs: { blockId?: string | null }) =>
              attrs.blockId ? { 'data-block-id': attrs.blockId } : {},
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('nodora-block-id'),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const tr = newState.tr;
          const seen = new Set<string>();
          let changed = false;
          newState.doc.forEach((node, offset) => {
            const id = node.attrs['blockId'] as string | null | undefined;
            if (node.type.name === 'text') return;
            if (!id || seen.has(id)) {
              if (node.type.spec.attrs && 'blockId' in node.type.spec.attrs) {
                tr.setNodeMarkup(offset, undefined, { ...node.attrs, blockId: newBlockId() });
                changed = true;
              }
            } else {
              seen.add(id);
            }
          });
          return changed ? tr : null;
        },
      }),
    ];
  },
});
