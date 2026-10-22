import { Hono } from 'hono'
import { z } from 'zod'
import { type Db, getStudent, listStudents } from './db.js'
import { pingPostgres } from './pg.js'

const idParam = z.coerce.number().int().positive()

export function createApp(db: Db): Hono {
  const app = new Hono()

  app.get('/health', (c) => c.json({ ok: true }))

  app.get('/health/db', async (c) =>
    (await pingPostgres(process.env.DATABASE_URL))
      ? c.json({ ok: true })
      : c.json({ ok: false, error: 'DB_UNREACHABLE' }, 503),
  )

  app.get('/students', (c) => c.json({ data: listStudents(db) }))

  app.get('/students/:id', (c) => {
    const id = idParam.safeParse(c.req.param('id'))
    if (!id.success) return c.json({ error: 'INVALID_ID' }, 400)
    const student = getStudent(db, id.data)
    return student ? c.json({ data: student }) : c.json({ error: 'NOT_FOUND' }, 404)
  })

  app.onError((err, c) => {
    console.error('Unhandled error:', err)
    return c.json({ error: 'INTERNAL' }, 500)
  })

  return app
}
