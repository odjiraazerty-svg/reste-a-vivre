import { FastifyPluginAsync } from 'fastify';
import { query } from '../db/pool';
import { RavNudges } from '@rav/engine';

export const aiRoutes: FastifyPluginAsync = async (fastify) => {
  // Récupérer le conseil du jour (Nudge Bienveillant)
  fastify.get('/nudge-of-the-day', {
    onRequest: [fastify.authenticate]
  }, async (request) => {
    const { userId } = request.user as { userId: string };

    // 1. Chercher si un nudge existe déjà pour aujourd'hui en BDD
    const existingNudge = await query(
      `SELECT * FROM ai_nudges WHERE user_id = $1 AND created_at >= CURRENT_DATE ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (existingNudge.length > 0) {
      return { nudge: existingNudge[0] };
    }

    // 2. Sinon, générer dynamiquement à partir des dépenses du jour
    const spentTodayRows = await query(
      `SELECT COALESCE(SUM(amount), 0) AS spent FROM expenses WHERE user_id = $1 AND expense_date = CURRENT_DATE`,
      [userId]
    );

    const spentToday = Number(spentTodayRows[0].spent);
    const dailyRav = 42.50; // Valeur du jour ou extraite du cycle
    const userRows = await query(`SELECT currency FROM users WHERE id = $1`, [userId]);
    const currency = userRows[0]?.currency || 'EUR';

    const nudgeCard = RavNudges.generateDynamicNudge({
      dailyRav,
      spentToday,
      currency
    });

    // Enregistrer dans la table PostgreSQL ai_nudges
    await query(
      `INSERT INTO ai_nudges (user_id, level, title, message, potential_daily_gain)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, nudgeCard.level, nudgeCard.title, nudgeCard.message, nudgeCard.potentialDailyGain]
    );

    return { nudge: nudgeCard };
  });
};
