import parser from '@typescript-eslint/parser';
import plugin from '@typescript-eslint/eslint-plugin';

// Match the existing TypeScript style; do not rewrite unrelated source files.
export default [
  { ignores: ['node_modules/**', 'dist/**'] },
  { files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: { parser, parserOptions: { ecmaVersion: 2021, sourceType: 'module' } },
    plugins: { '@typescript-eslint': plugin },
    rules: { 'no-constant-condition': 'error', 'no-debugger': 'error',
      'no-duplicate-case': 'error', 'no-unreachable': 'error',
      '@typescript-eslint/no-duplicate-enum-values': 'error' } },
];
