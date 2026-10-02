import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

export async function checkPwaContract(directory) {
  const registration = readFileSync(resolve(directory, 'registerSW.js'), 'utf8')
  const worker = readFileSync(resolve(directory, 'sw.js'), 'utf8')
  const rejectRegistration = () => {
    throw new Error('The public theme must not register an offline navigation worker')
  }
  const registrationContext = {
    navigator: { serviceWorker: { register: rejectRegistration } },
    addEventListener: rejectRegistration,
  }
  registrationContext.window = registrationContext
  registrationContext.self = registrationContext
  runInNewContext(registration, registrationContext, { timeout: 1000 })

  const listeners = new Map()
  let skipped = 0
  let claimed = 0
  const workerContext = {
    addEventListener(type, handler) {
      assert.ok(['install', 'activate'].includes(type), `Unexpected worker listener: ${type}`)
      assert.equal(listeners.has(type), false, `Duplicate worker listener: ${type}`)
      listeners.set(type, handler)
    },
    skipWaiting() { skipped += 1 },
    clients: {
      claim() {
        claimed += 1
        return Promise.resolve()
      },
    },
  }
  workerContext.self = workerContext
  runInNewContext(worker, workerContext, { timeout: 1000 })
  assert.equal(workerContext.onfetch, undefined, 'The worker must not intercept fetch')
  assert.ok(listeners.has('install') && listeners.has('activate'), 'Worker lifecycle handlers are required')
  listeners.get('install')()
  let activation
  listeners.get('activate')({
    waitUntil(promise) { activation = promise },
  })
  assert.ok(activation instanceof Promise, 'Activation must wait for clients.claim()')
  await activation
  assert.equal(skipped, 1, 'The replacement worker must activate promptly')
  assert.equal(claimed, 1, 'The replacement worker must claim existing clients')
}

export async function checkPackage(root) {
  const manifest = JSON.parse(readFileSync(resolve(root, 'komari-theme.json'), 'utf8'))
  const metadata = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
  assert.equal(manifest.version, metadata.version, 'Package and theme versions must match')
  assert.equal(manifest.short, 'GlassmorphismEnhanced', 'Saved-settings identity must remain unchanged')
  assert.ok(readFileSync(resolve(root, 'docs/preview.png')).length, 'Preview must not be empty')
  assert.ok(readFileSync(resolve(root, 'dist/index.html')).length, 'Built homepage must not be empty')
  await checkPwaContract(resolve(root, 'public'))
  for (const file of ['registerSW.js', 'sw.js']) {
    assert.deepEqual(
      readFileSync(resolve(root, 'dist', file)),
      readFileSync(resolve(root, 'public', file)),
      `Built ${file} must preserve the checked-in PWA override`,
    )
  }
  console.log('Package contract verified: identity, version, preview, homepage and network-only PWA resources')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await checkPackage(resolve(process.argv[2] || '.'))
}
