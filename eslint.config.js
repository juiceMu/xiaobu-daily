const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    files: ['scripts/**/*.cjs'],
    languageOptions: {
      globals: { __dirname: 'readonly' },
    },
  },
  {
    ignores: [
      'dist-web/**',
      'dist/**',
      '.expo/**',
      'src/domain/engineCore.mjs',
      'tests/engine.test.mjs',
    ],
  },
]);
