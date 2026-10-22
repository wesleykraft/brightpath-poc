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

  const post = (body: unknown) =>
    createApp(db).request('/students', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

  it('adds a student', async () => {
    const res = await post({ name: 'Grace Hopper', email: 'grace@example.edu' })
    expect(res.status).toBe(201)
    expect((await res.json()).data).toMatchObject({ id: 2, name: 'Grace Hopper', email: 'grace@example.edu' })
  })

  it('adds a student whose email already exists as a new student', async () => {
    const res = await post({ name: 'Ada Two', email: 'ada@example.edu' })
    expect(res.status).toBe(201)
    const { data } = await res.json()
    expect(data).toMatchObject({ id: 2, name: 'Ada Two', email: 'ada@example.edu' })

    const list = await (await createApp(db).request('/students')).json()
    expect(list.data).toHaveLength(2)
  })

  it('rejects invalid input', async () => {
    expect((await post({ name: '', email: 'x@example.edu' })).status).toBe(400)
    expect((await post({ name: 'X', email: 'nope' })).status).toBe(400)
    expect((await post({})).status).toBe(400)
  })
})
