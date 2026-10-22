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

  it('counts students', async () => {
    const app = createApp(db)
    const res = await app.request('/students/count')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { count: 1 } })

    db.prepare('INSERT INTO students (name, email) VALUES (?, ?)').run('Alan Turing', 'alan@example.edu')
    expect((await (await app.request('/students/count')).json()).data.count).toBe(2)
  })

  it('counts zero students when there are none', async () => {
    db.prepare('DELETE FROM students').run()
    const res = await createApp(db).request('/students/count')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { count: 0 } })
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
})
