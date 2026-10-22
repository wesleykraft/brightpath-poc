import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { openDb } from '../src/db.js'

describe('health endpoint', () => {
  it('returns ok and the package.json version', async () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    const res = await createApp(openDb(':memory:')).request('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, version: pkg.version })
  })
})
