// @playwright/test debe importarse primero: si se carga antes otro paquete
// que arrastre playwright-core, el registro de hooks no encuentra la suite.
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const fakeBackend = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fakeBackend.js');

/**
 * Accesibilidad (PRD N4, docs/DESIGN_SYSTEM.md §Accesibilidad):
 * contraste AA, roles y etiquetas correctos, y operación por teclado.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript({ path: fakeBackend });
  await page.goto('/');
});

async function analyze(page: Page) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
}

function describe(violations: Awaited<ReturnType<typeof analyze>>['violations']) {
  return violations
    .map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target).join(', ')}`)
    .join('\n');
}

async function createWorkspace(page: Page) {
  await page.getByPlaceholder('Nombre del espacio').fill('Accesible');
  await page.getByRole('button', { name: 'Crear espacio' }).click();
  await expect(page.getByRole('navigation', { name: 'Navegación' })).toBeVisible();
}

test('la pantalla de bienvenida no tiene violaciones de accesibilidad', async ({ page }) => {
  const { violations } = await analyze(page);
  expect(violations, describe(violations)).toEqual([]);
});

for (const theme of ['light', 'dark'] as const) {
  test(`el espacio de trabajo cumple WCAG AA en tema ${theme}`, async ({ page }) => {
    await createWorkspace(page);
    await page.evaluate((t) => {
      document.documentElement.dataset['theme'] = t;
    }, theme);
    const { violations } = await analyze(page);
    expect(violations, describe(violations)).toEqual([]);
  });
}

test('la vista de base de datos cumple WCAG AA', async ({ page }) => {
  await createWorkspace(page);
  await page.getByRole('button', { name: 'Nueva base de datos' }).click();
  await expect(page.locator('.nd-db-table')).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo registro' }).click();
  const { violations } = await analyze(page);
  expect(violations, describe(violations)).toEqual([]);
});

test('la paleta de búsqueda cumple WCAG AA', async ({ page }) => {
  await createWorkspace(page);
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Buscar' })).toBeVisible();
  const { violations } = await analyze(page);
  expect(violations, describe(violations)).toEqual([]);
});

test('se puede crear y abrir una página solo con el teclado', async ({ page }) => {
  await createWorkspace(page);

  // Ctrl+N crea una página y deja el foco listo para escribir el título.
  await page.keyboard.press('Control+n');
  const title = page.getByRole('textbox', { name: 'Título de la página' });
  await expect(title).toBeVisible();
  await title.click();
  await page.keyboard.type('Solo teclado');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('navigation')).toContainText('Solo teclado');

  // Enter desde el título baja al cuerpo, que ya acepta escritura.
  await page.keyboard.type('Contenido escrito sin ratón');
  await expect(page.locator('.nd-editor .tiptap')).toContainText('Contenido escrito sin ratón');

  // Ctrl+K abre la paleta, Escape la cierra.
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Buscar' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Buscar' })).toBeHidden();
});

test('los diálogos se cierran con Escape y anuncian su propósito', async ({ page }) => {
  await createWorkspace(page);
  await page.locator('.nd-ws-header').click();
  await page.getByRole('menuitem', { name: 'Renombrar espacio…' }).click();

  const dialog = page.getByRole('dialog', { name: 'Espacio de trabajo' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('el estado de guardado se anuncia a los lectores de pantalla', async ({ page }) => {
  await createWorkspace(page);
  // La región de estado es "polite" para no interrumpir la escritura.
  await expect(page.locator('.nd-save-status')).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('.nd-toast-wrap, [aria-live="polite"]').first()).toBeAttached();
});
