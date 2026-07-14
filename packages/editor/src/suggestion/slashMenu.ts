/** Menú de inserción con `/` (PRD R3.2). */
import { Extension, type Editor, type Range } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { type SuggestionProps, type SuggestionKeyDownProps } from '@tiptap/suggestion';

import { FloatingList, type FloatingItem } from './floatingList';
import type { EditorHostCallbacks } from '../types';

interface SlashItem extends FloatingItem {
  keywords: string;
  run: (editor: Editor, range: Range) => void;
}

function buildItems(host: EditorHostCallbacks): SlashItem[] {
  return [
    {
      id: 'paragraph',
      label: 'Texto',
      keywords: 'texto parrafo paragraph normal',
      run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run(),
    },
    {
      id: 'h1',
      label: 'Encabezado 1',
      keywords: 'encabezado titulo heading h1',
      run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 1 }).run(),
    },
    {
      id: 'h2',
      label: 'Encabezado 2',
      keywords: 'encabezado heading h2 subtitulo',
      run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 2 }).run(),
    },
    {
      id: 'h3',
      label: 'Encabezado 3',
      keywords: 'encabezado heading h3',
      run: (e, r) => e.chain().focus().deleteRange(r).setHeading({ level: 3 }).run(),
    },
    {
      id: 'bullet',
      label: 'Lista con viñetas',
      keywords: 'lista vinetas bullet ul',
      run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run(),
    },
    {
      id: 'ordered',
      label: 'Lista numerada',
      keywords: 'lista numerada ordered ol numeros',
      run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run(),
    },
    {
      id: 'task',
      label: 'Lista de tareas',
      keywords: 'tareas todo checklist checkbox',
      run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run(),
    },
    {
      id: 'quote',
      label: 'Cita',
      keywords: 'cita quote blockquote',
      run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run(),
    },
    {
      id: 'code',
      label: 'Código',
      keywords: 'codigo code bloque',
      run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run(),
    },
    {
      id: 'divider',
      label: 'Separador',
      keywords: 'separador divider hr linea',
      run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run(),
    },
    {
      id: 'callout',
      label: 'Callout',
      keywords: 'callout destacado aviso nota',
      run: (e, r) => e.chain().focus().deleteRange(r).toggleCallout().run(),
    },
    {
      id: 'image',
      label: 'Imagen',
      keywords: 'imagen image foto adjunto',
      run: (e, r) => {
        e.chain().focus().deleteRange(r).run();
        void host.onRequestImage().then((att) => {
          if (att) e.chain().focus().insertAttachmentImage(att.id, att.alt).run();
        });
      },
    },
    {
      id: 'pagelink',
      label: 'Enlace a página',
      keywords: 'enlace link pagina mencion referencia',
      run: (e, r) => {
        e.chain().focus().deleteRange(r).insertContent('@').run();
      },
    },
    {
      id: 'subpage',
      label: 'Subpágina',
      keywords: 'subpagina pagina hija nueva',
      run: (e, r) => {
        e.chain().focus().deleteRange(r).run();
        void host.onCreateSubpage().then((pageId) => {
          if (pageId) e.chain().focus().insertSubpage(pageId).run();
        });
      },
    },
  ];
}

export function SlashMenu(host: EditorHostCallbacks) {
  return Extension.create({
    name: 'slashMenu',
    addProseMirrorPlugins() {
      const editor = this.editor;
      return [
        Suggestion({
          editor,
          pluginKey: new PluginKey('nodora-slash'),
          char: '/',
          startOfLine: false,
          command: ({ range, props }) => {
            (props as SlashItem).run(editor, range);
          },
          items: ({ query }) => {
            const q = query.toLowerCase();
            return buildItems(host).filter(
              (i) => i.label.toLowerCase().includes(q) || i.keywords.includes(q),
            );
          },
          render: () => {
            let list: FloatingList<SlashItem> | null = null;
            let currentCommand: ((props: SlashItem) => void) | null = null;
            return {
              onStart: (props: SuggestionProps) => {
                currentCommand = props.command as (p: SlashItem) => void;
                list = new FloatingList<SlashItem>((item) => currentCommand?.(item));
                list.update(props.items as SlashItem[], props.clientRect?.() ?? null);
              },
              onUpdate: (props: SuggestionProps) => {
                currentCommand = props.command as (p: SlashItem) => void;
                list?.update(props.items as SlashItem[], props.clientRect?.() ?? null);
              },
              onKeyDown: (props: SuggestionKeyDownProps) => {
                if (props.event.key === 'Escape') {
                  list?.hide();
                  return true;
                }
                return list?.onKeyDown(props.event.key) ?? false;
              },
              onExit: () => {
                list?.destroy();
                list = null;
              },
            };
          },
        }),
      ];
    },
  });
}
