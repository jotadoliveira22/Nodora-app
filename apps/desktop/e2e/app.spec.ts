import { expect, test, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const fakeBackend = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fakeBackend.js');

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: fakeBackend });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  // Expuesto a las pruebas para comprobar que no hay errores de JS.
  (page as Page & { _errors: string[] })._errors = errors;
  await page.goto('/');
});

test.afterEach(async ({ page }) => {
  if ((page as Page & { _allowErrors?: boolean })._allowErrors) return;
  const errors = (page as Page & { _errors?: string[] })._errors ?? [];
  // Se ignoran avisos del entorno headless (favicon ausente, ruido del
  // observador de tamaño), no los errores del código de la aplicación.
  const real = errors.filter((e) => !/favicon|ResizeObserver|Failed to load resource/i.test(e));
  expect(real, `errores de JavaScript en la página: ${real.join(' | ')}`).toEqual([]);
});

/** Escribe el título y confirma con Enter (que es lo que hace el usuario). */
async function setTitle(page: Page, value: string) {
  const title = page.getByRole('textbox', { name: 'Título de la página' });
  await title.fill(value);
  await title.press('Enter');
  await expect(page.getByRole('navigation')).toContainText(value);
}

async function createWorkspace(page: Page, name = 'Mi Consultora') {
  await expect(page.getByRole('heading', { name: 'Nodora' })).toBeVisible();
  await page.getByPlaceholder('Nombre del espacio').fill(name);
  await page.getByRole('button', { name: 'Crear espacio' }).click();
  await expect(page.getByRole('navigation', { name: 'Navegación' })).toBeVisible();
}

test('primer arranque muestra la bienvenida y crea un espacio con página inicial', async ({
  page,
}) => {
  await createWorkspace(page);
  // El espacio aparece en la barra lateral y la página de bienvenida se abre.
  await expect(page.locator('.nd-ws-name')).toHaveText('Mi Consultora');
  await expect(page.getByRole('textbox', { name: 'Título de la página' })).toHaveValue(
    'Bienvenida',
  );
  await expect(page.locator('.nd-editor')).toContainText('Tu espacio de trabajo privado');
});

test('crear una página, titularla y escribir contenido que se guarda', async ({ page }) => {
  await createWorkspace(page);
  await page.getByRole('button', { name: 'Nueva página' }).first().click();

  await expect(page.getByRole('textbox', { name: 'Título de la página' })).toHaveValue('');
  await setTitle(page, 'Cliente Aurora');

  const editor = page.locator('.nd-editor .tiptap');
  await editor.click();
  await editor.pressSequentially('Notas de la reunión inicial');

  // El indicador pasa por "Guardando…" y termina en "Guardado".
  await expect(page.locator('.nd-save-status')).toContainText('Guardado', { timeout: 10_000 });

  // El título se refleja en la barra lateral.
  await expect(page.getByRole('navigation')).toContainText('Cliente Aurora');
});

test('el menú "/" inserta bloques y los renderiza', async ({ page }) => {
  await createWorkspace(page);
  await page.getByRole('button', { name: 'Nueva página' }).first().click();

  const editor = page.locator('.nd-editor .tiptap');
  await editor.click();
  await editor.pressSequentially('/');
  const menu = page.locator('.nd-floating-menu');
  await expect(menu).toBeVisible();

  // Filtra el menú y elige "Lista de tareas".
  await editor.pressSequentially('tarea');
  await expect(menu.getByText('Lista de tareas')).toBeVisible();
  await page.keyboard.press('Enter');

  await editor.pressSequentially('Preparar propuesta');
  await expect(editor.locator('ul[data-type="taskList"]')).toContainText('Preparar propuesta');
});

