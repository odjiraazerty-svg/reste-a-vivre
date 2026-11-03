/**
 * MOTEUR D'AUDIT IA : CHASSE AUX CHARGES FIXES & EFFET LATTE
 * Conforme à la Section 4 du Cahier des Charges
 */

export interface SubscriptionAuditItem {
  id: string;
  name: string;
  category: 'STREAMING' | 'FITNESS' | 'TELECOM' | 'ASSURANCE' | 'AUTRE';
  monthlyCost: number;
  icon: string;
  status: 'ACTIVE' | 'OPTIMIZED';
  recommendation: string;
}

export interface LatteEffectItem {
  id: string;
  name: string;
  icon: string;
  unitCost: number;
  daysPerWeek: number;
}

export class RavAuditEngine {
  /**
   * Convertit une économie mensuelle en liberté quotidienne sur le RAVq
   */
  public static monthlyToDailyGain(monthlyAmount: number, daysInMonth: number = 30): number {
    if (!monthlyAmount || monthlyAmount <= 0) return 0;
    return Number((monthlyAmount / daysInMonth).toFixed(2));
  }

  /**
   * Calcule le coût mensuel et annuel de l'effet Latte
   */
  public static computeLatteMetrics(unitCost: number, timesPerWeek: number): {
    monthlyCost: number;
    annualCost: number;
    dailyEquivalent: number;
  } {
    const weeklyCost = unitCost * timesPerWeek;
    const monthlyCost = Number((weeklyCost * 4.333).toFixed(2));
    const annualCost = Number((monthlyCost * 12).toFixed(2));
    const dailyEquivalent = Number((monthlyCost / 30).toFixed(2));

    return { monthlyCost, annualCost, dailyEquivalent };
  }

  /**
   * Liste type des abonnements audités par défaut
   */
  public static getDefaultAuditSubscriptions(): SubscriptionAuditItem[] {
    return [
      {
        id: 'sub_gym',
        name: 'Salle de Sport (Non fréquentée)',
        category: 'FITNESS',
        monthlyCost: 39.99,
        icon: '🏋️',
        status: 'ACTIVE',
        recommendation: 'Dernier passage il y a 45 jours. Résilier libère immédiatement +1.33 €/jour.'
      },
      {
        id: 'sub_stream2',
        name: 'Abonnement Streaming Vidéo n°2',
        category: 'STREAMING',
        monthlyCost: 17.99,
        icon: '🎬',
        status: 'ACTIVE',
        recommendation: 'Doublon avec votre premier service. Suspendre libère +0.60 €/jour.'
      },
      {
        id: 'sub_tel',
        name: 'Forfait Mobile 200 Go surdimensionné',
        category: 'TELECOM',
        monthlyCost: 29.99,
        icon: '📱',
        status: 'ACTIVE',
        recommendation: 'Consommation réelle < 15 Go. Passer à 9.99 €/m libère +0.67 €/jour.'
      },
      {
        id: 'sub_assur',
        name: 'Assurance Appareils / Doublon carte',
        category: 'ASSURANCE',
        monthlyCost: 14.50,
        icon: '🛡️',
        status: 'ACTIVE',
        recommendation: 'Couvert par votre carte bancaire. Résilier libère +0.48 €/jour.'
      }
    ];
  }
}
