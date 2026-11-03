import { PocketType, PocketConfig, DynamicPocketDefinition } from './types';

export class RavPockets {
  /**
   * Modèle standard initial (4 poches recommandées par défaut lors de la création d'un compte)
   */
  public static getDefaultPockets(): DynamicPocketDefinition[] {
    return [
      { id: 'pocket_food', name: 'Déjeuner & Repas', icon: '🥗', colorHex: '#10B981', targetPercentage: 0.40, displayOrder: 1, isSystemDefault: false },
      { id: 'pocket_transport', name: 'Mobilité & Trajets', icon: '🚗', colorHex: '#06B6D4', targetPercentage: 0.20, displayOrder: 2, isSystemDefault: false },
      { id: 'pocket_pleasure', name: 'Plaisirs & Cafés', icon: '☕', colorHex: '#8B5CF6', targetPercentage: 0.25, displayOrder: 3, isSystemDefault: false },
      { id: 'pocket_cushion', name: 'Coussin Sécurité', icon: '🛡️', colorHex: '#F59E0B', targetPercentage: 0.15, displayOrder: 4, isSystemDefault: true }
    ];
  }

  /**
   * Distribue le RAV quotidien selon la règle d'or statique des 4 poches (Compatibilité)
   */
  public static distribute(dailyRav: number, spentTodayByPocket: Partial<Record<PocketType, number>> = {}): Record<PocketType, PocketConfig> {
    const defaultPockets = this.getDefaultPockets();
    const dynamicConfigs = this.distributeDynamic(dailyRav, defaultPockets, spentTodayByPocket);
    
    const result = {} as Record<PocketType, PocketConfig>;
    for (const p of dynamicConfigs) {
      const key = p.id.replace('pocket_', '').toUpperCase() as PocketType;
      result[key] = p;
    }
    return result;
  }

  /**
   * Distribue dynamiquement le RAV quotidien sur une liste arbitraire de poches personnalisées
   * @param dailyRav - Montant total du RAV alloué pour la journée
   * @param userPockets - Liste dynamique des poches configurées par l'utilisateur
   * @param spentTodayByPocketId - Montants déjà dépensés aujourd'hui (clé = id de la poche)
   */
  public static distributeDynamic(
    dailyRav: number,
    userPockets: DynamicPocketDefinition[],
    spentTodayByPocketId: Partial<Record<string, number>> = {}
  ): PocketConfig[] {
    const rav = Math.max(0, dailyRav);
    const activePockets = userPockets.filter(p => !p.isArchived);

    return activePockets
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(p => {
        const allocated = Number((rav * p.targetPercentage).toFixed(2));
        const spent = spentTodayByPocketId[p.id] || 0;
        const remaining = Math.max(0, Number((allocated - spent).toFixed(2)));

        return {
          id: p.id,
          key: p.name,
          name: p.name,
          icon: p.icon,
          colorHex: p.colorHex || '#10B981',
          targetPercentage: p.targetPercentage,
          allocatedAmount: allocated,
          spentAmount: spent,
          remainingAmount: remaining,
          displayOrder: p.displayOrder,
          isSystemDefault: Boolean(p.isSystemDefault)
        };
      });
  }

  /**
   * Vérifie la cohérence comptable de la somme des pourcentages des poches
   */
  public static validateAllocations(pockets: DynamicPocketDefinition[]): {
    isValid: boolean;
    totalPercentage: number;
    remainingPercentage: number;
    error?: string;
  } {
    if (!pockets || !Array.isArray(pockets)) {
      return {
        isValid: true,
        totalPercentage: 1.0,
        remainingPercentage: 0
      };
    }

    const activePockets = pockets.filter(p => !p.isArchived);
    const total = activePockets.reduce((sum, p) => sum + (Number(p.targetPercentage) || 0), 0);
    const roundedTotal = Number((total || 0).toFixed(4));
    const remaining = Number((1.0 - roundedTotal).toFixed(4));

    if (roundedTotal > 1.0001) {
      return {
        isValid: false,
        totalPercentage: roundedTotal,
        remainingPercentage: remaining,
        error: `La somme des poches (${(roundedTotal * 100).toFixed(1)}%) dépasse 100% de l'enveloppe journalière.`
      };
    }

    return {
      isValid: true,
      totalPercentage: roundedTotal,
      remainingPercentage: Math.max(0, remaining)
    };
  }

  /**
   * Équilibre automatiquement une liste de poches en créant ou ajustant une poche tampon "Coussin Sécurité"
   */
  public static autoBalanceWithCushion(
    pockets: DynamicPocketDefinition[],
    cushionName = 'Coussin Sécurité'
  ): DynamicPocketDefinition[] {
    const nonCushionPockets = pockets.filter(p => !p.isSystemDefault && !p.isArchived);
    const allocatedTotal = nonCushionPockets.reduce((sum, p) => sum + p.targetPercentage, 0);
    const cushionPct = Number(Math.max(0.05, 1.0 - allocatedTotal).toFixed(4));

    const existingCushion = pockets.find(p => p.isSystemDefault);
    const cushionPocket: DynamicPocketDefinition = existingCushion
      ? { ...existingCushion, targetPercentage: cushionPct }
      : {
          id: 'pocket_cushion',
          name: cushionName,
          icon: '🛡️',
          colorHex: '#F59E0B',
          targetPercentage: cushionPct,
          displayOrder: 99,
          isSystemDefault: true,
          isArchived: false
        };

    return [...nonCushionPockets, cushionPocket];
  }
}