test('el menú "/" inserta un separador en un párrafo', async ({ page }) => {
  await createWorkspace(page);
  await page.getByRole('button', { name: 'Nueva página' }).first().click();
  const editor = page.locator('.nd-editor .tiptap');
  await editor.click();
  await editor.pressSequentially('/separador');
  await expect(page.locator('.nd-floating-menu')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(editor.locator('hr')).toBeVisible();
});

test('atajos de Markdown convierten bloques mientras se escribe', async ({ page }) => {
  await createWorkspace(page);
  await page.getByRole('button', { name: 'Nueva página' }).first().click();
  const editor = page.locator('.nd-editor .tiptap');
  await editor.click();
  await editor.pressSequentially('## Sección importante');
  await expect(editor.locator('h2')).toHaveText('Sección importante');
  await page.keyboard.press('Enter');
  await editor.pressSequentially('> una cita');
  await expect(editor.locator('blockquote')).toContainText('una cita');
});

test('enlaces internos con @ generan backlinks en la página destino', async ({ page }) => {
  await createWorkspace(page);

  // Página destino.
  await page.getByRole('button', { name: 'Nueva página' }).first().click();
  await setTitle(page, 'Proyecto Faro');

  // Página origen que la enlaza.
  await page.getByRole('button', { name: 'Nueva página' }).first().click();
  await setTitle(page, 'Acta 12/03');
  const editor = page.locator('.nd-editor .tiptap');
  await editor.click();
  await editor.pressSequentially('Revisar ');
  await editor.pressSequentially('@Faro');
  await expect(page.locator('.nd-floating-menu')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(editor.locator('.nd-page-link')).toContainText('Proyecto Faro');
  await expect(page.locator('.nd-save-status')).toContainText('Guardado', { timeout: 10_000 });

  // Al abrir el destino, aparece el backlink.
  await page.getByRole('navigation').getByText('Proyecto Faro').first().click();
  await expect(page.locator('.nd-backlinks')).toContainText('1 página(s) enlazan aquí');
  await expect(page.locator('.nd-backlink-item')).toContainText('Acta 12/03');

  // Y el backlink navega de vuelta.
  await page.locator('.nd-backlink-item').first().click();
  await expect(page.getByRole('textbox', { name: 'Título de la página' })).toHaveValue(
    'Acta 12/03',
  );
});

test('Ctrl+K busca por contenido y muestra fragmentos resaltados', async ({ page }) => {
  await createWorkspace(page);
  await page.getByRole('button', { name: 'Nueva página' }).first().click();
  await setTitle(page, 'Presupuesto');
  const editor = page.locator('.nd-editor .tiptap');
  await editor.click();
  await editor.pressSequentially('El importe acordado asciende a doce mil euros');
  await expect(page.locator('.nd-save-status')).toContainText('Guardado', { timeout: 10_000 });

  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'Buscar' });
  await expect(palette).toBeVisible();
  await palette.getByPlaceholder('Buscar páginas y contenido…').fill('acordado');

  const result = palette.getByRole('option').first();
  await expect(result).toContainText('Presupuesto');
  await expect(result.locator('mark')).toHaveText('acordado');

  await page.keyboard.press('Enter');
  await expect(palette).toBeHidden();
  await expect(page.getByRole('textbox', { name: 'Título de la página' })).toHaveValue(
    'Presupuesto',
  );
});

