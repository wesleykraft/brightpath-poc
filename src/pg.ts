import pg from 'pg'

const CONNECT_TIMEOUT_MS = 3000

/** Resolves true when the PostgreSQL database at `connectionString` answers `select 1`. */
export async function pingPostgres(connectionString: string | undefined): Promise<boolean> {
  if (!connectionString) return false
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    query_timeout: CONNECT_TIMEOUT_MS,
  })
  // Connection errors after connect (e.g. server restart) must not crash the process.
  client.on('error', () => {})
  try {
    await client.connect()
    await client.query('select 1')
    return true
  } catch {
    return false
  } finally {
    await client.end().catch(() => {})
  }
}
