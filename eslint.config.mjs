import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    // `.vscode-test/` es el VS Code que @vscode/test-electron descarga para correr los tests
    // de integracion: cientos de megas de codigo ajeno, con su propia config de ESLint que
    // rompe la corrida entera si se la intenta cargar. `out/` es el compilado de esos tests.
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/.vscode-test/**', 'vscode-extension/out/**'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
];
