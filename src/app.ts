import { readFileSync } from 'node:fs'
import { Hono } from 'hono'
import { z } from 'zod'
import { type Db, countStudents, createStudent, getStudent, listStudents, removeStudent } from './db.js'
import { pingPostgres } from './pg.js'

const newStudent = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().max(320).pipe(z.email()),
})

const { version } = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string }

const idParam = z.coerce.number().int().positive()
const listQuery = z.object({ q: z.string().trim().optional() })

export function createApp(db: Db): Hono {
  const app = new Hono()

  app.get('/health', (c) => c.json({ ok: true, version }))

  app.get('/health/db', async (c) =>
    (await pingPostgres(process.env.DATABASE_URL))
      ? c.json({ ok: true })
      : c.json({ ok: false, error: 'DB_UNREACHABLE' }, 503),
  )

  app.get('/students', (c) => {
    const query = listQuery.safeParse({ q: c.req.query('q') })
    if (!query.success) return c.json({ error: 'INVALID_QUERY' }, 400)
    return c.json({ data: listStudents(db, query.data.q) })
  })

  app.post('/students', async (c) => {
    const body = await c.req.json().catch(() => undefined)
    const input = newStudent.safeParse(body)
    if (!input.success) return c.json({ error: 'INVALID_INPUT' }, 400)
    return c.json({ data: createStudent(db, input.data) }, 201)
  })

  app.get('/students/count', (c) => c.json({ data: { count: countStudents(db) } }))

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
