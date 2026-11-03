import { FastifyPluginAsync } from 'fastify';
import { query } from '../db/pool';

export const expenseRoutes: FastifyPluginAsync = async (fastify) => {
  // Enregistrer une dépense unique « 2-Taps »
  fastify.post('/', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { pocketId, pocketKey, amount, label = '', clientSyncId, expenseDate } = request.body as any;

    const targetPocketRef = pocketId || pocketKey;
    if (!targetPocketRef || !amount || amount <= 0) {
      return reply.status(400).send({ error: 'Poche et montant (> 0) requis' });
    }

    try {
      // Trouver la poche correspondante et ses snapshots
      let pocketRows = await query(
        `SELECT id, name, icon FROM pockets WHERE user_id = $1 AND (id::text = $2 OR name ILIKE $2) AND is_archived = FALSE LIMIT 1`,
        [userId, targetPocketRef]
      );

      // Si non trouvée, prendre la première poche active ou la poche coussin
      if (pocketRows.length === 0) {
        pocketRows = await query(
          `SELECT id, name, icon FROM pockets WHERE user_id = $1 AND is_archived = FALSE ORDER BY display_order ASC LIMIT 1`,
          [userId]
        );
      }

      if (pocketRows.length === 0) {
        return reply.status(400).send({ error: 'Aucune poche active configurée' });
      }

      const activePocket = pocketRows[0];

      // Trouver le cycle actif
      const cycleRows = await query(
        `SELECT id FROM cycles WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      if (cycleRows.length === 0) {
        return reply.status(400).send({ error: 'Aucun cycle actif pour rattacher cette dépense' });
      }

      const cycleId = cycleRows[0].id;
      const date = expenseDate || new Date().toISOString().split('T')[0];

      const rows = await query(
        `INSERT INTO expenses (user_id, cycle_id, pocket_id, amount, expense_date, label, pocket_name_snapshot, pocket_icon_snapshot, client_sync_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (client_sync_id) DO NOTHING
         RETURNING *`,
        [userId, cycleId, activePocket.id, amount, date, label, activePocket.name, activePocket.icon, clientSyncId || null]
      );

      return {
        success: true,
        expense: rows[0] || { message: 'Déjà synchronisé (idempotence)' }
      };
    } catch (err: any) {
      return reply.status(500).send({ error: 'Erreur lors de l\'enregistrement', details: err.message });
    }
  });

  // SYNCHRONISATION OFFLINE-FIRST PAR LOT (BATCH SYNC)
  // Reçoit une liste de dépenses enregistrées hors-ligne sur le smartphone
  fastify.post('/batch-sync', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { expenses } = request.body as { expenses: any[] };

    if (!Array.isArray(expenses) || expenses.length === 0) {
      return { syncedCount: 0, message: 'Aucune transaction à synchroniser' };
    }

    try {
      const cycleRows = await query(
        `SELECT id FROM cycles WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      const cycleId = cycleRows[0]?.id;
      if (!cycleId) {
        return reply.status(400).send({ error: 'Aucun cycle actif pour ce compte' });
      }

      // Charger les poches actives de l'utilisateur pour résolution rapide
      const userPockets = await query(
        `SELECT id, name, icon FROM pockets WHERE user_id = $1 AND is_archived = FALSE ORDER BY display_order ASC`,
        [userId]
      );

      const defaultPocket = userPockets[0];
      let insertedCount = 0;

      for (const item of expenses) {
        const pocketRef = item.pocketId || item.pocketKey;
        const matched = userPockets.find(p => p.id === pocketRef || p.name.toUpperCase().includes(String(pocketRef).toUpperCase())) || defaultPocket;

        if (!matched) continue;

        const res = await query(
          `INSERT INTO expenses (user_id, cycle_id, pocket_id, amount, expense_date, label, pocket_name_snapshot, pocket_icon_snapshot, client_sync_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (client_sync_id) DO NOTHING
           RETURNING id`,
          [
            userId,
            cycleId,
            matched.id,
            item.amount,
            item.date || item.expenseDate || new Date().toISOString().split('T')[0],
            item.label || '',
            matched.name,
            matched.icon,
            item.clientSyncId
          ]
        );

        if (res.length > 0) {
          insertedCount++;
        }
      }

      return {
        success: true,
        receivedCount: expenses.length,
        insertedCount,
        syncedAt: new Date().toISOString()
      };
    } catch (err: any) {
      return reply.status(500).send({ error: 'Erreur lors de la synchronisation par lot', details: err.message });
    }
  });

  // Historique des dépenses du cycle
  fastify.get('/', {
    onRequest: [fastify.authenticate]
  }, async (request) => {
    const { userId } = request.user as { userId: string };

    const rows = await query(
      `SELECT e.id, e.pocket_id AS "pocketId", e.pocket_name_snapshot AS "pocketName", 
              e.pocket_icon_snapshot AS "pocketIcon", e.amount, e.expense_date AS "expenseDate", 
              e.label, e.client_sync_id AS "clientSyncId", e.created_at AS "createdAt"
       FROM expenses e
       WHERE e.user_id = $1
       ORDER BY e.created_at DESC
       LIMIT 50`,
      [userId]
    );

    return { expenses: rows };
  });

  // Corriger / Modifier une dépense existante
  fastify.put('/:id', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const { amount, pocketId, label, expenseDate } = request.body as any;

    try {
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (amount !== undefined) {
        updates.push(`amount = $${idx++}`);
        values.push(amount);
      }

      if (label !== undefined) {
        updates.push(`label = $${idx++}`);
        values.push(label);
      }

      if (expenseDate !== undefined) {
        updates.push(`expense_date = $${idx++}`);
        values.push(expenseDate);
      }

      if (pocketId !== undefined) {
        const pRows = await query(`SELECT name, icon FROM pockets WHERE id = $1 AND user_id = $2`, [pocketId, userId]);
        if (pRows.length > 0) {
          updates.push(`pocket_id = $${idx++}`);
          values.push(pocketId);
          updates.push(`pocket_name_snapshot = $${idx++}`);
          values.push(pRows[0].name);
          updates.push(`pocket_icon_snapshot = $${idx++}`);
          values.push(pRows[0].icon);
        }
      }

      if (updates.length === 0) {
        return reply.status(400).send({ error: 'Aucun champ à modifier' });
      }

      values.push(id, userId);
      const rows = await query(
        `UPDATE expenses SET ${updates.join(', ')} WHERE (id::text = $${idx++} OR client_sync_id = $${idx - 1}) AND user_id = $${idx++} RETURNING *`,
        values
      );

      return { success: true, expense: rows[0] };
    } catch (err: any) {
      return reply.status(500).send({ error: 'Erreur lors de la modification', details: err.message });
    }
  });

  // Supprimer une dépense
  fastify.delete('/:id', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };

    try {
      await query(
        `DELETE FROM expenses WHERE (id::text = $1 OR client_sync_id = $1) AND user_id = $2`,
        [id, userId]
      );
      return { success: true, message: 'Dépense supprimée' };
    } catch (err: any) {
      return reply.status(500).send({ error: 'Erreur lors de la suppression', details: err.message });
    }
  });
};
