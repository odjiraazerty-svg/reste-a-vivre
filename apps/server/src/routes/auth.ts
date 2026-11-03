import { FastifyPluginAsync } from 'fastify';
import { query } from '../db/pool';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // Enregistrement d'un nouvel utilisateur (Zero-Bank) : support Email ou Pseudo + Initialisation des poches
  fastify.post('/register', async (request, reply) => {
    const { identifier, email, username, password, currency = 'EUR', initialPockets } = request.body as any;

    const rawId = (identifier || username || email || '').trim();
    if (!rawId || !password) {
      return reply.status(400).send({ error: 'Un pseudo ou un email ainsi qu\'un mot de passe sont requis' });
    }

    // Déterminer s'il s'agit d'un email ou d'un pseudo
    const isEmail = rawId.includes('@');
    const finalEmail = isEmail ? rawId.toLowerCase() : (email ? email.toLowerCase() : null);
    const finalUsername = !isEmail ? rawId.toLowerCase() : (username ? username.toLowerCase() : rawId.split('@')[0].toLowerCase());

    try {
      const passwordHash = `mock_hash_${password}`;

      const rows = await query(
        `INSERT INTO users (email, username, password_hash, currency)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, username, currency, weekend_strategy, subscription_tier, created_at`,
        [finalEmail, finalUsername, passwordHash, currency]
      );

      const user = rows[0];

      // Configuration des 4 poches initiales (personnalisées ou recommandées par défaut)
      const defaultPockets = [
        { name: 'Déjeuner & Repas', icon: '🥗', colorHex: '#10B981', targetPercentage: 0.40, displayOrder: 1, isSystemDefault: false },
        { name: 'Mobilité & Trajets', icon: '🚗', colorHex: '#06B6D4', targetPercentage: 0.20, displayOrder: 2, isSystemDefault: false },
        { name: 'Plaisirs & Cafés', icon: '☕', colorHex: '#8B5CF6', targetPercentage: 0.25, displayOrder: 3, isSystemDefault: false },
        { name: 'Coussin Sécurité', icon: '🛡️', colorHex: '#F59E0B', targetPercentage: 0.15, displayOrder: 4, isSystemDefault: true }
      ];

      const pocketsToInsert = (Array.isArray(initialPockets) && initialPockets.length > 0)
        ? initialPockets
        : defaultPockets;

      for (const p of pocketsToInsert) {
        await query(
          `INSERT INTO pockets (user_id, name, icon, color_hex, target_percentage, display_order, is_system_default)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            user.id,
            p.name,
            p.icon || '📁',
            p.colorHex || '#10B981',
            Number(p.targetPercentage) || 0.25,
            p.displayOrder || 1,
            Boolean(p.isSystemDefault)
          ]
        );
      }

      const token = fastify.jwt.sign({ userId: user.id, username: user.username, email: user.email });

      return { user, token };
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.status(409).send({ error: 'Cet identifiant (pseudo ou email) est déjà utilisé' });
      }
      return reply.status(500).send({ error: 'Erreur lors de la création du compte', details: err.message });
    }
  });

  // Connexion : par Pseudo OU par Email
  fastify.post('/login', async (request, reply) => {
    const { identifier, email, username, password } = request.body as any;
    const loginIdentifier = (identifier || username || email || '').trim().toLowerCase();

    if (!loginIdentifier || !password) {
      return reply.status(400).send({ error: 'Identifiant et mot de passe requis' });
    }

    try {
      // Recherche indifférente par pseudo ou par email
      const rows = await query(
        `SELECT id, email, username, password_hash, currency, weekend_strategy, subscription_tier
         FROM users 
         WHERE LOWER(username) = $1 OR LOWER(email) = $1`,
        [loginIdentifier]
      );

      if (rows.length === 0) {
        return reply.status(401).send({ error: 'Identifiants invalides' });
      }

      const user = rows[0];
      const token = fastify.jwt.sign({ userId: user.id, username: user.username, email: user.email });

      return {
        user: {
          id: user.id,
          username: user.username || user.email?.split('@')[0],
          email: user.email,
          currency: user.currency,
          weekendStrategy: user.weekend_strategy,
          subscriptionTier: user.subscription_tier
        },
        token
      };
    } catch (err: any) {
      return reply.status(500).send({ error: 'Erreur serveur lors de la connexion', details: err.message });
    }
  });

  // Profil Utilisateur
  fastify.get('/me', {
    onRequest: [fastify.authenticate]
  }, async (request) => {
    const userPayload = request.user as { userId: string };
    const rows = await query(
      `SELECT id, email, username, currency, weekend_strategy, safety_cushion_pct, subscription_tier, created_at
       FROM users WHERE id = $1`,
      [userPayload.userId]
    );

    return { user: rows[0] };
  });
};
