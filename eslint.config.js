import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// Globales del entorno de navegador usados por el frontend y por el backend
// de pruebas de interfaz.
const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  crypto: 'readonly',
  navigator: 'readonly',
  console: 'readonly',
  fetch: 'readonly',
  btoa: 'readonly',
  atob: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  HTMLElement: 'readonly',
  HTMLInputElement: 'readonly',
  DOMRect: 'readonly',
  Node: 'readonly',
  File: 'readonly',
  FileList: 'readonly',
  Event: 'readonly',
  KeyboardEvent: 'readonly',
  MouseEvent: 'readonly',
};

export default tseslint.config(
  { ignores: ['**/dist/**', '**/target/**', '**/node_modules/**', '**/gen/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js}'],
    languageOptions: { globals: browserGlobals },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // La regla de arquitectura: nadie importa Tiptap fuera de @nodora/editor.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@tiptap/*', 'prosemirror-*'],
              message: 'Importa el editor solo a través de @nodora/editor (ADR-004).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/editor/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
);
