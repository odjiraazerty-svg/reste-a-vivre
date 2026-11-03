import { AiNudgeCard, CurrencyCode } from './types';

export class RavNudges {
  /**
   * Génère un conseil économique bienveillant (Nudge Positif)
   */
  public static generateDynamicNudge(params: {
    dailyRav: number;
    spentToday: number;
    currency: CurrencyCode | string;
  }): AiNudgeCard {
    const { dailyRav, spentToday, currency } = params;
    const remaining = dailyRav - spentToday;

    if (remaining > 15) {
      return {
        id: 'nudge_' + Date.now(),
        level: 4,
        title: 'Opportunité Week-end ✨',
        message: `Superbe allure ! Tu as un reliquat disponible de ${remaining.toFixed(2)} ${currency} aujourd'hui. En l'épargnant ce soir, tu augmentes ton pack week-end de +${(remaining / 2).toFixed(2)} ${currency}.`,
        potentialDailyGain: Number((remaining / 5).toFixed(2)),
        actionLabel: 'Verser au pack week-end'
      };
    } else if (remaining >= 0) {
      return {
        id: 'nudge_' + Date.now(),
        level: 2,
        title: 'Rythme Parfait 🎯',
        message: `Tu maîtrises parfaitement ton reste à vivre du jour. Aucune pression sur les jours à venir.`,
        potentialDailyGain: 0,
        actionLabel: 'Garder le cap'
      };
    } else {
      const deficit = Math.abs(remaining).toFixed(2);
      return {
        id: 'nudge_' + Date.now(),
        level: 1,
        title: 'Lissage Protecteur 🛡️',
        message: `Dépassement de ${deficit} ${currency} aujourd'hui. Ce surplus a été automatiquement absorbé et lissé sur les jours restants de ton cycle sans toucher à ton épargne sanctuarisée.`,
        potentialDailyGain: 0,
        actionLabel: 'Détails de l\'amortissement'
      };
    }
  }
}
