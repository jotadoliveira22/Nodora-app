/** Menú `@` para insertar enlaces internos a páginas (PRD R7.1). */
import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { type SuggestionProps, type SuggestionKeyDownProps } from '@tiptap/suggestion';

import { FloatingList, type FloatingItem } from './floatingList';
import type { EditorHostCallbacks, LinkablePage } from '../types';

interface MentionItem extends FloatingItem {
  pageId: string;
}

export function PageMention(host: EditorHostCallbacks) {
  return Extension.create({
    name: 'pageMention',
    addProseMirrorPlugins() {
      const editor = this.editor;
      return [
        Suggestion({
          editor,
          char: '@',
          pluginKey: new PluginKey('nodora-mention'),
          command: ({ range, props }) => {
            const item = props as MentionItem;
            editor.chain().focus().deleteRange(range).insertPageLink(item.pageId).run();
          },
          items: () => [],
          render: () => {
            let list: FloatingList<MentionItem> | null = null;
            let currentCommand: ((props: MentionItem) => void) | null = null;
            let seq = 0;
            const load = (query: string, rect: DOMRect | null) => {
              const mySeq = ++seq;
              void host.searchLinkablePages(query).then((pages: LinkablePage[]) => {
                if (mySeq !== seq || !list) return;
                const items: MentionItem[] = pages.map((p) => ({
                  id: p.id,
                  pageId: p.id,
                  label: `${p.icon ?? '📄'} ${p.title || 'Sin título'}`,
                }));
                list.update(items, rect);
              });
            };
            return {
              onStart: (props: SuggestionProps) => {
                currentCommand = props.command as (p: MentionItem) => void;
                list = new FloatingList<MentionItem>((item) => currentCommand?.(item));
                load(props.query, props.clientRect?.() ?? null);
              },
              onUpdate: (props: SuggestionProps) => {
                currentCommand = props.command as (p: MentionItem) => void;
                load(props.query, props.clientRect?.() ?? null);
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
