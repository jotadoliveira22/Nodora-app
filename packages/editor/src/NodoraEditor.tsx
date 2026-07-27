/**
 * Componente de editor de Nodora. Única superficie de la app sobre Tiptap
 * (ADR-004): fuera de @nodora/editor nadie importa @tiptap/*.
 */
import { useEffect, useMemo } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Extension } from '@tiptap/core';

import { AttachmentImage } from './extensions/attachmentImage';
import { BlockId } from './extensions/blockId';
import { Callout } from './extensions/callout';
import { PageLink } from './extensions/pageLink';
import { Subpage } from './extensions/subpage';
import { PageMention } from './suggestion/mention';
import { SlashMenu } from './suggestion/slashMenu';
import type { EditorDocJson, EditorHostCallbacks } from './types';

export interface NodoraEditorProps {
  /** Documento inicial; el componente NO es controlado (rendimiento). */
  initialDoc: EditorDocJson;
  /** Cambia cuando se abre otra página: fuerza recreación limpia. */
  docKey: string;
  editable?: boolean;
  host: EditorHostCallbacks;
  /** Notifica cambios (el host aplica debounce y persiste). */
  onDocChanged: (getDoc: () => EditorDocJson) => void;
  /** Recibe la instancia para operaciones imperativas (flush al salir). */
  onReady?: (editor: Editor) => void;
}

/** Pegado de imágenes desde el portapapeles (PRD R3.4). */
function pasteImagePlugin(host: EditorHostCallbacks) {
  return Extension.create({
    name: 'pasteImage',
    addProseMirrorPlugins() {
      const editor = this.editor;
      const handleFiles = (files: FileList | File[]): boolean => {
        const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
        if (!images.length) return false;
        for (const file of images) {
          void host.onPasteImage(file).then((att) => {
            if (att) editor.chain().focus().insertAttachmentImage(att.id, att.alt).run();
          });
        }
        return true;
      };
      return [
        new Plugin({
          key: new PluginKey('nodora-paste-image'),
          props: {
            handlePaste: (_view, event) => {
              const files = event.clipboardData?.files;
              return files && files.length > 0 ? handleFiles(files) : false;
            },
            handleDrop: (_view, event) => {
              const files = event.dataTransfer?.files;
              return files && files.length > 0 ? handleFiles(files) : false;
            },
          },
        }),
      ];
    },
  });
}

export function NodoraEditor({
  initialDoc,
  docKey,
  editable = true,
  host,
  onDocChanged,
  onReady,
}: NodoraEditorProps) {
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // El historial de undo/redo viene del StarterKit.
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ['http', 'https', 'mailto'],
      }),
      Placeholder.configure({
        placeholder: "Escribe algo o pulsa '/' para insertar un bloque…",
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Callout,
      BlockId,
      AttachmentImage.configure({ resolveAttachmentUrl: host.resolveAttachmentUrl }),
      PageLink.configure({
        resolvePageTitle: host.resolvePageTitle,
        onNavigate: host.onNavigate,
      }),
      Subpage.configure({
        resolvePageTitle: host.resolvePageTitle,
        onNavigate: host.onNavigate,
      }),
      SlashMenu(host),
      PageMention(host),
      pasteImagePlugin(host),
    ],
    // host es estable por página (docKey cambia al navegar).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [docKey],
  );

  const editor = useEditor(
    {
      extensions,
      content: initialDoc,
      editable,
      editorProps: {
        attributes: {
          // El área de edición es un textbox ARIA: necesita nombre accesible.
          'aria-label': 'Contenido de la página',
        },
      },
      onUpdate: ({ editor }) => {
        onDocChanged(() => editor.getJSON() as EditorDocJson);
      },
    },
    [docKey],
  );

  useEffect(() => {
    if (editor && onReady) onReady(editor);
  }, [editor, onReady]);

  return <EditorContent editor={editor} className="nd-editor" />;
}

export type { Editor as NodoraEditorInstance } from '@tiptap/react';
