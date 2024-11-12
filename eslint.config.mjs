// @ts-check

import eslint from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  // eslint-disable-next-line import/no-named-as-default-member
  ...tseslint.configs.recommended,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    settings: {
      'import/resolver': {
        typescript: true,
        node: true
      }
    },
    rules: {
      'import/order': [
        'warn',
        {
          alphabetize: {
            order: 'asc'
          }
        }
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' }
      ],
      'import/consistent-type-specifier-style': ['error', 'prefer-top-level'],
      '@/quotes': ['error', 'single', { avoidEscape: true, allowTemplateLiterals: false }]
    }
  },
  {
    ignores: ['build/']
  }
);
