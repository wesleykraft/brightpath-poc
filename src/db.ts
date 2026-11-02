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
  const hasDeletedAt = db
    .prepare('PRAGMA table_info(students)')
    .all()
    .some((col) => (col as { name: string }).name === 'deleted_at')
  if (!hasDeletedAt) db.exec('ALTER TABLE students ADD COLUMN deleted_at TEXT')
  return db
}

const columns = 'id, name, email, created_at AS createdAt'

export function listStudents(db: Db, nameQuery?: string): Student[] {
  if (!nameQuery) return db.prepare(`SELECT ${columns} FROM students WHERE deleted_at IS NULL ORDER BY id`).all() as Student[]
  // instr() is a plain substring match, so '%' and '_' in the query are not wildcards.
  return db
    .prepare(`SELECT ${columns} FROM students WHERE deleted_at IS NULL AND instr(lower(name), lower(?)) > 0 ORDER BY id`)
    .all(nameQuery) as Student[]
}

export function getStudent(db: Db, id: number): Student | undefined {
  return db.prepare(`SELECT ${columns} FROM students WHERE id = ? AND deleted_at IS NULL`).get(id) as Student | undefined
}

/** Soft-deletes a student, keeping the row as history. Returns false if no active student has this id. */
export function removeStudent(db: Db, id: number): boolean {
  const result = db
    .prepare(
      "UPDATE students SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND deleted_at IS NULL",
    )
    .run(id)
  return result.changes > 0
}

export function countStudents(db: Db): number {
  const row = db.prepare('SELECT COUNT(*) AS count FROM students WHERE deleted_at IS NULL').get() as { count: number }
  return row.count
}

export function createStudent(db: Db, input: { name: string; email: string }): Student {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO students (name, email) VALUES (?, ?)')
    .run(input.name, input.email)
  return getStudent(db, Number(lastInsertRowid)) as Student
}
