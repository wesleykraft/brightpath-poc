import Database from 'better-sqlite3'

export type Db = Database.Database

export interface Student {
  readonly id: number
  readonly name: string
  readonly email: string
  readonly createdAt: string
}

export function openDb(path: string): Db {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `)
  return db
}

const columns = 'id, name, email, created_at AS createdAt'

export function listStudents(db: Db): Student[] {
  return db.prepare(`SELECT ${columns} FROM students ORDER BY id`).all() as Student[]
}

export function getStudent(db: Db, id: number): Student | undefined {
  return db.prepare(`SELECT ${columns} FROM students WHERE id = ?`).get(id) as Student | undefined
}
