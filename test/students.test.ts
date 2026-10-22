import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { type Db, openDb } from '../src/db.js'

let db: Db

beforeEach(() => {
  db = openDb(':memory:')
  db.prepare('INSERT INTO students (name, email) VALUES (?, ?)').run('Ada Lovelace', 'ada@example.edu')
})

describe('students API', () => {
  it('lists students', async () => {
    const res = await createApp(db).request('/students')
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0]).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.edu' })
  })

  it('gets one student by id', async () => {
    const res = await createApp(db).request('/students/1')
    expect(res.status).toBe(200)
    expect((await res.json()).data.name).toBe('Ada Lovelace')
  })

  it('returns 404 for an unknown student', async () => {
    const res = await createApp(db).request('/students/999')
    expect(res.status).toBe(404)
  })

  it('returns 400 for an invalid id', async () => {
    const res = await createApp(db).request('/students/abc')
    expect(res.status).toBe(400)
  })

  it('removes a student so they no longer appear in the list', async () => {
    const app = createApp(db)
    const res = await app.request('/students/1', { method: 'DELETE' })
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')

    const list = await (await app.request('/students')).json()
    expect(list.data).toEqual([])
    expect((await app.request('/students/1')).status).toBe(404)
  })

  it('keeps the removed student record with a deleted_at timestamp', async () => {
    await createApp(db).request('/students/1', { method: 'DELETE' })
    const row = db.prepare('SELECT deleted_at FROM students WHERE id = 1').get() as { deleted_at: string | null }
    expect(row.deleted_at).not.toBeNull()
  })

  it('returns 404 when removing an already removed student', async () => {
    const app = createApp(db)
    await app.request('/students/1', { method: 'DELETE' })
    expect((await app.request('/students/1', { method: 'DELETE' })).status).toBe(404)
  })

  it('only removes the requested student', async () => {
    db.prepare('INSERT INTO students (name, email) VALUES (?, ?)').run('Alan Turing', 'alan@example.edu')
    const app = createApp(db)
    await app.request('/students/1', { method: 'DELETE' })
    const { data } = await (await app.request('/students')).json()
    expect(data.map((s: { name: string }) => s.name)).toEqual(['Alan Turing'])
  })

  it('returns 404 when removing an unknown student', async () => {
    const res = await createApp(db).request('/students/999', { method: 'DELETE' })
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('NOT_FOUND')
  })

  it('returns 400 when removing with an invalid id', async () => {
    const res = await createApp(db).request('/students/abc', { method: 'DELETE' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('INVALID_ID')
  })
})
