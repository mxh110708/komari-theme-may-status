import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  vue: true,
}, {
  files: ['scripts/check-package.test.mjs'],
  // Package-contract regressions deliberately use Node's built-in runner.
  rules: { 'test/no-import-node-test': 'off' },
})
