// ============================================================
// ai-code - ESLint Configuration (flat config for ESLint 10)
// ============================================================

export default [
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'off',
      'no-console': 'off',
      'no-constant-condition': 'warn',
      'no-empty': 'warn',
      'prefer-const': 'warn',
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
];
