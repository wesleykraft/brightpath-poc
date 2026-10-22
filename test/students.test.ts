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

  describe('DELETE /students/:id', () => {
    it('returns 204 for an existing student', async () => {
      const res = await createApp(db).request('/students/1', { method: 'DELETE' })
      expect(res.status).toBe(204)
      expect(await res.text()).toBe('')
    })

    it('returns 404 for an unknown student', async () => {
      const res = await createApp(db).request('/students/999', { method: 'DELETE' })
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({ error: 'NOT_FOUND' })
    })

    it('returns 400 for an invalid id', async () => {
      const res = await createApp(db).request('/students/abc', { method: 'DELETE' })
      expect(res.status).toBe(400)
    })

    it('hides the removed student from the list and from get by id', async () => {
      db.prepare('INSERT INTO students (name, email) VALUES (?, ?)').run('Grace Hopper', 'grace@example.edu')
      const app = createApp(db)
      await app.request('/students/1', { method: 'DELETE' })

      const list = await (await app.request('/students')).json()
      expect(list.data.map((s: { id: number }) => s.id)).toEqual([2])
      expect((await app.request('/students/1')).status).toBe(404)
      expect((await app.request('/students/2')).status).toBe(200)
    })

    it('returns 404 when removing an already removed student', async () => {
      const app = createApp(db)
      await app.request('/students/1', { method: 'DELETE' })
      expect((await app.request('/students/1', { method: 'DELETE' })).status).toBe(404)
    })

    it('keeps the row as history with a deleted_at timestamp', async () => {
      await createApp(db).request('/students/1', { method: 'DELETE' })
      const row = db.prepare('SELECT name, deleted_at FROM students WHERE id = 1').get() as {
        name: string
        deleted_at: string | null
      }
      expect(row.name).toBe('Ada Lovelace')
      expect(row.deleted_at).not.toBeNull()
    })
  })
})
