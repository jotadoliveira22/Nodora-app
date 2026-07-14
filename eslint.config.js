import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/target/**', '**/node_modules/**', '**/gen/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
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
