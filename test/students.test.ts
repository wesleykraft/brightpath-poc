import Database from 'better-sqlite3'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

  describe('removing a student', () => {
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
      expect(list.data.map((s: { name: string }) => s.name)).toEqual(['Grace Hopper'])
      expect((await app.request('/students/1')).status).toBe(404)
      expect((await app.request('/students/2')).status).toBe(200)
    })

    it('returns 404 when removing the same student twice', async () => {
      const app = createApp(db)
      await app.request('/students/1', { method: 'DELETE' })
      expect((await app.request('/students/1', { method: 'DELETE' })).status).toBe(404)
    })

    it('keeps the row as history (soft delete)', async () => {
      await createApp(db).request('/students/1', { method: 'DELETE' })
      const row = db.prepare('SELECT name, deleted_at FROM students WHERE id = 1').get() as {
        name: string
        deleted_at: string | null
      }
      expect(row.name).toBe('Ada Lovelace')
      expect(row.deleted_at).not.toBeNull()
    })

    it('migrates a pre-existing database without deleted_at', async () => {
      const dir = mkdtempSync(join(tmpdir(), 'brightpath-'))
      const path = join(dir, 'legacy.db')
      try {
        const legacy = new Database(path)
        legacy.exec(
          "CREATE TABLE students (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT '2024-01-01T00:00:00.000Z')",
        )
        legacy.prepare('INSERT INTO students (name, email) VALUES (?, ?)').run('Old Student', 'old@example.edu')
        legacy.close()

        const migrated = openDb(path)
        const app = createApp(migrated)
        expect((await app.request('/students/1', { method: 'DELETE' })).status).toBe(204)
        expect((await (await app.request('/students')).json()).data).toEqual([])
        migrated.close()
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
  })
})