test('archivar y restaurar una página desde el Archivo', async ({ page }) => {
  await createWorkspace(page);
  await page.getByRole('button', { name: 'Nueva página' }).first().click();
  await setTitle(page, 'Borrador viejo');

  // Archivar desde el menú contextual de la barra lateral.
  await page.getByRole('navigation').getByText('Borrador viejo').first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Archivar' }).click();
  await expect(page.getByRole('navigation')).not.toContainText('Borrador viejo');

  // Recuperarla desde el Archivo.
  await page.locator('.nd-ws-header').click();
  await page.getByRole('menuitem', { name: /Archivo/ }).click();
  const modal = page.getByRole('dialog', { name: 'Archivo' });
  await expect(modal).toContainText('Borrador viejo');
  await modal.getByRole('button', { name: 'Restaurar' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation')).toContainText('Borrador viejo');
});

test('base de datos: crear columna, registro y abrirlo como página', async ({ page }) => {
  await createWorkspace(page);
  await page.getByRole('button', { name: 'Nueva base de datos' }).click();
  await expect(page.locator('.nd-db-table')).toBeVisible();
  await expect(page.locator('.nd-db-table th').first()).toContainText('Título');

  // Nueva columna de tipo Estado.
  await page.getByRole('button', { name: '+ Columna' }).click();
  const modal = page.getByRole('dialog', { name: 'Nueva columna' });
  await modal.getByPlaceholder('Nombre de la columna').fill('Estado');
  await modal.getByLabel('Tipo').selectOption('status');
  await modal.getByRole('button', { name: 'Crear' }).click();
  await expect(page.locator('.nd-db-table th')).toHaveCount(3); // Título + Estado + abrir

  // Nuevo registro y título.
  await page.getByRole('button', { name: 'Nuevo registro' }).click();
  await page.locator('.nd-db-table tbody .nd-db-cell').first().click();
  await page.locator('.nd-db-cell-input').first().fill('Cliente Norte');
  await page.keyboard.press('Enter');
  await expect(page.locator('.nd-db-table tbody')).toContainText('Cliente Norte');

  // Abrir el registro como página completa.
  await page.getByRole('button', { name: 'Abrir como página' }).first().click();
  await expect(page.getByRole('textbox', { name: 'Título de la página' })).toHaveValue(
    'Cliente Norte',
  );
});

test('la conversión de tipo insegura se comunica sin romper la tabla', async ({ page }) => {
  await createWorkspace(page);
  await page.getByRole('button', { name: 'Nueva base de datos' }).click();
  await page.getByRole('button', { name: '+ Columna' }).click();
  const modal = page.getByRole('dialog', { name: 'Nueva columna' });
  await modal.getByPlaceholder('Nombre de la columna').fill('Notas');
  await modal.getByRole('button', { name: 'Crear' }).click();

  page.once('dialog', (d) => void d.accept('checkbox'));
  await page.locator('.nd-db-th').filter({ hasText: 'Notas' }).click();
  await page.getByRole('menuitem', { name: /Cambiar tipo/ }).click();

  await expect(page.locator('.nd-toast')).toContainText('Conversión no disponible');
  await expect(page.locator('.nd-db-table')).toBeVisible();
});

test('navegación con historial, favoritos y breadcrumbs', async ({ page }) => {
  await createWorkspace(page);
  await page.getByRole('button', { name: 'Nueva página' }).first().click();
  await setTitle(page, 'Primera');
  await page.getByRole('button', { name: 'Nueva página' }).first().click();
  await setTitle(page, 'Segunda');

  // Atrás y adelante.
  await page.getByRole('button', { name: /Atrás/ }).click();
  await expect(page.getByRole('textbox', { name: 'Título de la página' })).toHaveValue('Primera');
  await page.getByRole('button', { name: /Adelante/ }).click();
  await expect(page.getByRole('textbox', { name: 'Título de la página' })).toHaveValue('Segunda');

  // Favorito: aparece la sección en la barra lateral.
  await page.getByRole('button', { name: 'Añadir a favoritos' }).click();
  await expect(page.getByRole('navigation')).toContainText('Favoritos');

  // Breadcrumbs de la página actual.
  await expect(page.locator('.nd-breadcrumbs')).toContainText('Segunda');
});

test('subpáginas: se crean anidadas y los breadcrumbs muestran la ruta', async ({ page }) => {
  await createWorkspace(page);
  await page.getByRole('button', { name: 'Nueva página' }).first().click();
  await setTitle(page, 'Padre');

  await page.getByRole('navigation').getByText('Padre').first().click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Nueva subpágina' }).click();
  await setTitle(page, 'Hija');

  await expect(page.locator('.nd-breadcrumbs')).toContainText('Padre');
  await expect(page.locator('.nd-breadcrumbs')).toContainText('Hija');
});

test('el tema oscuro se aplica y persiste en los ajustes', async ({ page }) => {
  await createWorkspace(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/);

  await page.locator('.nd-ws-header').click();
  await page.getByRole('menuitem', { name: /Tema oscuro|Tema claro/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const stored = await page.evaluate(() =>
    (
      window as unknown as { __NODORA_TEST__: { state: { settings: Map<string, string> } } }
    ).__NODORA_TEST__.state.settings.get('theme'),
  );
  expect(stored).toBe('dark');
});

test('un fallo del backend se comunica sin perder el trabajo escrito', async ({ page }) => {
  // Aquí los console.error son la conducta esperada (el error se reporta).
  (page as Page & { _allowErrors?: boolean })._allowErrors = true;
  await createWorkspace(page);
  await page.getByRole('button', { name: 'Nueva página' }).first().click();
  const editor = page.locator('.nd-editor .tiptap');
  await editor.click();
  await editor.pressSequentially('Texto importante');
  await expect(page.locator('.nd-save-status')).toContainText('Guardado', { timeout: 10_000 });

  // Se fuerza el fallo del guardado.
  await page.evaluate(() => {
    const internals = (window as unknown as { __TAURI_INTERNALS__: { invoke: unknown } })
      .__TAURI_INTERNALS__;
    const original = internals.invoke as (c: string, a: unknown) => Promise<unknown>;
    internals.invoke = async (cmd: string, args: unknown) => {
      if (cmd === 'save_page_content') {
        throw { code: 'STORAGE_ERROR', message: 'Error de almacenamiento local' };
      }
      return original(cmd, args);
    };
  });

  await editor.pressSequentially(' y más texto');
  await expect(page.locator('.nd-save-status')).toContainText('Error', { timeout: 10_000 });
  await expect(page.locator('.nd-toast--error').first()).toBeVisible();
  // El texto sigue en pantalla: el error no destruye el trabajo del usuario.
  await expect(editor).toContainText('Texto importante y más texto');
});

test('restaurar un respaldo pide confirmación mostrando su resumen verificado', async ({
  page,
}) => {
  await createWorkspace(page);
  await page.evaluate(() => {
    (
      window as unknown as { __NODORA_TEST__: { dialogResult: string } }
    ).__NODORA_TEST__.dialogResult = '/fake/respaldo.zip';
  });

  const messages: string[] = [];
  page.on('dialog', (d) => {
    messages.push(d.message());
    void d.dismiss();
  });

  await page.locator('.nd-ws-header').click();
  await page.getByRole('menuitem', { name: /Restaurar respaldo/ }).click();
  await expect.poll(() => messages.length).toBeGreaterThan(0);
  expect(messages[0]).toContain('Respaldo válido');
  expect(messages[0]).toContain('Respaldo de prueba');
  expect(messages[0]).toContain('espacio NUEVO');
});

test('liberar espacio informa de lo que se borrará antes de hacerlo', async ({ page }) => {
  await createWorkspace(page);

  const mensajes: string[] = [];
  page.on('dialog', (d) => {
    mensajes.push(d.message());
    void d.accept();
  });

  await page.locator('.nd-ws-header').click();
  await page.getByRole('menuitem', { name: /Liberar espacio/ }).click();

  await expect.poll(() => mensajes.length).toBeGreaterThan(0);
  expect(mensajes[0]).toContain('2 adjunto(s)');
  expect(mensajes[0]).toContain('3.00 MB');
  expect(mensajes[0]).toContain('no se tocan');
  await expect(page.locator('.nd-toast').first()).toContainText('Liberados 2');
});
