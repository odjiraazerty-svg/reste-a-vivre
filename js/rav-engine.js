/**
 * MOTEUR MATHÉMATIQUE DU RESTE À VIVRE (RAV)
 * Implémentation conforme aux spécifications du Cahier des Charges v1.0
 */

export class RavEngine {
  /**
   * Calcule le RAV Mensuel Initial (RAVm)
   * Formule : RAVm = Revenus Nets Déclarés - (Charges Fixes + Épargne Sanctuarisée)
   */
  static calculateInitialRavM(netIncome, fixedChargesTotal, sanctuarySavings) {
    const income = Math.max(0, Number(netIncome) || 0);
    const fixed = Math.max(0, Number(fixedChargesTotal) || 0);
    const savings = Math.max(0, Number(sanctuarySavings) || 0);
    
    const ravm = income - (fixed + savings);
    return Math.max(0, Number(ravm.toFixed(2)));
  }

  /**
   * Calcule le nombre de jours restants dans le cycle de paie courant
   * @param {number} payDayOfMonth - Jour de versement de paie (ex: 28)
   * @param {Date} currentDate - Date actuelle
   */
  static getCycleMetrics(payDayOfMonth = 28, currentDate = new Date()) {
    const now = new Date(currentDate);
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    const currentDay = now.getDate();

    let cycleStartDate;
    let cycleEndDate;

    if (currentDay >= payDayOfMonth) {
      // Le cycle a débuté ce mois-ci le jour de paye
      cycleStartDate = new Date(currentYear, currentMonth, payDayOfMonth);
      // Le cycle se termine le jour avant la prochaine paye le mois suivant
      cycleEndDate = new Date(currentYear, currentMonth + 1, payDayOfMonth - 1);
    } else {
      // Le cycle a débuté le mois précédent
      cycleStartDate = new Date(currentYear, currentMonth - 1, payDayOfMonth);
      cycleEndDate = new Date(currentYear, currentMonth, payDayOfMonth - 1);
    }

    // Nombre total de jours dans le cycle
    const totalDays = Math.round((cycleEndDate - cycleStartDate) / (1000 * 60 * 60 * 24)) + 1;
    // Jours écoulés (inclusif)
    const elapsedDays = Math.max(1, Math.round((now - cycleStartDate) / (1000 * 60 * 60 * 24)) + 1);
    // Jours restants jusqu'à la prochaine paie (inclus aujourd'hui)
    const remainingDays = Math.max(1, Math.round((cycleEndDate - now) / (1000 * 60 * 60 * 24)) + 1);

    return {
      cycleStartDate,
      cycleEndDate,
      totalDays,
      elapsedDays,
      remainingDays
    };
  }

  /**
   * Calcule le RAV Quotidien Opérationnel (RAVq) avec lissage continu et stratégie week-end
   * @param {Object} params
   */
  static calculateDailyRav({
    ravM,
    totalSpentInCycle,
    remainingDays,
    strategy = 'DYNAMIC_WEIGHT', // 'DYNAMIC_WEIGHT' | 'WEEKEND_PACK' | 'ROLLOVER'
    isWeekendToday = false,
    weekendPackBalance = 0
  }) {
    // Solde résiduel disponible pour le reste du cycle
    const remainingCycleBudget = Math.max(0, ravM - totalSpentInCycle);

    if (remainingDays <= 1) {
      return Number(remainingCycleBudget.toFixed(2));
    }

    if (strategy === 'DYNAMIC_WEIGHT') {
      // Poids : 1.0 en semaine, 2.0 le week-end
      // Calcul du poids total restant sur les N jours
      const todayWeight = isWeekendToday ? 2.0 : 1.0;
      
      // Approximation statistique des jours de week-end restants
      const weekendDaysRemaining = Math.round(remainingDays * (2 / 7));
      const weekdayDaysRemaining = remainingDays - weekendDaysRemaining;
      
      const totalWeight = (weekdayDaysRemaining * 1.0) + (weekendDaysRemaining * 2.0);
      
      if (totalWeight <= 0) return 0;
      
      const allocatedToday = (remainingCycleBudget / totalWeight) * todayWeight;
      return Number(allocatedToday.toFixed(2));
    }

    if (strategy === 'WEEKEND_PACK') {
      // Si week-end pack : 40% sanctuarisé pour le week-end, le reste en semaine
      if (isWeekendToday) {
        // En week-end : on puise dans le pack week-end
        const weekendAllocation = (weekendPackBalance / 2);
        return Number(weekendAllocation.toFixed(2));
      } else {
        // En semaine : lissage du budget semaine hors pack week-end
        const weekdayBudget = remainingCycleBudget * 0.6;
        const allocated = weekdayBudget / Math.max(1, remainingDays * (5 / 7));
        return Number(allocated.toFixed(2));
      }
    }

    // Stratégie Rollover / Uniforme
    const standardDaily = remainingCycleBudget / remainingDays;
    return Number(standardDaily.toFixed(2));
  }

