import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function migrate() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/rav_db';
  console.log(`📡 Connexion à PostgreSQL : ${connectionString.replace(/:[^:@]+@/, ':****@')}`);

  // 1. Si on est en local et que la base rav_db n'existe pas encore, la créer via la base template 'postgres'
  if (connectionString.includes('localhost') || connectionString.includes('127.0.0.1')) {
    const url = new URL(connectionString);
    const dbName = url.pathname.replace('/', '') || 'rav_db';

    const rootClient = new Client({
      user: url.username,
      password: url.password,
      host: url.hostname,
      port: Number(url.port) || 5432,
      database: 'postgres'
    });

    try {
      await rootClient.connect();
      const checkRes = await rootClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
      if (checkRes.rows.length === 0) {
        console.log(`📦 Création de la base de données locale '${dbName}'...`);
        await rootClient.query(`CREATE DATABASE "${dbName}"`);
        console.log(`✅ Base '${dbName}' créée avec succès.`);
      } else {
        console.log(`ℹ️ La base de données '${dbName}' existe déjà.`);
      }
    } catch (e: any) {
      console.warn(`⚠️ Note sur la vérification initiale : ${e.message}`);
    } finally {
      await rootClient.end().catch(() => {});
    }
  }

  // 2. Connexion à la base cible (locale ou distante Cloud) et application du schéma
  const isRemote = !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1');
  const client = new Client({
    connectionString,
    ssl: isRemote ? { rejectUnauthorized: false } : undefined
  });

  try {
    await client.connect();
    console.log(`🚀 Application du schéma SQL (${path.join(__dirname, 'schema.sql')})...`);
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');

    await client.query(sql);
    console.log('✅ Schéma SQL appliqué avec succès !');

    // Vérification des tables créées
    const tablesRes = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    console.log('📋 Tables actives :', tablesRes.rows.map(r => r.table_name).join(', '));

    // Vérification des poches initiales
    const pocketsRes = await client.query('SELECT name, icon, target_percentage FROM pockets ORDER BY display_order');
    console.log(`📁 Poches configurées (${pocketsRes.rows.length}) :`);
    pocketsRes.rows.forEach(p => {
      console.log(`   - ${p.icon} ${p.name} : ${(Number(p.target_percentage) * 100).toFixed(0)}%`);
    });

  } catch (err: any) {
    console.error('❌ Erreur lors de la migration :', err.message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

migrate();

