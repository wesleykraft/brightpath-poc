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
    const del = (id: string | number) => createApp(db).request(`/students/${id}`, { method: 'DELETE' })

    it('returns 204 for an existing student', async () => {
      const res = await del(1)
      expect(res.status).toBe(204)
      expect(await res.text()).toBe('')
    })

    it('returns 404 for an unknown student', async () => {
      const res = await del(999)
      expect(res.status).toBe(404)
      expect((await res.json()).error).toBe('NOT_FOUND')
    })

    it('returns 400 for an invalid id', async () => {
      expect((await del('abc')).status).toBe(400)
    })

    it('hides the removed student from the list and from GET by id', async () => {
      db.prepare('INSERT INTO students (name, email) VALUES (?, ?)').run('Grace Hopper', 'grace@example.edu')
      await del(1)
      const app = createApp(db)
      const { data } = await (await app.request('/students')).json()
      expect(data.map((s: { name: string }) => s.name)).toEqual(['Grace Hopper'])
      expect((await app.request('/students/1')).status).toBe(404)
      expect((await app.request('/students/2')).status).toBe(200)
    })

    it('returns 404 when removing a student twice', async () => {
      expect((await del(1)).status).toBe(204)
      expect((await del(1)).status).toBe(404)
    })

    it('keeps the row as history with a deleted_at timestamp', async () => {
      await del(1)
      const row = db.prepare('SELECT name, deleted_at FROM students WHERE id = 1').get() as {
        name: string
        deleted_at: string | null
      }
      expect(row.name).toBe('Ada Lovelace')
      expect(row.deleted_at).not.toBeNull()
    })
  })
})
