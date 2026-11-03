import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import dotenv from 'dotenv';
import { authRoutes } from './routes/auth';
import { cycleRoutes } from './routes/cycles';
import { expenseRoutes } from './routes/expenses';
import { pocketRoutes } from './routes/pockets';
import { aiRoutes } from './routes/ai';

dotenv.config();

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const server = Fastify({
  logger: true
});

// 1. Plugins
server.register(cors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

server.register(jwt, {
  secret: process.env.JWT_SECRET || 'rav_secret_jwt_key_2026'
});

// Décorateur d'authentification
server.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Token invalide ou expiré' });
  }
});

// 2. Healthcheck & Racine
server.get('/health', async () => {
  return {
    status: 'ONLINE',
    service: 'RAV API Backend',
    database: 'PostgreSQL 16+',
    timestamp: new Date().toISOString()
  };
});

// 3. Enregistrement des Routes
server.register(authRoutes, { prefix: '/api/v1/auth' });
server.register(cycleRoutes, { prefix: '/api/v1/cycles' });
server.register(expenseRoutes, { prefix: '/api/v1/expenses' });
server.register(pocketRoutes, { prefix: '/api/v1/pockets' });
server.register(aiRoutes, { prefix: '/api/v1/ai' });

// 4. Démarrage du Serveur
const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

const start = async () => {
  try {
    await server.listen({ port: PORT, host: HOST });
    console.log(`\n🚀 API Backend RAV prête sur http://localhost:${PORT}`);
    console.log(`📡 Endpoints :`);
    console.log(`   - GET  /health`);
    console.log(`   - POST /api/v1/auth/register & /login`);
    console.log(`   - GET  /api/v1/cycles/current`);
    console.log(`   - POST /api/v1/cycles/calibrate`);
    console.log(`   - POST /api/v1/expenses (2-Taps)`);
    console.log(`   - POST /api/v1/expenses/batch-sync (Offline-First)`);
    console.log(`   - GET  /api/v1/ai/nudge-of-the-day\n`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
