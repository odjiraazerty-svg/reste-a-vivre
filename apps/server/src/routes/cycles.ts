import { FastifyPluginAsync } from 'fastify';
import { query } from '../db/pool';
import { RavFormulas, RavPockets } from '@rav/engine';

export const cycleRoutes: FastifyPluginAsync = async (fastify) => {
  // Récupérer le cycle actif avec calcul en temps réel du RAVq
  fastify.get('/current', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { userId } = request.user as { userId: string };

    try {
      // 1. Cycle actif
      const cycleRows = await query(
        `SELECT * FROM cycles WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      if (cycleRows.length === 0) {
        return reply.status(404).send({ error: 'Aucun cycle actif trouvé. Veuillez calibrer vos flux.' });
      }

      const cycle = cycleRows[0];

      // 2. Profil utilisateur (stratégie week-end, devise)
      const userRows = await query(`SELECT currency, weekend_strategy FROM users WHERE id = $1`, [userId]);
      const user = userRows[0] || { currency: 'EUR', weekend_strategy: 'DYNAMIC_WEIGHT' };

      // 3. Métriques du cycle
      const metrics = RavFormulas.computeCycleMetrics(28);

      // 4. Cumul des dépenses du cycle
      const expenseSumRows = await query(
        `SELECT COALESCE(SUM(amount), 0) AS total_spent FROM expenses WHERE cycle_id = $1`,
        [cycle.id]
      );
      const totalSpent = Number(expenseSumRows[0].total_spent);

      // 5. Dépenses d'aujourd'hui
      const todayExpenseRows = await query(
        `SELECT pocket_key, COALESCE(SUM(amount), 0) AS amount
         FROM expenses
         WHERE cycle_id = $1 AND expense_date = CURRENT_DATE
         GROUP BY pocket_key`,
        [cycle.id]
      );

      const spentTodayByPocket: Record<string, number> = {};
      let spentToday = 0;
      for (const row of todayExpenseRows) {
        const amt = Number(row.amount);
        spentTodayByPocket[row.pocket_key] = amt;
        spentToday += amt;
      }

      const isWeekend = [0, 6].includes(new Date().getDay());

      // 6. Calcul du RAVq
      const dailyRav = RavFormulas.calculateDailyRav({
        initialRavM: Number(cycle.initial_rav_m),
        totalSpentPriorInCycle: totalSpent - spentToday,
        remainingDays: metrics.remainingDays,
        strategy: user.weekend_strategy,
        isWeekendToday: isWeekend
      });

      const pockets = RavPockets.distribute(dailyRav, spentTodayByPocket);

      return {
        cycle: {
          id: cycle.id,
          startDate: cycle.start_date,
          endDate: cycle.end_date,
          declaredNetIncome: Number(cycle.declared_net_income),
          totalFixedCharges: Number(cycle.total_fixed_charges),
          sanctuarySavings: Number(cycle.sanctuary_savings),
          initialRavM: Number(cycle.initial_rav_m),
          totalSpentInCycle: totalSpent,
        },
        metrics,
        dailyRav,
        spentToday,
        remainingToday: Math.max(0, dailyRav - spentToday),
        currency: user.currency,
        pockets
      };
    } catch (err: any) {
      return reply.status(500).send({ error: 'Erreur lors du calcul du cycle', details: err.message });
    }
  });

  // Calibrer ou renouveler un cycle
  fastify.post('/calibrate', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const {
      declaredNetIncome,
      totalFixedCharges,
      sanctuarySavings,
      payDayOfMonth = 28,
      weekendStrategy = 'DYNAMIC_WEIGHT'
    } = request.body as any;

    try {
      const initialRavM = RavFormulas.calculateInitialRavM(
        declaredNetIncome,
        totalFixedCharges,
        sanctuarySavings
      );

      const metrics = RavFormulas.computeCycleMetrics(payDayOfMonth);

      // Désactiver les cycles précédents
      await query(`UPDATE cycles SET is_active = FALSE WHERE user_id = $1`, [userId]);

      // Mettre à jour la stratégie de l'utilisateur
      await query(`UPDATE users SET weekend_strategy = $1 WHERE id = $2`, [weekendStrategy, userId]);

      // Insérer le nouveau cycle
      const cycleRows = await query(
        `INSERT INTO cycles (user_id, start_date, end_date, declared_net_income, sanctuary_savings, total_fixed_charges, initial_rav_m, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
         RETURNING *`,
        [
          userId,
          metrics.cycleStartDate.toISOString().split('T')[0],
          metrics.cycleEndDate.toISOString().split('T')[0],
          declaredNetIncome,
          sanctuarySavings,
          totalFixedCharges,
          initialRavM
        ]
      );

      return {
        message: 'Cycle calibré avec succès',
        cycle: cycleRows[0],
        initialRavM,
        metrics
      };
    } catch (err: any) {
      return reply.status(500).send({ error: 'Erreur lors de la calibration', details: err.message });
    }
  });
};
