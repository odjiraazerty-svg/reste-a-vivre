import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://rav_user:rav_password_secure@localhost:5432/rav_db';

const isRemote = !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1');

export const pool = new Pool({
  connectionString,
  ssl: isRemote ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.warn('[PostgreSQL Pool Warning] Erreur survenue sur un client inactif:', err.message);
});

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  try {
    const res = await pool.query(text, params);
    return res.rows;
  } catch (error: any) {
    console.error('[PostgreSQL Query Error]', { query: text, error: error.message });
    throw error;
  }
}
