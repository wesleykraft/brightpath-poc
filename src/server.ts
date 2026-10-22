import { readFileSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { openDb } from './db.js'

const port = Number(process.env.PORT ?? 3000)
const db = openDb(process.env.DB_PATH ?? 'brightpath.db')
const app = createApp(db)
const page = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8')

app.get('/', (c) => c.html(page))

serve({ fetch: app.fetch, port }, () => console.log(`Brightpath on http://localhost:${port}`))
