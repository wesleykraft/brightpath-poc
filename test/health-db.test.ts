import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { openDb } from '../src/db.js'

const original = process.env.DATABASE_URL

beforeEach(() => {
  if (!original) throw new Error('DATABASE_URL must point at a PostgreSQL database to run these tests')
})

afterEach(() => {
  process.env.DATABASE_URL = original
})

const request = () => createApp(openDb(':memory:')).request('/health/db')

describe('GET /health/db', () => {
  it('returns 200 when the real PostgreSQL at DATABASE_URL answers select 1', async () => {
    const res = await request()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('returns 503 DB_UNREACHABLE when nothing listens at DATABASE_URL', async () => {
    process.env.DATABASE_URL = 'postgres://app:app@127.0.0.1:1/app'
    const res = await request()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ ok: false, error: 'DB_UNREACHABLE' })
  })

  it('returns 503 DB_UNREACHABLE when the credentials are rejected', async () => {
    const url = new URL(original!)
    url.password = 'definitely-wrong'
    process.env.DATABASE_URL = url.toString()
    const res = await request()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ ok: false, error: 'DB_UNREACHABLE' })
  })

  it('returns 503 DB_UNREACHABLE when DATABASE_URL is unset', async () => {
    delete process.env.DATABASE_URL
    const res = await request()
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ ok: false, error: 'DB_UNREACHABLE' })
  })
})
