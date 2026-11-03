import { FastifyPluginAsync } from 'fastify';
import { query } from '../db/pool';

export const pocketRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Lister les poches actives de l'utilisateur
  fastify.get('/', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { userId } = request.user as { userId: string };

    try {
      const rows = await query(
        `SELECT id, name, icon, color_hex AS "colorHex", target_percentage AS "targetPercentage", 
                display_order AS "displayOrder", is_system_default AS "isSystemDefault", created_at AS "createdAt"
         FROM pockets
         WHERE user_id = $1 AND is_archived = FALSE
         ORDER BY display_order ASC, created_at ASC`,
        [userId]
      );

      return {
        success: true,
        pockets: rows
      };
    } catch (err: any) {
      return reply.status(500).send({ error: 'Erreur lors de la récupération des poches', details: err.message });
    }
  });

  // 2. Créer une nouvelle poche dynamique
  fastify.post('/', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { name, icon = '📁', colorHex = '#10B981', targetPercentage, displayOrder = 0 } = request.body as any;

    if (!name || targetPercentage === undefined || targetPercentage <= 0) {
      return reply.status(400).send({ error: 'Nom et pourcentage d\'allocation (> 0) obligatoires' });
    }

    try {
      const rows = await query(
        `INSERT INTO pockets (user_id, name, icon, color_hex, target_percentage, display_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, icon, color_hex AS "colorHex", target_percentage AS "targetPercentage", display_order AS "displayOrder"`,
        [userId, name.trim(), icon, colorHex, targetPercentage, displayOrder]
      );

      return reply.status(201).send({
        success: true,
        pocket: rows[0]
      });
    } catch (err: any) {
      return reply.status(400).send({ error: 'Impossible de créer la poche', details: err.message });
    }
  });

  // 3. Mettre à jour une poche (nom, icône, pourcentage ou ordre)
  fastify.put('/:id', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };
    const { name, icon, colorHex, targetPercentage, displayOrder } = request.body as any;

    try {
      const rows = await query(
        `UPDATE pockets
         SET name = COALESCE($1, name),
             icon = COALESCE($2, icon),
             color_hex = COALESCE($3, color_hex),
             target_percentage = COALESCE($4, target_percentage),
             display_order = COALESCE($5, display_order),
             updated_at = NOW()
         WHERE id = $6 AND user_id = $7 AND is_archived = FALSE
         RETURNING id, name, icon, color_hex AS "colorHex", target_percentage AS "targetPercentage", display_order AS "displayOrder"`,
        [name ? name.trim() : null, icon, colorHex, targetPercentage, displayOrder, id, userId]
      );

      if (rows.length === 0) {
        return reply.status(404).send({ error: 'Poche introuvable ou déjà archivée' });
      }

      return {
        success: true,
        pocket: rows[0]
      };
    } catch (err: any) {
      return reply.status(400).send({ error: 'Erreur de mise à jour', details: err.message });
    }
  });

  // 4. Archiver une poche (Soft delete sécurisé pour préserver les dépenses)
  fastify.delete('/:id', {
    onRequest: [fastify.authenticate]
  }, async (request, reply) => {
    const { userId } = request.user as { userId: string };
    const { id } = request.params as { id: string };

    try {
      const rows = await query(
        `UPDATE pockets
         SET is_archived = TRUE,
             archived_at = NOW(),
             updated_at = NOW()
         WHERE id = $1 AND user_id = $2 AND is_archived = FALSE
         RETURNING id, name`,
        [id, userId]
      );

      if (rows.length === 0) {
        return reply.status(404).send({ error: 'Poche introuvable ou déjà archivée' });
      }

      return {
        success: true,
        message: `Poche '${rows[0].name}' archivée avec succès. L'historique des dépenses est sanctuarisé.`
      };
    } catch (err: any) {
      return reply.status(500).send({ error: 'Erreur lors de l\'archivage', details: err.message });
    }
  });
};

