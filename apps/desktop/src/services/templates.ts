/**
 * Aplicación de una plantilla sobre una página recién creada.
 *
 * El catálogo vive en `@nodora/shared` como datos; aquí solo se traduce a
 * llamadas del backend. Dos formas posibles:
 *
 *  - Plantilla de contenido: título, icono y documento inicial.
 *  - Plantilla de base de datos: convierte la página en una base y crea sus
 *    columnas con sus opciones.
 */
import { buildTemplateDoc, type NodoraTemplate } from '@nodora/shared';

import { dbApi, pagesApi } from './api';

/** Ids de bloque: los mismos UUID que usa el editor (ADR-005). */
function newId(): string {
  return crypto.randomUUID();
}

export interface AppliedTemplate {
  /** Título que quedó en la página, para reflejarlo sin recargar. */
  title: string;
  icon: string | null;
  /** Versión nueva de la página tras aplicar la plantilla. */
  version: number;
  /** True si la página pasó a ser una base de datos. */
  isDatabase: boolean;
}

export async function applyTemplate(
  pageId: string,
  template: NodoraTemplate,
  baseVersion: number,
): Promise<AppliedTemplate> {
  const title = template.title.trim();

  if (template.database) {
    // La base se crea como página hija y hereda el título de la plantilla; la
    // página en la que se pulsó queda como su contenedor.
    const detail = await dbApi.create(pageId, title || template.name);
    for (const prop of template.database.properties) {
      const created = await dbApi.addProperty(detail.id, prop.name, prop.type);
      if (prop.options?.length) {
        // Las opciones llevan id propio: es lo que permite renombrarlas
        // después sin perder los valores ya asignados.
        const options = prop.options.map((o) => ({
          id: newId(),
          name: o.name,
          color: o.color ?? 'gray',
        }));
        await dbApi.setPropertyConfig(created.id, JSON.stringify({ options }));
      }
    }
    return { title, icon: template.icon, version: baseVersion, isDatabase: true };
  }

  let version = baseVersion;
  if (title) version = (await pagesApi.rename(pageId, title)).version;
  version = (await pagesApi.setIcon(pageId, template.icon)).version;
  const doc = buildTemplateDoc(template, newId);
  version = (await pagesApi.saveContent(pageId, JSON.stringify(doc), version)).version;
  return { title, icon: template.icon, version, isDatabase: false };
}
