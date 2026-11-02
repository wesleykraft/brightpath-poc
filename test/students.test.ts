import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { type Db, openDb } from '../src/db.js'

let db: Db

beforeEach(() => {
  db = openDb(':memory:')
  db.prepare('INSERT INTO students (name, email) VALUES (?, ?)').run('Ada Lovelace', 'ada@example.edu')
})

const count = () => (db.prepare('SELECT COUNT(*) AS n FROM students').get() as { n: number }).n

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

  it('creates a student that is then listed', async () => {
    const app = createApp(db)
    const res = await app.request('/students', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '  Grace Hopper ', email: 'grace@example.edu' }),
    })
    expect(res.status).toBe(201)
    const { data } = await res.json()
    expect(data).toMatchObject({ id: 2, name: 'Grace Hopper', email: 'grace@example.edu' })

    const list = (await (await app.request('/students')).json()).data
    expect(list.map((s: { name: string }) => s.name)).toEqual(['Ada Lovelace', 'Grace Hopper'])

    const one = await app.request(`/students/${data.id}`)
    expect(one.status).toBe(200)
    expect((await one.json()).data).toEqual(data)

    const rows = db.prepare('SELECT COUNT(*) AS n FROM students WHERE email = ?').get('grace@example.edu') as { n: number }
    expect(rows.n).toBe(1)
  })

  it.each([
    ['empty name', { name: ' ', email: 'a@example.edu' }],
    ['bad email', { name: 'A', email: 'nope' }],
    ['missing fields', {}],
  ])('rejects %s', async (_label, body) => {
    const res = await createApp(db).request('/students', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'INVALID_INPUT' })
    expect(count()).toBe(1)
  })

  it('rejects a non-JSON body', async () => {
    const res = await createApp(db).request('/students', { method: 'POST', body: 'x' })
    expect(res.status).toBe(400)
    expect(count()).toBe(1)
  })

  describe('search', () => {
    beforeEach(() => {
      const insert = db.prepare('INSERT INTO students (name, email) VALUES (?, ?)')
      insert.run('Adam Smith', 'adam@example.edu')
      insert.run('Grace Hopper', 'grace@example.edu')
      insert.run('Wade 100%', 'wade@example.edu')
    })

    const names = async (url: string) => {
      const res = await createApp(db).request(url)
      expect(res.status).toBe(200)
      return ((await res.json()).data as { name: string }[]).map((s) => s.name)
    }

    it('returns all students without q', async () => {
      expect(await names('/students')).toEqual(['Ada Lovelace', 'Adam Smith', 'Grace Hopper', 'Wade 100%'])
    })

    it('returns all students when q is empty', async () => {
      expect(await names('/students?q=')).toHaveLength(4)
    })

    it('matches part of the name, case-insensitively', async () => {
      expect(await names('/students?q=ada')).toEqual(['Ada Lovelace', 'Adam Smith'])
      expect(await names('/students?q=ADA')).toEqual(['Ada Lovelace', 'Adam Smith'])
      expect(await names('/students?q=hopp')).toEqual(['Grace Hopper'])
    })

    it('does not match on email only', async () => {
      expect(await names('/students?q=example')).toEqual([])
    })

    it('returns an empty list when nothing matches', async () => {
      expect(await names('/students?q=zzz')).toEqual([])
    })

    it('treats % and _ literally', async () => {
      expect(await names('/students?q=%25')).toEqual(['Wade 100%'])
      expect(await names('/students?q=_')).toEqual([])
    })
  })
})
