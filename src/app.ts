import { Hono } from 'hono'
import { z } from 'zod'
import { type Db, getStudent, listStudents, removeStudent } from './db.js'

const idParam = z.coerce.number().int().positive()

export function createApp(db: Db): Hono {
  const app = new Hono()

  app.get('/health', (c) => c.json({ ok: true }))

  app.get('/students', (c) => c.json({ data: listStudents(db) }))

  app.get('/students/:id', (c) => {
    const id = idParam.safeParse(c.req.param('id'))
    if (!id.success) return c.json({ error: 'INVALID_ID' }, 400)
    const student = getStudent(db, id.data)
    return student ? c.json({ data: student }) : c.json({ error: 'NOT_FOUND' }, 404)
  })

  app.delete('/students/:id', (c) => {
    const id = idParam.safeParse(c.req.param('id'))
    if (!id.success) return c.json({ error: 'INVALID_ID' }, 400)
    return removeStudent(db, id.data) ? c.body(null, 204) : c.json({ error: 'NOT_FOUND' }, 404)
  })

  app.onError((err, c) => {
    console.error('Unhandled error:', err)
    return c.json({ error: 'INTERNAL' }, 500)
  })

  return app
}
