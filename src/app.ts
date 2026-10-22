import { Hono } from 'hono'
import { z } from 'zod'
import { type Db, createStudent, getStudent, listStudents } from './db.js'

const newStudent = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
})

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

  app.post('/students', async (c) => {
    const body = await c.req.json().catch(() => undefined)
    const input = newStudent.safeParse(body)
    if (!input.success) return c.json({ error: 'INVALID_INPUT' }, 400)
    // Emails are intentionally not unique: a repeated email creates a new student.
    return c.json({ data: createStudent(db, input.data) }, 201)
  })

  app.onError((err, c) => {
    console.error('Unhandled error:', err)
    return c.json({ error: 'INTERNAL' }, 500)
  })

  return app
}
