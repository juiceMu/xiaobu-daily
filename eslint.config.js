const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
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
