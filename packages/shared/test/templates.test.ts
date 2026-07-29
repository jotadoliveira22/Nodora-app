/**
 * Las plantillas se compilan aquí y se vuelcan a `templates.fixture.json`.
 *
 * Ese archivo es el puente con el backend: `tests/templates.rs` (Rust) valida
 * cada documento con el validador real y lo guarda en una página. Así una
 * plantilla que produjese un documento inválido rompe la compilación, en vez
 * de fallar en las manos del usuario al intentar guardar.
 *
 * Si cambias el catálogo, regenera el fixture:
 *   ACTUALIZAR_FIXTURE=1 pnpm --filter @nodora/shared test
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { TEMPLATES, TEMPLATE_GROUPS, buildTemplateDoc, templateById } from '../src/templates';

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'templates.fixture.json',
);

/** Ids deterministas: el fixture debe ser estable entre ejecuciones. */
function contador() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}

function construirFixture() {
  return TEMPLATES.map((t) => ({
    id: t.id,
    title: t.title,
    doc: buildTemplateDoc(t, contador()),
  }));
}

describe('catálogo de plantillas', () => {
  it('tiene identificadores únicos y grupos declarados', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const grupos = new Set(TEMPLATE_GROUPS.map((g) => g.id));
    for (const t of TEMPLATES) {
      expect(grupos.has(t.group), `${t.id} usa un grupo desconocido`).toBe(true);
      expect(t.name.length, `${t.id} sin nombre`).toBeGreaterThan(0);
      expect(t.summary.length, `${t.id} sin resumen`).toBeGreaterThan(0);
      expect(t.icon.length, `${t.id} sin icono`).toBeGreaterThan(0);
    }
  });

  it('cada plantilla es o bien de contenido o bien de base de datos', () => {
    for (const t of TEMPLATES) {
      if (t.database) {
        // Una base de datos se crea vacía: sus bloques no se aplicarían.
        expect(t.blocks, `${t.id} declara bloques que se perderían`).toEqual([]);
        expect(t.database.properties.length, `${t.id} sin propiedades`).toBeGreaterThan(0);
        const nombres = t.database.properties.map((p) => p.name);
        expect(new Set(nombres).size, `${t.id} repite el nombre de una columna`).toBe(
          nombres.length,
        );
        for (const p of t.database.properties) {
          // El tipo título lo crea la propia base; declararlo lo duplicaría.
          expect(p.type).not.toBe('title');
          if (p.options) {
            expect(['select', 'multi_select', 'status']).toContain(p.type);
          }
        }
      } else {
        expect(t.blocks.length, `${t.id} no tiene contenido`).toBeGreaterThan(0);
      }
    }
  });

  it('los documentos generados cumplen las reglas del validador', () => {
    // Espejo de apps/desktop/src-tauri/src/validate.rs: si allí cambian los
    // tipos admitidos, esta lista debe cambiar con ellos.
    const permitidos = new Set([
      'paragraph',
      'heading',
      'bulletList',
      'orderedList',
      'listItem',
      'taskList',
      'taskItem',
      'blockquote',
      'callout',
      'codeBlock',
      'horizontalRule',
      'hardBreak',
      'text',
    ]);
    for (const t of TEMPLATES.filter((x) => !x.database)) {
      const doc = buildTemplateDoc(t, contador());
      expect(doc.type).toBe('doc');
      const vistos = new Set<string>();
      for (const bloque of doc.content ?? []) {
        const id = bloque.attrs?.['blockId'];
        expect(typeof id, `${t.id}: bloque sin blockId`).toBe('string');
        expect(vistos.has(id as string), `${t.id}: blockId repetido`).toBe(false);
        vistos.add(id as string);
      }
      const recorrer = (nodo: {
        type: string;
        content?: unknown[];
        attrs?: Record<string, unknown>;
      }) => {
        expect(permitidos.has(nodo.type), `${t.id}: tipo ${nodo.type} no admitido`).toBe(true);
        if (nodo.type === 'heading') {
          expect([1, 2, 3]).toContain(nodo.attrs?.['level']);
        }
        for (const hijo of (nodo.content ?? []) as (typeof nodo)[]) recorrer(hijo);
      };
      for (const bloque of doc.content ?? []) recorrer(bloque);
    }
  });

  it('las plantillas con limitación conocida la declaran', () => {
    // Estas prometen por su nombre algo que el MVP no hace del todo; la
    // advertencia se muestra al elegirlas.
    for (const id of ['acta-grabada', 'panel', 'calendario', 'trading-journal']) {
      expect(templateById(id)?.caveat, `${id} debería advertir de su límite`).toBeTruthy();
    }
  });

  it('el fixture que valida el backend está al día', () => {
    const generado = JSON.stringify(construirFixture(), null, 2) + '\n';
    if (process.env['ACTUALIZAR_FIXTURE']) {
      writeFileSync(fixturePath, generado);
      return;
    }
    const comprometido = readFileSync(fixturePath, 'utf8');
    expect(
      comprometido,
      'templates.fixture.json está desfasado: regenera con ACTUALIZAR_FIXTURE=1',
    ).toBe(generado);
  });
});
