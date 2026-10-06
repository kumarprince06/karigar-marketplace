import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      // Focusable scroll regions (wide tables) are a WCAG requirement, not a misuse of tabIndex.
      'jsx-a11y/no-noninteractive-tabindex': ['error', { roles: ['tabpanel', 'region'] }],
      // Features expose a public API through their index; reach inside only from within the feature.
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['@/features/*/*'], message: 'Import a feature through its index only.' }] },
      ],
    },
  },
  {
    // Playwright tests: fixture `use()` is not a React hook, and tests may import a single module directly.
    files: ['e2e/**/*.ts'],
    rules: { 'react-hooks/rules-of-hooks': 'off', 'no-restricted-imports': 'off' },
  },
);