  /**
   * Répartit le RAV quotidien (RAVq) entre les poches budgétaires dynamiques
   * @param {number} dailyRav
   * @param {Array} userPockets
   * @param {Object} spentTodayByPocket
   */
  static distributeDynamicPockets(dailyRav, userPockets = [], spentTodayByPocket = {}) {
    const rav = Math.max(0, Number(dailyRav) || 0);

    return userPockets.map(p => {
      const pct = p.targetPercentage || 0;
      const allocated = Number((rav * pct).toFixed(2));
      const spent = spentTodayByPocket[p.id] || 0;
      const remaining = Math.max(0, Number((allocated - spent).toFixed(2)));

      return {
        id: p.id,
        name: p.name,
        icon: p.icon || '📁',
        colorHex: p.colorHex || '#10B981',
        percentage: pct,
        allocated,
        spent,
        remaining
      };
    });
  }

  /**
   * Répartit le RAV quotidien (RAVq) entre les 4 poches budgétaires
   * Règle d'or : Max 4 poches
   * - Déjeuner / Alimentation : 40%
   * - Transport / Mobilité : 20%
   * - Divers / Plaisirs : 25%
   * - Coussin d'Imprévus : 15%
   */
  static distributePockets(dailyRav) {
    const rav = Math.max(0, Number(dailyRav) || 0);

    return {
      food: {
        id: 'pocket_food',
        name: 'Déjeuner & Repas',
        icon: '🥗',
        percentage: 0.40,
        allocated: Number((rav * 0.40).toFixed(2))
      },
      transport: {
        id: 'pocket_transport',
        name: 'Mobilité & Trajets',
        icon: '🚗',
        percentage: 0.20,
        allocated: Number((rav * 0.20).toFixed(2))
      },
      pleasure: {
        id: 'pocket_pleasure',
        name: 'Plaisirs & Divers',
        icon: '☕',
        percentage: 0.25,
        allocated: Number((rav * 0.25).toFixed(2))
      },
      cushion: {
        id: 'pocket_cushion',
        name: 'Coussin Imprévus',
        icon: '🛡️',
        percentage: 0.15,
        allocated: Number((rav * 0.15).toFixed(2))
      }
    };
  }

  /**
   * Génère un conseil bienveillant (Nudge IA) sans culpabilisation
   */
  static generateNudge(expensesToday, dailyRav, currency = '€') {
    const spent = expensesToday.reduce((sum, e) => sum + e.amount, 0);
    const remaining = dailyRav - spent;

    if (remaining > 15) {
      const surplus = remaining.toFixed(2);
      return {
        level: 4,
        title: 'Opportunité Week-end ✨',
        text: `Superbe gestion ! Tu as un surplus prévisionnel de ${surplus} ${currency} aujourd'hui. Souhaites-tu les transférer automatiquement vers ton pack week-end ?`,
        gainDaily: `+${(remaining / 5).toFixed(2)} ${currency}/jour`,
        actionLabel: 'Verser au Pack Week-end'
      };
    } else if (remaining >= 0) {
      return {
        level: 2,
        title: 'Rythme Parfait 🎯',
        text: `Tu es parfaitement dans les clous de ton budget du jour. Ton reste à vivre reste intact pour demain !`,
        gainDaily: `Objectif tenu`,
        actionLabel: 'Continuer ainsi'
      };
    } else {
      const deficit = Math.abs(remaining).toFixed(2);
      return {
        level: 1,
        title: 'Amortissement Bienveillant 🛡️',
        text: `Dépassement ponctuel de ${deficit} ${currency} aujourd'hui. Pas de panique : le système a automatiquement lissé cet écart sur les jours restants sans impacter tes charges fixes.`,
        gainDaily: `Lissage activé`,
        actionLabel: 'Voir le plan de lissage'
      };
    }
  }
}
