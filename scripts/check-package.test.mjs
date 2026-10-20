import assert from 'node:assert/strict'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { checkPackage, checkPwaContract } from './check-package.mjs'

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public')

async function fixture(callback) {
  const root = mkdtempSync(join(tmpdir(), 'may-package-contract-'))
  try {
    for (const directory of ['public', 'dist', 'docs']) {
      mkdirSync(join(root, directory))
    }
    for (const file of ['registerSW.js', 'sw.js']) {
      copyFileSync(join(source, file), join(root, 'public', file))
      copyFileSync(join(source, file), join(root, 'dist', file))
    }
    writeFileSync(join(root, 'komari-theme.json'), JSON.stringify({ version: 'test', short: 'GlassmorphismEnhanced' }))
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: 'test' }))
    writeFileSync(join(root, 'docs/preview.png'), 'fixture')
    writeFileSync(join(root, 'dist/index.html'), '<!doctype html><title>Fixture</title>')
    await callback(root)
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('the preserved PWA overrides satisfy the network-only contract', async () => {
  await checkPwaContract(source)
  await fixture(root => checkPackage(root))
})

test('offline worker registration is rejected', async () => {
  await fixture(async (root) => {
    writeFileSync(join(root, 'public/registerSW.js'), `navigator.serviceWorker.register('/sw.js')`)
    await assert.rejects(checkPackage(root), /must not register/)
  })
})

test('fetch event handlers are rejected', async () => {
  await fixture(async (root) => {
    writeFileSync(join(root, 'public/sw.js'), `self.addEventListener('fetch', () => {})`)
    await assert.rejects(checkPackage(root), /Unexpected worker listener/)
    writeFileSync(join(root, 'public/sw.js'), 'self.onfetch = () => {}')
    await assert.rejects(checkPackage(root), /must not intercept fetch/)
  })
})

test('missing overrides and altered build resources are rejected', async () => {
  await fixture(async (root) => {
    writeFileSync(join(root, 'dist/sw.js'), '// stale offline worker')
    await assert.rejects(checkPackage(root), /must preserve/)
    rmSync(join(root, 'public/sw.js'))
    await assert.rejects(checkPackage(root), /ENOENT/)
  })
})

test('version drift and changed saved-settings identity are rejected', async () => {
  await fixture(async (root) => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: 'different' }))
    await assert.rejects(checkPackage(root), /versions must match/)
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: 'test' }))
    writeFileSync(join(root, 'komari-theme.json'), JSON.stringify({ version: 'test', short: 'ChangedIdentity' }))
    await assert.rejects(checkPackage(root), /identity must remain unchanged/)
  })
})

test('empty preview and homepage are rejected', async () => {
  await fixture(async (root) => {
    writeFileSync(join(root, 'docs/preview.png'), '')
    await assert.rejects(checkPackage(root), /Preview must not be empty/)
    writeFileSync(join(root, 'docs/preview.png'), 'fixture')
    writeFileSync(join(root, 'dist/index.html'), '')
    await assert.rejects(checkPackage(root), /homepage must not be empty/)
  })
})
