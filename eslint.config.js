import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/.wrangler/**'
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  {
    files: [
      'packages/mcp-server/src/core/**/*.ts',
      'apps/cli/**/*.ts',
      'apps/github-action/**/*.ts'
    ],
    rules: { '@typescript-eslint/no-explicit-any': 'error' }
  }
);
